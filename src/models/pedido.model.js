const { query } = require('../config/db');
const { ESTIMADOR } = require('../config/constants');

const SELECT = `
  SELECT p.id_pedido, p.id_cliente, u.correo, COALESCE(pe.nombre, p.nombre_contacto) AS cliente,
         p.nombre_contacto, p.telefono_contacto, p.tipo_entrega, p.direccion_entrega, p.observacion, p.metodo_pago,
         json_build_object(
           'nombre', COALESCE(p.nombre_contacto, pe.nombre),
           'telefono', p.telefono_contacto
         ) AS destinatario,
         p.estado, p.estado_produccion, p.estado_pago, p.motivo_rechazo_pago, p.comprobante, p.produccion_autorizada,
         p.registros_produccion, p.id_barrio, p.estimacion_inicial,
         p.subtotal::float AS subtotal, p.costo_domicilio_cop::float AS costo_domicilio_cop,
         p.total::float AS total, p.creado_en,
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

const obtenerPorId = async (id, c) =>
  (await (c || { query }).query(`${SELECT} WHERE p.id_pedido = $1`, [id])).rows[0] || null;

// Productos activos del menú (incluye adiciones, salsas y bebidas) para calcular precios en el servidor
const catalogoActivo = async () =>
  (await query(
    `SELECT i.id_insumo_producto, i.nombre, i.precio::float AS precio, c.nombre_categoria AS categoria
       FROM insumos_productos i JOIN categorias c ON c.id_categoria = i.id_categoria
      WHERE i.tipo = 'PRODUCTO' AND i.estado = 'ACTIVO'`
  )).rows;

const crear = async (c, d) =>
  (await c.query(
    `INSERT INTO pedidos (id_cliente, estado, nombre_contacto, telefono_contacto, tipo_entrega, direccion_entrega, observacion,
                          metodo_pago, estado_pago, comprobante, subtotal, costo_domicilio_cop, total,
                          id_barrio, estimacion_inicial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id_pedido`,
    [d.id_cliente, d.estado, d.nombre, d.telefono, d.tipo_entrega ?? 'domicilio', d.direccion, d.notas ?? null, d.pago, d.estado_pago,
     d.comprobante ?? null, d.subtotal, d.costo_domicilio_cop, d.total, d.id_barrio,
     JSON.stringify(d.estimacion_inicial)]
  )).rows[0].id_pedido;

const crearDetalle = (c, idPedido, it) =>
  c.query(
    `INSERT INTO pedido_detalle (id_pedido, id_insumo_producto, cantidad, precio_unitario, subtotal, observacion)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [idPedido, it.id_insumo_producto, it.cantidad, it.precio_unitario, it.subtotal, JSON.stringify(it.detalle)]
  );

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

const registrarEstado = (c, idPedido, estado, idUsuario) =>
  c.query('INSERT INTO historial_estados_pedido (id_pedido, estado, id_usuario) VALUES ($1, $2, $3)',
    [idPedido, estado, idUsuario]);

const actualizarEstadoProduccion = async (c, idPedido, estadoProduccion, idUsuario) => {
  const anterior = (await c.query(
    'SELECT estado FROM pedidos WHERE id_pedido = $1 FOR UPDATE',
    [idPedido]
  )).rows[0];
  if (!anterior) return null;

  // La orden de producción usa los mismos pasos que ve el cliente; «Producto no conforme» no mueve el pedido
  const estadoPedido = ['Confirmado', 'En cocina', 'En camino', 'Entregado'].includes(estadoProduccion)
    ? estadoProduccion
    : null;
  const actualizado = (await c.query(
    `UPDATE pedidos
        SET estado_produccion = $2,
            estado = COALESCE($3::text, estado)
      WHERE id_pedido = $1
        AND (estado_produccion IS DISTINCT FROM $2 OR ($3::text IS NOT NULL AND estado IS DISTINCT FROM $3::text))
      RETURNING id_pedido, id_cliente, estado, estado_produccion`,
    [idPedido, estadoProduccion, estadoPedido]
  )).rows[0] || null;

  if (actualizado && estadoPedido && estadoPedido !== anterior.estado) {
    await registrarEstado(c, idPedido, estadoPedido, idUsuario);
  }

  return actualizado;
};

// Solo cambia los campos enviados
const CAMPOS = ['estado', 'estado_pago', 'motivo_rechazo_pago', 'produccion_autorizada', 'registros_produccion', 'comprobante'];
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

module.exports = {
  listar, listarDeCliente, obtenerPorId, catalogoActivo, crear, crearDetalle, crearOrdenProduccion, registrarEstado,
  actualizarEstadoProduccion, actualizar, colaCocina, estadisticasDesplazamiento,
};
