const { query } = require('../config/db');

// `tipo` = 'INSUMO' | 'PRODUCTO'. Cada pantalla del panel solo ve el suyo.
const listar = async (tipo) =>
  (await query('SELECT * FROM categorias WHERE tipo = $1 ORDER BY nombre_categoria', [tipo])).rows;

const obtenerPorId = async (tipo, id) =>
  (await query('SELECT * FROM categorias WHERE id_categoria = $1 AND tipo = $2', [id, tipo])).rows[0] || null;

const crear = async (tipo, { nombre_categoria }) =>
  (await query('INSERT INTO categorias (nombre_categoria, tipo) VALUES ($1, $2) RETURNING *', [nombre_categoria, tipo]))
    .rows[0];

const actualizar = async (tipo, id, { nombre_categoria }) =>
  (await query(
    'UPDATE categorias SET nombre_categoria = $3 WHERE id_categoria = $1 AND tipo = $2 RETURNING *',
    [id, tipo, nombre_categoria]
  )).rows[0] || null;

const eliminar = async (tipo, id) =>
  (await query('DELETE FROM categorias WHERE id_categoria = $1 AND tipo = $2', [id, tipo])).rowCount > 0;

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
