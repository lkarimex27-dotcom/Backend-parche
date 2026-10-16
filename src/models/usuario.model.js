const { pool } = require('../config/db');

const exec = (c) => c || pool; // permite usar un client de transacción

const SELECT = `
  SELECT u.id_usuario, u.correo, u.estado, u.debe_cambiar_contrasena,
         pe.id_persona, pe.nombre, pe.tipo_documento, pe.documento, pe.tipo AS tipo_persona,
         pe.telefono, pe.direcciones,
         COALESCE((SELECT array_agg(r.nombre_rol ORDER BY r.nombre_rol)
                     FROM roles_usuario ru JOIN roles r ON r.id_rol = ru.id_rol
                    WHERE ru.id_usuario = u.id_usuario), '{}') AS roles
    FROM usuarios u
    LEFT JOIN personas pe ON pe.id_usuario = u.id_usuario`;

const listar = async ({ rol, estado } = {}) => {
  const where = [];
  const params = [];
  if (rol) {
    params.push(rol);
    where.push(`EXISTS (SELECT 1 FROM roles_usuario ru JOIN roles r ON r.id_rol = ru.id_rol
                         WHERE ru.id_usuario = u.id_usuario AND r.nombre_rol = $${params.length})`);
  }
  if (estado) { params.push(estado); where.push(`u.estado = $${params.length}`); }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.id_usuario`;
  return (await pool.query(sql, params)).rows;
};

const obtenerPorId = async (id, c) =>
  (await exec(c).query(`${SELECT} WHERE u.id_usuario = $1`, [id])).rows[0] || null;

// Incluye el hash de la contraseña: SOLO para el login. Nunca devolver al cliente.
const obtenerParaLogin = async (correo) =>
  (await pool.query(
    `SELECT id_usuario, correo, contrasena, estado FROM usuarios WHERE lower(correo) = lower($1)`,
    [correo]
  )).rows[0] || null;

const crearUsuario = async (c, { correo, hash, estado, debeCambiar = false }) =>
  (await exec(c).query(
    `INSERT INTO usuarios (correo, contrasena, estado, debe_cambiar_contrasena) VALUES ($1, $2, COALESCE($3, 'ACTIVO'), $4)
     RETURNING id_usuario`,
    [correo, hash, estado ?? null, debeCambiar]
  )).rows[0];

const crearPersona = async (c, { id_usuario, nombre, tipo_documento, documento, tipo }) =>
  (await exec(c).query(
    `INSERT INTO personas (id_usuario, nombre, tipo_documento, documento, tipo)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_persona`,
    [id_usuario, nombre, tipo_documento ?? null, documento ?? null, tipo ?? null]
  )).rows[0];

const actualizarUsuario = async (c, id, { correo, hash, estado }) =>
  exec(c).query(
    `UPDATE usuarios SET correo = COALESCE($2, correo), contrasena = COALESCE($3, contrasena),
                         estado = COALESCE($4, estado)
      WHERE id_usuario = $1`,
    [id, correo ?? null, hash ?? null, estado ?? null]
  );

const actualizarPersona = async (c, id, { nombre, tipo_documento, documento, tipo }) =>
  exec(c).query(
    `UPDATE personas SET nombre = COALESCE($2, nombre), tipo_documento = COALESCE($3, tipo_documento),
                         documento = COALESCE($4, documento), tipo = COALESCE($5, tipo)
      WHERE id_usuario = $1`,
    [id, nombre ?? null, tipo_documento ?? null, documento ?? null, tipo ?? null]
  );

// Reemplaza los roles del usuario por los indicados (por nombre). Devuelve false si algún rol no existe.
const reemplazarRoles = async (c, idUsuario, nombres) => {
  const unicos = [...new Set(nombres)];
  await c.query('DELETE FROM roles_usuario WHERE id_usuario = $1', [idUsuario]);
  if (!unicos.length) return true;
  const r = await c.query(
    `INSERT INTO roles_usuario (id_usuario, id_rol)
     SELECT $1, id_rol FROM roles WHERE nombre_rol = ANY($2::text[])`,
    [idUsuario, unicos]
  );
  return r.rowCount === unicos.length;
};

// Datos que el usuario edita en su perfil (solo los enviados)
const actualizarPerfil = async (id, d) => {
  const campos = ['nombre', 'tipo_documento', 'documento', 'telefono'].filter((k) => d[k] !== undefined);
  const valores = campos.map((k) => d[k]);
  if (d.direcciones !== undefined) {
    campos.push('direcciones', 'direccion');
    valores.push(JSON.stringify(d.direcciones), d.direcciones[0] ?? null);
  }
  if (!campos.length) return;
  await pool.query(
    `UPDATE personas SET ${campos.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id_usuario = $1`,
    [id, ...valores]
  );
};

// Una contraseña elegida por el usuario reemplaza la provisional
const cambiarContrasena = (id, hash) =>
  pool.query('UPDATE usuarios SET contrasena = $2, debe_cambiar_contrasena = false WHERE id_usuario = $1', [id, hash]);
const obtenerHash = async (id) =>
  (await pool.query('SELECT contrasena FROM usuarios WHERE id_usuario = $1', [id])).rows[0]?.contrasena ?? null;

module.exports = {
  actualizarPerfil, cambiarContrasena, obtenerHash,
  listar, obtenerPorId, obtenerParaLogin, crearUsuario, crearPersona,
  actualizarUsuario, actualizarPersona, reemplazarRoles,
};
