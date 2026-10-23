const { query } = require('../config/db');

// Fechas como texto (YYYY-MM-DD) para que no se corran por zona horaria
const SELECT = `
  SELECT co.id_compra, co.id_proveedor, pr.nombre AS proveedor,
         to_char(co.fecha, 'YYYY-MM-DD') AS fecha,
         to_char(co.fecha_registro AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha_registro,
         co.subtotal, co.iva, co.total, co.estado,
         COALESCE((SELECT json_agg(json_build_object(
                     'id_insumo_producto', d.id_insumo_producto, 'insumo', i.nombre, 'medida', d.medida,
                     'cantidad', d.cantidad::float, 'costo_unitario', d.costo_unitario::float, 'subtotal', d.subtotal::float)
                     ORDER BY d.id_detalle_compra)
                     FROM detalle_compras d JOIN insumos_productos i ON i.id_insumo_producto = d.id_insumo_producto
                    WHERE d.id_compra = co.id_compra), '[]'::json) AS detalles
    FROM compras co
    JOIN proveedores pr ON pr.id_proveedor = co.id_proveedor`;

const listar = async () => (await query(`${SELECT} ORDER BY co.fecha DESC, co.id_compra DESC`)).rows;

const obtenerPorId = async (id, c) =>
  (await (c || { query }).query(`${SELECT} WHERE co.id_compra = $1`, [id])).rows[0] || null;

const crear = async (c, d) =>
  (await c.query(
    `INSERT INTO compras (id_proveedor, fecha, subtotal, iva, total) VALUES ($1, $2, $3, $4, $5) RETURNING id_compra`,
    [d.id_proveedor, d.fecha, d.subtotal, d.iva, d.subtotal + d.iva]
  )).rows[0].id_compra;

const actualizar = (c, id, d) =>
  c.query(
    'UPDATE compras SET id_proveedor = $2, fecha = $3, subtotal = $4, iva = $5, total = $6 WHERE id_compra = $1',
    [id, d.id_proveedor, d.fecha, d.subtotal, d.iva, d.subtotal + d.iva]
  );

const cambiarEstado = (c, id, estado) => c.query('UPDATE compras SET estado = $2 WHERE id_compra = $1', [id, estado]);

const borrarDetalles = (c, id) => c.query('DELETE FROM detalle_compras WHERE id_compra = $1', [id]);

const crearDetalle = (c, idCompra, it) =>
  c.query(
    `INSERT INTO detalle_compras (id_compra, id_insumo_producto, medida, cantidad, costo_unitario, subtotal)
     SELECT $1, $2, medida, $3::numeric, $4::numeric, $3::numeric * $4::numeric FROM insumos_productos WHERE id_insumo_producto = $2`,
    [idCompra, it.id_insumo_producto, it.cantidad, it.costo_unitario]
  );

// Estados de las compras a ese proveedor en esa fecha (una pérdida guarda su compra como texto, no por id)
const estadosDe = async (c, proveedor, fecha) =>
  (await c.query(
    `SELECT co.estado FROM compras co JOIN proveedores pr ON pr.id_proveedor = co.id_proveedor
      WHERE lower(pr.nombre) = lower($1) AND co.fecha = $2::date`,
    [proveedor, fecha]
  )).rows.map((r) => r.estado);

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado, borrarDetalles, crearDetalle, estadosDe };
