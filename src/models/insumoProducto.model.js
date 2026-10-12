const { query } = require('../config/db');

const BASE = `
  SELECT ip.*, c.nombre_categoria,
         COALESCE(
           (SELECT json_agg(i.url ORDER BY i.id_imagen) FROM imagenes i WHERE i.id_producto = ip.id_insumo_producto),
           '[]'::json
         ) AS imagenes
    FROM insumos_productos ip
    JOIN categorias c ON c.id_categoria = ip.id_categoria`;

// `tipo` = 'INSUMO' | 'PRODUCTO' (la tabla es una sola; el módulo decide qué parte ve)
const listar = async (tipo, { id_categoria, bajoMinimo } = {}) => {
  const where = ['ip.tipo = $1'];
  const params = [tipo];
  if (id_categoria) { params.push(id_categoria); where.push(`ip.id_categoria = $${params.length}`); }
  if (bajoMinimo) where.push('ip.stock <= ip.minimo');
  return (await query(`${BASE} WHERE ${where.join(' AND ')} ORDER BY ip.id_insumo_producto`, params)).rows;
};

const obtenerPorId = async (tipo, id) =>
  (await query(`${BASE} WHERE ip.id_insumo_producto = $1 AND ip.tipo = $2`, [id, tipo])).rows[0] || null;

const crear = async (tipo, d) =>
  (await query(
    `INSERT INTO insumos_productos
       (nombre, tipo, medida, stock, minimo, maximo, id_categoria, costo, precio, tiene_ficha_tecnica)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_insumo_producto`,
    [d.nombre, tipo, d.medida ?? null, d.stock ?? 0, d.minimo ?? 0, d.maximo ?? null,
     d.id_categoria, d.costo ?? 0, d.precio ?? 0, d.tiene_ficha_tecnica ?? false]
  )).rows[0];

const actualizar = async (tipo, id, d) =>
  (await query(
    `UPDATE insumos_productos SET
        nombre              = COALESCE($3, nombre),
        medida              = COALESCE($4, medida),
        stock               = COALESCE($5, stock),
        minimo              = COALESCE($6, minimo),
        maximo              = COALESCE($7, maximo),
        id_categoria        = COALESCE($8, id_categoria),
        costo               = COALESCE($9, costo),
        precio              = COALESCE($10, precio),
        tiene_ficha_tecnica = COALESCE($11, tiene_ficha_tecnica)
      WHERE id_insumo_producto = $1 AND tipo = $2 RETURNING id_insumo_producto`,
    [id, tipo, d.nombre, d.medida, d.stock, d.minimo, d.maximo, d.id_categoria, d.costo, d.precio, d.tiene_ficha_tecnica]
  )).rows[0] || null;

const eliminar = async (tipo, id) =>
  (await query('DELETE FROM insumos_productos WHERE id_insumo_producto = $1 AND tipo = $2', [id, tipo])).rowCount > 0;

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
