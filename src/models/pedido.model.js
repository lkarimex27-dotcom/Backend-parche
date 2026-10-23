const { query } = require('../config/db');
const { ESTIMADOR } = require('../config/constants');

const SELECT = `
  SELECT p.id_pedido, p.id_cliente, u.correo, COALESCE(pe.nombre, p.nombre_contacto) AS cliente,
         p.nombre_contacto, p.telefono_contacto, p.direccion_entrega, p.observacion, p.metodo_pago,
         p.estado, p.estado_pago, p.motivo_rechazo_pago, p.comprobante, p.produccion_autorizada,
         p.registros_produccion, p.id_barrio, p.estimacion_inicial,
         p.total::float AS total, p.creado_en,
         COALESCE((SELECT json_agg(json_build_object(
                     'producto', i.nombre, 'cantidad', d.cantidad::float, 'precio_unitario', d.precio_unitario::float,
                     'detalle', d.observacion::json) ORDER BY d.id_pedido_detalle)
                     FROM pedido_detalle d JOIN insumos_productos i ON i.id_insumo_producto = d.id_insumo_producto
                    WHERE d.id_pedido = p.id_pedido), '[]'::json) AS items
    FROM pedidos p
    JOIN usuarios u ON u.id_usuario = p.id_cliente
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
    `INSERT INTO pedidos (id_cliente, estado, nombre_contacto, telefono_contacto, direccion_entrega, observacion,
                          metodo_pago, estado_pago, comprobante, subtotal, total, id_barrio, estimacion_inicial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12) RETURNING id_pedido`,
    [d.id_cliente, d.estado, d.nombre, d.telefono, d.direccion, d.notas ?? null, d.pago, d.estado_pago,
     d.comprobante ?? null, d.total, d.id_barrio, JSON.stringify(d.estimacion_inicial)]
  )).rows[0].id_pedido;

const crearDetalle = (c, idPedido, it) =>
  c.query(
    `INSERT INTO pedido_detalle (id_pedido, id_insumo_producto, cantidad, precio_unitario, subtotal, observacion)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [idPedido, it.id_insumo_producto, it.cantidad, it.precio_unitario, it.subtotal, JSON.stringify(it.detalle)]
  );

const registrarEstado = (c, idPedido, estado, idUsuario) =>
  c.query('INSERT INTO historial_estados_pedido (id_pedido, estado, id_usuario) VALUES ($1, $2, $3)',
    [idPedido, estado, idUsuario]);

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

const cargaCocina = async (c) =>
  (await (c || { query }).query(
    `SELECT count(*)::int AS pedidos_activos
       FROM pedidos
      WHERE estado = ANY($1::text[])
        AND creado_en <= now()`,
    [['Recibido', 'Confirmado', 'En cocina']]
  )).rows[0].pedidos_activos;

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
  listar, listarDeCliente, obtenerPorId, catalogoActivo, crear, crearDetalle, registrarEstado,
  actualizar, cargaCocina, estadisticasDesplazamiento,
};
