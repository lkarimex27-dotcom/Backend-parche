const { query } = require('../config/db');

const listar = async ({ estado } = {}) =>
  (await query(
    `SELECT * FROM proveedores ${estado ? 'WHERE estado = $1' : ''} ORDER BY nombre`,
    estado ? [estado] : []
  )).rows;

const obtenerPorId = async (id) =>
  (await query('SELECT * FROM proveedores WHERE id_proveedor = $1', [id])).rows[0] || null;

const crear = async (d) =>
  (await query(
    `INSERT INTO proveedores (nombre, correo, telefono, contacto, tipo, estado)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'ACTIVO')) RETURNING *`,
    [d.nombre, d.correo ?? null, d.telefono ?? null, d.contacto ?? null, d.tipo ?? null, d.estado ?? null]
  )).rows[0];

const actualizar = async (id, d) =>
  (await query(
    `UPDATE proveedores SET
        nombre   = COALESCE($2, nombre),   correo = COALESCE($3, correo),
        telefono = COALESCE($4, telefono), contacto = COALESCE($5, contacto),
        tipo     = COALESCE($6, tipo),     estado = COALESCE($7, estado)
      WHERE id_proveedor = $1 RETURNING *`,
    [id, d.nombre, d.correo, d.telefono, d.contacto, d.tipo, d.estado]
  )).rows[0] || null;

module.exports = { listar, obtenerPorId, crear, actualizar };
