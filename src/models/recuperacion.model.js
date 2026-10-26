const { query } = require('../config/db');

// Un código vigente por usuario: pedir otro reemplaza el anterior
const guardar = (idUsuario, codigoHash, minutos) =>
  query(
    `INSERT INTO recuperaciones_contrasena (id_usuario, codigo_hash, expira)
     VALUES ($1, $2, now() + make_interval(mins => $3))
     ON CONFLICT (id_usuario) DO UPDATE
       SET codigo_hash = EXCLUDED.codigo_hash,
           expira = EXCLUDED.expira,
           intentos = 0,
           creado_en = now(),
           verificacion_hash = NULL,
           verificacion_expira = NULL`,
    [idUsuario, codigoHash, minutos]
  );

const obtener = async (idUsuario) =>
  (await query(
    `SELECT codigo_hash, intentos, expira > now() AS vigente,
            creado_en > now() - interval '1 minute' AS reciente,
            verificacion_hash, verificacion_expira > now() AS verificacion_vigente
       FROM recuperaciones_contrasena WHERE id_usuario = $1`,
    [idUsuario]
  )).rows[0] || null;

const sumarIntento = (idUsuario) =>
  query('UPDATE recuperaciones_contrasena SET intentos = intentos + 1 WHERE id_usuario = $1', [idUsuario]);

const marcarVerificado = (idUsuario, tokenHash, minutos) =>
  query(
    `UPDATE recuperaciones_contrasena
        SET verificacion_hash = $2,
            verificacion_expira = now() + make_interval(mins => $3)
      WHERE id_usuario = $1`,
    [idUsuario, tokenHash, minutos]
  );

const borrar = (idUsuario) => query('DELETE FROM recuperaciones_contrasena WHERE id_usuario = $1', [idUsuario]);

module.exports = { guardar, obtener, sumarIntento, marcarVerificado, borrar };
