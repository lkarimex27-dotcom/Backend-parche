const { pool } = require('../../config/db');

// Historial de cambios de un usuario: una fila por campo cambiado
const registrar = async (c, filas) => {
  for (const f of filas) {
    await c.query(
      `INSERT INTO auditoria_usuarios (id_usuario, campo, valor_anterior, valor_nuevo, cambiado_por)
       VALUES ($1, $2, $3, $4, $5)`,
      [f.id_usuario, f.campo, f.valor_anterior, f.valor_nuevo, f.cambiado_por]
    );
  }
};

const listarDeUsuario = async (id) =>
  (await pool.query(
    `SELECT a.id_auditoria, a.campo, a.valor_anterior, a.valor_nuevo, a.fecha,
            a.cambiado_por, COALESCE(pe.nombre, u.correo) AS cambiado_por_nombre
       FROM auditoria_usuarios a
       LEFT JOIN usuarios u  ON u.id_usuario = a.cambiado_por
       LEFT JOIN personas pe ON pe.id_usuario = a.cambiado_por
      WHERE a.id_usuario = $1
      ORDER BY a.fecha DESC, a.id_auditoria DESC`,
    [id]
  )).rows;

module.exports = { registrar, listarDeUsuario };
