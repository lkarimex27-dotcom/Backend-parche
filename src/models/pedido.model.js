const { query } = require('../../config/db');
const { ESTIMADOR } = require('../../config/constants');

const SELECT = `
  SELECT p.id_pedido, p.id_cliente, u.correo, COALESCE(pe.nombre, p.nombre_contacto) AS cliente,
         p.nombre_contacto, p.telefono_contacto, p.tipo_entrega, p.direccion_entrega, p.observacion, p.metodo_pago,
         json_build_object(
           'nombre', COALESCE(p.nombre_contacto, pe.nombre),
           'telefono', p.telefono_contacto
         ) AS destinatario,
         p.estado, p.estado_produccion, p.estado_pago, p.motivo_rechazo_pago, p.comprobante, p.produccion_autorizada,
         CASE WHEN jsonb_array_length(p.comprobantes) > 0 THEN p.comprobantes
              WHEN p.comprobante IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p.comprobante) END AS comprobantes,
         p.registros_produccion, p.id_barrio, p.estimacion_inicial,
         p.subtotal::float AS subtotal, p.costo_domicilio_cop::float AS costo_domicilio_cop,
         p.total::float AS total, p.abono::float AS abono, p.pago_mixto, p.creado_en, p.devolucion,
         b.nombre AS barrio,
         COALESCE((SELECT json_agg(json_build_object(
                     'producto', i.nombre, 'cantidad', d.cantidad::float, 'precio_unitario', d.precio_unitario::float,
                     'detalle', d.observacion::json) ORDER BY d.id_pedido_detalle)
                     FROM pedido_detalle d JOIN insumos_productos i ON i.id_insumo_producto = d.id_insumo_producto
                    WHERE d.id_pedido = p.id_pedido), '[]'::json) AS items,
         COALESCE((SELECT json_agg(json_build_object(
                     'estado', h.estado, 'fecha', h.fecha, 'usuario', COALESCE(hp.nombre, hu.correo)) ORDER BY h.fecha, h.id_historial)
                     FROM historial_estados_pedido h
                     LEFT JOIN usuarios hu ON hu.id_usuario = h.id_usuario
                     LEFT JOIN personas hp ON hp.id_usuario = h.id_usuario
                    WHERE h.id_pedido = p.id_pedido), '[]'::json) AS historial
    FROM pedidos p
    JOIN usuarios u ON u.id_usuario = p.id_cliente
    LEFT JOIN barrios b ON b.id_barrio = p.id_barrio
    LEFT JOIN personas pe ON pe.id_usuario = p.id_cliente`;

const listar = async () => (await query(`${SELECT} ORDER BY p.creado_en DESC`)).rows;

const listarDeCliente = async (idCliente) =>
  (await query(`${SELECT} WHERE p.id_cliente = $1 ORDER BY p.creado_en DESC`, [idCliente])).rows;

const obtenerPorId = async (id, c, bloquear = false) =>
  (await (c || { query }).query(`${SELECT} WHERE p.id_pedido = $1${bloquear ? ' FOR UPDATE OF p' : ''}`, [id])).rows[0] || null;

// Productos activos del menú (incluye adiciones, salsas y bebidas) para calcular precios en el servidor
const catalogoActivo = async () =>
  (await query(
    `SELECT i.id_insumo_producto, i.nombre, i.precio::float AS precio, c.nombre_categoria AS categoria
       FROM insumos_productos i JOIN categorias c ON c.id_categoria = i.id_categoria
      WHERE i.tipo = 'PRODUCTO' AND i.estado = 'ACTIVO'
     UNION ALL ${require('./insumoProducto.model').SALSAS_CASA}`
  )).rows;

const crear = async (c, d) =>
  (await c.query(
    `INSERT INTO pedidos (id_cliente, estado, nombre_contacto, telefono_contacto, tipo_entrega, direccion_entrega, observacion,
                          metodo_pago, estado_pago, comprobante, subtotal, costo_domicilio_cop, total,
                          id_barrio, estimacion_inicial, abono, pago_mixto, comprobantes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $21,
             CASE WHEN $10::text IS NULL THEN '[]'::jsonb
                  ELSE jsonb_build_array(jsonb_build_object('imagen', $10::text, 'referencia', $17::text, 'valor', $18::numeric,
                                                            'hash', $19::text, 'dudoso', $20::boolean, 'subido_en', now())) END) RETURNING id_pedido`,
    [d.id_cliente, d.estado, d.nombre, d.telefono, d.tipo_entrega ?? 'domicilio', d.direccion, d.notas ?? null, d.pago, d.estado_pago,
     d.comprobante ?? null, d.subtotal, d.costo_domicilio_cop, d.total, d.id_barrio,
     JSON.stringify(d.estimacion_inicial), d.abono ?? null,
     d.soporte?.referencia ?? null, d.soporte?.valor ?? null, d.soporte?.hash ?? null, !!d.soporte?.dudoso, !!d.pago_mixto]
  )).rows[0].id_pedido;

const crearDetalle = (c, idPedido, it) =>
  c.query(
    `INSERT INTO pedido_detalle (id_pedido, id_insumo_producto, cantidad, precio_unitario, subtotal, observacion)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [idPedido, it.id_insumo_producto, it.cantidad, it.precio_unitario, it.subtotal, JSON.stringify(it.detalle)]
  );

// Cambian los productos del pedido (solo el panel): fuera las líneas anteriores, entran las nuevas
const reemplazarDetalle = async (c, idPedido, lineas) => {
  await c.query('DELETE FROM pedido_detalle WHERE id_pedido = $1', [idPedido]);
  for (const l of lineas) await crearDetalle(c, idPedido, l);
};

// Lo que pide la ficha técnica de cada producto de cada insumo (por unidad, en la unidad del inventario), su stock y
// lo que ya apartan los pedidos abiertos de la tienda: aún no pasan por cocina, que es donde se descuenta el stock
const insumosParaPreparar = async (c, ids, excluirPedido = 0) => {
  const { NECESITA } = require('./insumoProducto.model');
  return (await c.query(
    `WITH receta AS (
       SELECT f.id_insumo_producto AS producto, i.id_insumo_producto AS insumo, i.nombre, i.stock::float AS stock,
              (${NECESITA})::float AS necesita
         FROM fichas_tecnicas f
         JOIN ficha_tecnica_insumos fi ON fi.id_ficha_tecnica = f.id_ficha_tecnica
         JOIN insumos_productos i ON i.id_insumo_producto = fi.id_insumo_producto)
     SELECT r.*,
            COALESCE((SELECT SUM(d.cantidad * a.necesita)
                        FROM pedido_detalle d
                        JOIN pedidos p ON p.id_pedido = d.id_pedido
                        JOIN receta a ON a.producto = d.id_insumo_producto AND a.insumo = r.insumo
                       WHERE p.estado IN ('Por confirmar', 'Recibido', 'Confirmado') AND p.id_pedido <> $2), 0)::float AS apartado
       FROM receta r
      WHERE r.producto = ANY($1::int[])`,
    [ids, excluirPedido]
  )).rows;
};

const crearOrdenProduccion = async (c, idPedido, items, observacion) => {
  const numeroOrden = `PED-${String(idPedido).padStart(4, '0')}`;
  const productos = items.map((item) => {
    const detalle = item.detalle || {};
    const extras = [
      ...(detalle.salsas || []),
      ...(detalle.adiciones || []).map((adicion) =>
        `${adicion.cantidad > 1 ? `${adicion.cantidad} x ` : ''}${adicion.nombre}`
      ),
    ];
    return `${item.cantidad} x ${item.producto}${extras.length ? ` (${extras.join(', ')})` : ''}`;
  }).join('\n');
  const cantidad = items.reduce((total, item) => total + item.cantidad, 0);
  const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const hora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
  // Las líneas como las arma el panel: cada producto y, debajo, sus adiciones (para descontar insumos en cocina)
  const lineas = items.flatMap((item, i) => {
    const id = `${numeroOrden}-line-${i}`;
    const salsas = item.detalle?.salsas || [];
    return [
      { id, name: item.producto, quantity: item.cantidad, category: item.categoria || '', ...(salsas.length ? { sauces: salsas } : {}) },
      ...(item.detalle?.adiciones || []).map((a, j) => ({
        id: `${id}-addition-${j}`, name: a.nombre, quantity: a.cantidad * item.cantidad, category: 'Adiciones', parentId: id,
      })),
    ];
  });
  // Fila completa del panel; [15] = el pedido: así el panel la reconoce y no crea otra orden para él
  const fila = [numeroOrden, productos, cantidad, 0, fecha, hora, fecha, hora, 'Recibido', '', 0, 'Sí',
    JSON.stringify([{ status: 'Recibido', date: fecha, time: hora }]), JSON.stringify(lineas), 'No', numeroOrden, observacion || ''];

  await c.query(
    `INSERT INTO ordenes_produccion
       (fecha_inicio, tipo_orden_produccion, numero_orden, productos, cantidad, prioridad, estado, datos_panel)
     VALUES ($1, 'PEDIDO CLIENTE', $2, $3, $4, $5, $6, $7)`,
    [fecha, numeroOrden, productos, cantidad, 0, 'Recibido', JSON.stringify(fila)]
  );
  await c.query(
    `UPDATE pedidos SET estado_produccion = $2 WHERE id_pedido = $1`,
    [idPedido, 'Recibido']
  );
};

const solicitarDevolucion = (c, id, motivo) =>
  c.query(
    `UPDATE pedidos SET devolucion = jsonb_build_object('motivo', $2::text, 'solicitada_en', now())
      WHERE id_pedido = $1 AND devolucion IS NULL`,
    [id, motivo]
  );

const registrarEstado = (c, idPedido, estado, idUsuario) =>
  c.query('INSERT INTO historial_estados_pedido (id_pedido, estado, id_usuario) VALUES ($1, $2, $3)',
    [idPedido, estado, idUsuario]);

const { PAGO_PENDIENTE_ENTREGA, estadoProduccion: normalizarEstadoProduccion } = require('../utils/reglasPanel');
const AppError = require('../errors/AppError');

const FLUJO_PEDIDO = ['Por confirmar', 'Recibido', 'Confirmado', 'En cocina', 'En camino', 'Entregado'];
// La orden de producción y su pedido tienen los mismos estados: el pedido pasa al de la orden (solo hacia adelante;
// uno cancelado o entregado ya no se mueve). Un pedido del panel se busca por su código (puede no ser su id) y su fila
// del panel (datos_panel[7]) también cambia. Devuelve también el estado anterior y el código.
const actualizarEstadoProduccion = async (c, idPedido, estadoProduccion, idUsuario, codigo = null) => {
  const anterior = (await c.query(
    `SELECT id_pedido, estado, estado_pago, estado_produccion FROM pedidos
      WHERE codigo = $2 OR (id_pedido = $1 AND codigo IS NULL)
      ORDER BY (codigo = $2) DESC NULLS LAST LIMIT 1 FOR UPDATE`,
    [idPedido, codigo]
  )).rows[0];
  if (!anterior) return null;
  if (normalizarEstadoProduccion(estadoProduccion) === 'Entregado' &&
      normalizarEstadoProduccion(anterior.estado_produccion) !== 'Entregado' &&
      anterior.estado_pago !== 'Pagado') throw AppError.conflict(PAGO_PENDIENTE_ENTREGA);
  const id = anterior.id_pedido;

  const adelante = FLUJO_PEDIDO.indexOf(estadoProduccion) > FLUJO_PEDIDO.indexOf(anterior.estado || 'Recibido');
  const estadoPedido = FLUJO_PEDIDO.includes(estadoProduccion) && adelante && !['Cancelado', 'Entregado'].includes(anterior.estado)
    ? estadoProduccion
    : null;
  const actualizado = (await c.query(
    `UPDATE pedidos
        SET estado_produccion = $2,
            estado = COALESCE($3::text, estado),
            datos_panel = CASE WHEN datos_panel IS NULL OR $3::text IS NULL THEN datos_panel
                               ELSE jsonb_set(datos_panel, '{7}', to_jsonb($3::text)) END
      WHERE id_pedido = $1
        AND (estado_produccion IS DISTINCT FROM $2 OR ($3::text IS NOT NULL AND estado IS DISTINCT FROM $3::text))
      RETURNING id_pedido, id_cliente, estado, estado_produccion, codigo`,
    [id, estadoProduccion, estadoPedido]
  )).rows[0] || null;

  if (actualizado && estadoPedido && estadoPedido !== anterior.estado) {
    await registrarEstado(c, id, estadoPedido, idUsuario);
  }

  return actualizado && { ...actualizado, estado_anterior: anterior.estado };
};

// Solo cambia los campos enviados
const CAMPOS = ['estado', 'estado_pago', 'motivo_rechazo_pago', 'produccion_autorizada', 'registros_produccion', 'comprobante',
  'subtotal', 'total', 'abono'];
const actualizar = (c, id, d) => {
  const campos = CAMPOS.filter((k) => d[k] !== undefined);
  if (!campos.length) return null;
  return c.query(
    `UPDATE pedidos SET ${campos.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id_pedido = $1`,
    [id, ...campos.map((k) => (k === 'registros_produccion' ? JSON.stringify(d[k]) : d[k]))]
  );
};

const colaCocina = async (c) =>
  (await (c || { query }).query(
    `SELECT p.id_pedido, p.estado, p.creado_en, COALESCE(productos.unidades, 0)::float AS unidades,
            CASE WHEN p.estado = 'En cocina' THEN (
              SELECT max(h.fecha)
                FROM historial_estados_pedido h
               WHERE h.id_pedido = p.id_pedido
                 AND h.estado = 'En cocina'
                 AND h.fecha <= now()
            ) ELSE NULL END AS inicio_cocina
       FROM pedidos p
       LEFT JOIN LATERAL (
         SELECT SUM(d.cantidad) AS unidades
           FROM pedido_detalle d
          WHERE d.id_pedido = p.id_pedido
       ) productos ON TRUE
      WHERE (
          p.estado = ANY($1::text[])
          OR (p.estado = 'Por confirmar' AND p.produccion_autorizada = TRUE)
        )
        AND p.creado_en <= now()
      ORDER BY p.creado_en ASC, p.id_pedido ASC`,
    [['Recibido', 'Confirmado', 'En cocina']]
  )).rows;

const estadisticasDesplazamiento = async (idBarrio, c) =>
  (await (c || { query }).query(
    `WITH marcas AS (
       SELECT p.id_pedido,
              min(h.fecha) FILTER (WHERE h.estado = 'En camino') AS salida,
              min(h.fecha) FILTER (WHERE h.estado = 'Entregado') AS entrega
         FROM pedidos p
         JOIN historial_estados_pedido h ON h.id_pedido = p.id_pedido
        WHERE p.id_barrio = $1
          AND p.estado = 'Entregado'
          AND p.creado_en >= now() - ($2::int * interval '1 day')
          AND p.creado_en <= now()
        GROUP BY p.id_pedido
     ), duraciones AS (
       SELECT extract(epoch FROM (entrega - salida)) / 60.0 AS minutos
         FROM marcas
        WHERE salida IS NOT NULL
          AND entrega IS NOT NULL
          AND entrega > salida
          AND entrega <= now()
     )
     SELECT count(*)::int AS observaciones,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY minutos) AS p25,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY minutos) AS mediana,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY minutos) AS p75
       FROM duraciones`,
    [idBarrio, ESTIMADOR.HISTORIAL_DIAS]
  )).rows[0];

// Un comprobante más ({ imagen, referencia, valor, hash }): queda en la lista y como el último (el que revisa el panel)
// Lo que se necesita para entregarlo (también un pedido del panel, que no tiene cliente de la tienda)
const paraEntrega = async (c, id) =>
  (await c.query(
    `SELECT id_pedido, id_cliente, codigo, estado, estado_pago, total::float AS total, abono::float AS abono,
            tipo_entrega, metodo_pago, pago_mixto, datos_panel
       FROM pedidos WHERE id_pedido = $1 FOR UPDATE`,
    [id]
  )).rows[0] || null;

// Entregado y pagado (y, si es del panel, también su fila)
const marcarEntregado = (c, id) =>
  c.query(
    `UPDATE pedidos SET estado = 'Entregado', estado_pago = 'Pagado', estado_produccion = 'Entregado',
            datos_panel = CASE WHEN datos_panel IS NULL THEN NULL
                               ELSE jsonb_set(jsonb_set(datos_panel, '{7}', '"Entregado"'), '{8}', '"Pagado"') END
      WHERE id_pedido = $1`,
    [id]
  );

// Su orden de producción (ya «En camino») pasa a «Entregado» con él
const entregarOrdenProduccion = (c, codigo) =>
  c.query(
    `UPDATE ordenes_produccion SET estado = 'Entregado', datos_panel = jsonb_set(datos_panel, '{8}', '"Entregado"')
      WHERE datos_panel->>15 = $1 AND estado = 'En camino'`,
    [codigo]
  );

const agregarComprobante = async (c, id, s) =>
  (await c.query(
    `UPDATE pedidos
        SET comprobante = $2,
            comprobantes = (CASE WHEN jsonb_array_length(comprobantes) = 0 AND comprobante IS NOT NULL
                                 THEN jsonb_build_array(comprobante) ELSE comprobantes END)
                           || jsonb_build_array(jsonb_build_object('imagen', $2::text, 'referencia', $3::text, 'valor', $4::numeric,
                                                                   'hash', $5::text, 'dudoso', $6::boolean, 'subido_en', now()))
      WHERE id_pedido = $1 RETURNING jsonb_array_length(comprobantes) AS n`,
    [id, s.imagen, s.referencia, s.valor, s.hash, !!s.dudoso]
  )).rows[0]?.n ?? 0;

// Quita el comprobante en la posición `indice`; el último que quede pasa a ser «el comprobante»
const quitarComprobante = async (c, id, indice) =>
  (await c.query(
    `WITH lista AS (
       SELECT COALESCE(jsonb_agg(e ORDER BY i), '[]'::jsonb) AS v
         FROM pedidos p, jsonb_array_elements(p.comprobantes) WITH ORDINALITY AS t(e, i)
        WHERE p.id_pedido = $1 AND i - 1 <> $2)
     UPDATE pedidos SET comprobantes = lista.v,
            comprobante = CASE WHEN jsonb_array_length(lista.v) = 0 THEN NULL
                               ELSE COALESCE(lista.v -> -1 ->> 'imagen', lista.v ->> -1) END
       FROM lista WHERE id_pedido = $1 RETURNING jsonb_array_length(lista.v) AS n`,
    [id, indice]
  )).rows[0]?.n ?? 0;

// Huella y referencia de los comprobantes de los demás pedidos (los viejos, solo imagen: su huella se calcula aquí)
const soportesDeOtros = async (c, idPedido) =>
  (await c.query(
    `SELECT p.id_pedido,
            CASE WHEN jsonb_typeof(e) = 'string' THEN encode(sha256(convert_to(e #>> '{}', 'UTF8')), 'hex') ELSE e ->> 'hash' END AS hash,
            CASE WHEN jsonb_typeof(e) = 'object' THEN e ->> 'referencia' END AS referencia
       FROM pedidos p, jsonb_array_elements(p.comprobantes) e
      WHERE p.id_pedido <> $1`,
    [idPedido]
  )).rows;

module.exports = {
  agregarComprobante, quitarComprobante, soportesDeOtros,
  listar, listarDeCliente, obtenerPorId, catalogoActivo, crear, crearDetalle, paraEntrega, marcarEntregado, entregarOrdenProduccion, reemplazarDetalle, insumosParaPreparar, crearOrdenProduccion, registrarEstado, solicitarDevolucion,
  actualizarEstadoProduccion, actualizar, colaCocina, estadisticasDesplazamiento,
};
