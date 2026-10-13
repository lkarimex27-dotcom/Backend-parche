const { pool } = require('../config/db');

const listar = async () => (await pool.query('SELECT * FROM roles ORDER BY id_rol')).rows;

const obtenerPorId = async (id) =>
  (await pool.query('SELECT * FROM roles WHERE id_rol = $1', [id])).rows[0] || null;

const crear = async ({ nombre_rol, descripcion, estado }) =>
  (await pool.query(
    "INSERT INTO roles (nombre_rol, descripcion, estado) VALUES ($1, $2, COALESCE($3, 'ACTIVO')) RETURNING *",
    [nombre_rol, descripcion ?? null, estado ?? null]
  )).rows[0];

const actualizar = async (id, { nombre_rol, descripcion, estado }) =>
  (await pool.query(
    `UPDATE roles SET nombre_rol = $2, descripcion = COALESCE($3, descripcion), estado = COALESCE($4, estado)
      WHERE id_rol = $1 RETURNING *`,
    [id, nombre_rol, descripcion, estado]
  )).rows[0] || null;

const eliminar = async (id) =>
  (await pool.query('DELETE FROM roles WHERE id_rol = $1', [id])).rowCount > 0;

const listarModulos = async () => (await pool.query('SELECT * FROM modulos ORDER BY id_modulo')).rows;
const listarPrivilegios = async () => (await pool.query('SELECT * FROM privilegios ORDER BY id_privilegio')).rows;

const permisosDeRol = async (id) =>
  (await pool.query(
    `SELECT m.nombre_modulo AS modulo,
            array_agg(pr.nombre_privilegio ORDER BY pr.id_privilegio) AS privilegios
       FROM permisos p
       JOIN modulos m      ON m.id_modulo = p.id_modulo
       JOIN privilegios pr ON pr.id_privilegio = p.id_privilegio
      WHERE p.id_rol = $1
      GROUP BY m.nombre_modulo, m.id_modulo
      ORDER BY m.id_modulo`,
    [id]
  )).rows;

// Reemplaza TODOS los permisos del rol. `permisos` = [{ modulo, privilegios: [..] }]
// Devuelve false si algún módulo o privilegio no existe (el service revierte la transacción).
const reemplazarPermisos = async (c, idRol, permisos) => {
  await c.query('DELETE FROM permisos WHERE id_rol = $1', [idRol]);
  for (const { modulo, privilegios } of permisos) {
    const unicos = [...new Set(privilegios)];
    if (!unicos.length) continue;
    const r = await c.query(
      `INSERT INTO permisos (id_rol, id_modulo, id_privilegio)
       SELECT $1, m.id_modulo, pr.id_privilegio
         FROM modulos m CROSS JOIN privilegios pr
        WHERE m.nombre_modulo = $2 AND pr.nombre_privilegio = ANY($3::text[])
       ON CONFLICT DO NOTHING`,
      [idRol, modulo, unicos]
    );
    if (r.rowCount !== unicos.length) return false;
  }
  return true;
};

module.exports = {
  listar, obtenerPorId, crear, actualizar, eliminar,
  listarModulos, listarPrivilegios, permisosDeRol, reemplazarPermisos,
};
