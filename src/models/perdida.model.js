const { query } = require('../config/db');

const SELECT = `
  SELECT pe.id_perdida, pe.id_insumo_producto, i.nombre AS insumo, i.medida, pe.cantidad::float AS cantidad,
         pe.motivo, pe.responsable, pe.observacion, to_char(pe.fecha, 'YYYY-MM-DD') AS fecha, pe.id_usuario,
         pe.estado, pe.motivo_devolucion, pe.cantidad_devuelta::float AS cantidad_devuelta
    FROM perdidas_insumos pe
    JOIN insumos_productos i ON i.id_insumo_producto = pe.id_insumo_producto`;

const listar = async () => (await query(`${SELECT} ORDER BY pe.fecha DESC, pe.id_perdida DESC`)).rows;

const obtenerPorId = async (id, c) =>
  (await (c || { query }).query(`${SELECT} WHERE pe.id_perdida = $1`, [id])).rows[0] || null;

const crear = async (c, d) =>
  (await c.query(
    `INSERT INTO perdidas_insumos (id_insumo_producto, id_usuario, fecha, cantidad, motivo, responsable, observacion)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7) RETURNING id_perdida`,
    [d.id_insumo_producto, d.id_usuario, d.fecha ?? null, d.cantidad, d.motivo ?? null, d.responsable ?? null,
     d.observacion ?? null]
  )).rows[0].id_perdida;

const actualizar = (c, id, d) =>
  c.query(
    `UPDATE perdidas_insumos SET id_insumo_producto = $2, fecha = COALESCE($3::date, fecha), cantidad = $4,
            motivo = $5, responsable = $6, observacion = $7
      WHERE id_perdida = $1`,
    [id, d.id_insumo_producto, d.fecha ?? null, d.cantidad, d.motivo ?? null, d.responsable ?? null, d.observacion ?? null]
  );

// total = se devolvió todo (queda DEVUELTA con su cantidad original); si no, la pérdida baja en lo devuelto.
// Cada devolución agrega una línea "cantidad: motivo" al historial
const devolver = (c, id, { cantidad, total, nota }) =>
  c.query(
    `UPDATE perdidas_insumos
        SET estado = CASE WHEN $3 THEN 'DEVUELTA' ELSE estado END,
            cantidad = CASE WHEN $3 THEN cantidad ELSE cantidad - $2 END,
            cantidad_devuelta = cantidad_devuelta + $2,
            motivo_devolucion = concat_ws(E'\n', NULLIF(motivo_devolucion, ''), $4::text)
      WHERE id_perdida = $1`,
    [id, cantidad, total, nota]
  );

module.exports = { listar, obtenerPorId, crear, actualizar, devolver };
