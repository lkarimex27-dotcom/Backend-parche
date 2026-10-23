const { query } = require('../config/db');

// Un código vigente por usuario: pedir otro reemplaza el anterior
const guardar = (idUsuario, codigoHash, minutos) =>
  query(
    `INSERT INTO recuperaciones_contrasena (id_usuario, codigo_hash, expira)
     VALUES ($1, $2, now() + make_interval(mins => $3))
     ON CONFLICT (id_usuario) DO UPDATE
       SET codigo_hash = EXCLUDED.codigo_hash, expira = EXCLUDED.expira, intentos = 0, creado_en = now()`,
    [idUsuario, codigoHash, minutos]
  );

const obtener = async (idUsuario) =>
  (await query(
    `SELECT codigo_hash, intentos, expira > now() AS vigente, creado_en > now() - interval '1 minute' AS reciente
       FROM recuperaciones_contrasena WHERE id_usuario = $1`,
    [idUsuario]
  )).rows[0] || null;

const sumarIntento = (idUsuario) =>
  query('UPDATE recuperaciones_contrasena SET intentos = intentos + 1 WHERE id_usuario = $1', [idUsuario]);

const borrar = (idUsuario) => query('DELETE FROM recuperaciones_contrasena WHERE id_usuario = $1', [idUsuario]);

module.exports = { guardar, obtener, sumarIntento, borrar };
