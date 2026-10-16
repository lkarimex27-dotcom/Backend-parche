const { query } = require('../config/db');

const exec = (c) => c || { query };

// Un cliente es una persona tipo CLIENTE: con cuenta (se registró en la app) o sin ella (creada en el panel).
// Si tiene cuenta, el correo es el de la cuenta.
const SELECT = `
  SELECT p.id_persona, p.id_usuario, p.nombre, p.tipo_documento, p.documento, p.telefono, p.direccion,
         p.de_local, p.estado, COALESCE(u.correo, p.correo) AS correo
    FROM personas p
    LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
   WHERE p.tipo = 'CLIENTE'`;

const listar = async () => (await query(`${SELECT} ORDER BY p.id_persona`)).rows;

const obtenerPorId = async (id) => (await query(`${SELECT} AND p.id_persona = $1`, [id])).rows[0] || null;

// idUsuario: la cuenta con la que entra a la app (null = cliente sin cuenta)
const crear = async (c, d, idUsuario = null) =>
  (await exec(c).query(
    `INSERT INTO personas (nombre, tipo, tipo_documento, documento, telefono, correo, direccion, de_local, estado, id_usuario)
     VALUES ($1, 'CLIENTE', $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, 'ACTIVO'), $9) RETURNING id_persona`,
    [d.nombre, d.tipo_documento ?? null, d.documento ?? null, d.telefono ?? null, d.correo ?? null,
     d.direccion ?? null, d.de_local ?? null, d.estado ?? null, idUsuario]
  )).rows[0];

const actualizar = async (c, id, d) =>
  (await exec(c).query(
    `UPDATE personas SET
        nombre = COALESCE($2, nombre), tipo_documento = COALESCE($3, tipo_documento),
        documento = COALESCE($4, documento), telefono = COALESCE($5, telefono),
        correo = COALESCE($6, correo), direccion = COALESCE($7, direccion),
        de_local = COALESCE($8, de_local), estado = COALESCE($9, estado)
      WHERE id_persona = $1 AND tipo = 'CLIENTE' RETURNING id_persona, id_usuario`,
    [id, d.nombre, d.tipo_documento, d.documento, d.telefono, d.correo, d.direccion, d.de_local, d.estado]
  )).rows[0] || null;

// Si el cliente tiene cuenta, su correo de acceso también cambia
const actualizarCorreoCuenta = (c, idUsuario, correo) =>
  c.query('UPDATE usuarios SET correo = $2 WHERE id_usuario = $1', [idUsuario, correo]);

// Solo clientes sin cuenta: los que tienen cuenta se desactivan (su historial depende del usuario)
const eliminarSinCuenta = async (id) =>
  (await query("DELETE FROM personas WHERE id_persona = $1 AND tipo = 'CLIENTE' AND id_usuario IS NULL", [id])).rowCount > 0;

module.exports = { listar, obtenerPorId, crear, actualizar, actualizarCorreoCuenta, eliminarSinCuenta };
