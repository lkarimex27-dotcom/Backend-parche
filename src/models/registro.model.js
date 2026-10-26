const { query } = require('../config/db');

const guardar = (registro, codigoHash, contrasenaHash, minutos) =>
  query(
    `INSERT INTO codigos_registro
       (correo, codigo_hash, contrasena_hash, nombre, tipo_documento, documento, telefono, expira)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8))
     ON CONFLICT (correo) DO UPDATE
       SET codigo_hash = EXCLUDED.codigo_hash,
           contrasena_hash = EXCLUDED.contrasena_hash,
           nombre = EXCLUDED.nombre,
           tipo_documento = EXCLUDED.tipo_documento,
           documento = EXCLUDED.documento,
           telefono = EXCLUDED.telefono,
           expira = EXCLUDED.expira,
           intentos = 0,
           creado_en = now()`,
    [
      registro.correo,
      codigoHash,
      contrasenaHash,
      registro.nombre,
      registro.tipo_documento ?? null,
      registro.documento ?? null,
      registro.telefono ?? null,
      minutos,
    ]
  );

const obtener = async (correo) =>
  (await query(
    `SELECT correo, codigo_hash, contrasena_hash, nombre, tipo_documento, documento, telefono,
            intentos, expira > now() AS vigente, creado_en > now() - interval '1 minute' AS reciente
       FROM codigos_registro WHERE correo = $1`,
    [correo]
  )).rows[0] || null;

const sumarIntento = (correo) =>
  query('UPDATE codigos_registro SET intentos = intentos + 1 WHERE correo = $1', [correo]);

const consumir = async (correo, codigoHash) =>
  (await query(
    `DELETE FROM codigos_registro
      WHERE correo = $1 AND codigo_hash = $2 AND expira > now() AND intentos < 5
      RETURNING correo, contrasena_hash, nombre, tipo_documento, documento, telefono`,
    [correo, codigoHash]
  )).rows[0] || null;

const borrar = (correo) => query('DELETE FROM codigos_registro WHERE correo = $1', [correo]);

module.exports = { guardar, obtener, sumarIntento, consumir, borrar };
