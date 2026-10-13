const { query } = require('../config/db');

const tienePermiso = async (idUsuario, modulo, privilegio) => {
  const { rowCount } = await query(
    `SELECT 1
       FROM usuarios u
       JOIN roles_usuario ru ON ru.id_usuario = u.id_usuario
       JOIN roles r          ON r.id_rol = ru.id_rol AND r.estado = 'ACTIVO'  -- un rol inactivo no da permisos
       JOIN permisos p       ON p.id_rol = ru.id_rol
       JOIN modulos m        ON m.id_modulo = p.id_modulo
       JOIN privilegios pr   ON pr.id_privilegio = p.id_privilegio
      WHERE u.id_usuario = $1 AND u.estado = 'ACTIVO'
        AND m.nombre_modulo = $2 AND pr.nombre_privilegio = $3
      LIMIT 1`,
    [idUsuario, modulo, privilegio]
  );
  return rowCount > 0;
};

// [{ modulo: 'COMPRAS', privilegios: ['CREAR','VER'] }, ...] sumando todos los roles del usuario
const permisosDeUsuario = async (idUsuario) =>
  (await query(
    `SELECT m.nombre_modulo AS modulo,
            array_agg(DISTINCT pr.nombre_privilegio ORDER BY pr.nombre_privilegio) AS privilegios
       FROM roles_usuario ru
       JOIN roles r        ON r.id_rol = ru.id_rol AND r.estado = 'ACTIVO'
       JOIN permisos p     ON p.id_rol = ru.id_rol
       JOIN modulos m      ON m.id_modulo = p.id_modulo
       JOIN privilegios pr ON pr.id_privilegio = p.id_privilegio
      WHERE ru.id_usuario = $1
      GROUP BY m.nombre_modulo
      ORDER BY m.nombre_modulo`,
    [idUsuario]
  )).rows;

module.exports = { tienePermiso, permisosDeUsuario };
