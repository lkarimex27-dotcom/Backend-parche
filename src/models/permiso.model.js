const { query } = require('../config/db');

const tienePermiso = async (idUsuario, modulo, privilegio) => {
  const { rowCount } = await query(
    `SELECT 1
       FROM usuarios u
      WHERE u.id_usuario = $1 AND u.estado = 'ACTIVO'
        AND (
          u.es_administrador_principal = TRUE
          OR EXISTS (
            SELECT 1
              FROM roles_usuario ru
              JOIN roles r ON r.id_rol = ru.id_rol AND r.estado = 'ACTIVO'
             WHERE ru.id_usuario = u.id_usuario AND r.nombre_rol = 'ADMINISTRADOR'
          )
          OR EXISTS (
            SELECT 1
              FROM roles_usuario ru
              JOIN roles r          ON r.id_rol = ru.id_rol AND r.estado = 'ACTIVO'
              JOIN permisos p       ON p.id_rol = ru.id_rol
              JOIN modulos m        ON m.id_modulo = p.id_modulo
              JOIN privilegios pr   ON pr.id_privilegio = p.id_privilegio
             WHERE ru.id_usuario = u.id_usuario
               AND m.nombre_modulo = $2 AND pr.nombre_privilegio = $3
          )
        )
      LIMIT 1`,
    [idUsuario, modulo, privilegio]
  );
  return rowCount > 0;
};

// [{ modulo: 'COMPRAS', privilegios: ['CREAR','VER'] }, ...] sumando todos los roles del usuario
const permisosDeUsuario = async (idUsuario) =>
  (await query(
    `WITH permisos_efectivos AS (
       SELECT p.id_modulo, p.id_privilegio
         FROM roles_usuario ru
         JOIN roles r ON r.id_rol = ru.id_rol AND r.estado = 'ACTIVO'
         JOIN permisos p ON p.id_rol = ru.id_rol
        WHERE ru.id_usuario = $1
       UNION
       SELECT m.id_modulo, pr.id_privilegio
         FROM roles_usuario ru
         JOIN roles r ON r.id_rol = ru.id_rol AND r.estado = 'ACTIVO'
         CROSS JOIN modulos m
         CROSS JOIN privilegios pr
        WHERE ru.id_usuario = $1 AND r.nombre_rol = 'ADMINISTRADOR'
       UNION
       SELECT m.id_modulo, pr.id_privilegio
         FROM usuarios u
         CROSS JOIN modulos m
         CROSS JOIN privilegios pr
        WHERE u.id_usuario = $1 AND u.estado = 'ACTIVO' AND u.es_administrador_principal = TRUE
     )
     SELECT m.nombre_modulo AS modulo,
            array_agg(DISTINCT pr.nombre_privilegio ORDER BY pr.nombre_privilegio) AS privilegios
       FROM permisos_efectivos pe
       JOIN modulos m ON m.id_modulo = pe.id_modulo
       JOIN privilegios pr ON pr.id_privilegio = pe.id_privilegio
      GROUP BY m.nombre_modulo
      ORDER BY m.nombre_modulo`,
    [idUsuario]
  )).rows;

module.exports = { tienePermiso, permisosDeUsuario };
