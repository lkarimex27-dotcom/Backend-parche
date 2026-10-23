// Carga el catálogo base (roles, privilegios, módulos, permisos) y el primer administrador.
// Es idempotente: se puede correr las veces que quieras.   npm run db:seed
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { pool, withTransaction } = require('../config/db');
const { ROLES, PRIVILEGIOS, MODULOS, PERMISOS_INICIALES } = require('../config/constants');

const insertarNombres = (c, tabla, columna, nombres) =>
  c.query(
    `INSERT INTO ${tabla} (${columna}) SELECT unnest($1::text[]) ON CONFLICT (${columna}) DO NOTHING`,
    [nombres]
  );

const darPermisos = (c, rol, modulo, privilegios) =>
  c.query(
    `INSERT INTO permisos (id_rol, id_modulo, id_privilegio)
     SELECT r.id_rol, m.id_modulo, pr.id_privilegio
       FROM roles r, modulos m, privilegios pr
      WHERE r.nombre_rol = $1 AND m.nombre_modulo = $2 AND pr.nombre_privilegio = ANY($3::text[])
     ON CONFLICT DO NOTHING`,
    [rol, modulo, privilegios]
  );

(async () => {
  try {
    await withTransaction(async (c) => {
      await insertarNombres(c, 'roles', 'nombre_rol', ROLES);
      await insertarNombres(c, 'privilegios', 'nombre_privilegio', PRIVILEGIOS);
      await insertarNombres(c, 'modulos', 'nombre_modulo', MODULOS);

      for (const modulo of MODULOS) await darPermisos(c, 'ADMINISTRADOR', modulo, PRIVILEGIOS);
      for (const [rol, mods] of Object.entries(PERMISOS_INICIALES)) {
        for (const [modulo, privs] of Object.entries(mods)) await darPermisos(c, rol, modulo, privs);
      }

      if (env.adminEmail && env.adminPassword) {
        if (env.adminPassword.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');
        const existe = await c.query('SELECT id_usuario FROM usuarios WHERE lower(correo) = lower($1)', [env.adminEmail]);
        if (existe.rowCount === 0) {
          const hash = await bcrypt.hash(env.adminPassword, 10);
          const u = await c.query(
            `INSERT INTO usuarios (correo, contrasena, requiere_cambio_contrasena, es_administrador_principal)
             VALUES ($1, $2, TRUE, lower($1) = $3) RETURNING id_usuario`,
            [env.adminEmail, hash, env.superAdminEmail]
          );
          const id = u.rows[0].id_usuario;
          await c.query('INSERT INTO personas (id_usuario, nombre, tipo) VALUES ($1, $2, $3)', [id, env.adminNombre, 'EMPLEADO']);
          await c.query(
            `INSERT INTO roles_usuario (id_usuario, id_rol) SELECT $1, id_rol FROM roles WHERE nombre_rol = 'ADMINISTRADOR'`,
            [id]
          );
          console.log(`Administrador creado: ${env.adminEmail}`);
        } else {
          console.log(`El administrador ${env.adminEmail} ya existía (no se modificó).`);
        }
      } else {
        console.log('ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó administrador.');
      }
    });
    console.log('Seed completado.');
  } catch (err) {
    console.error('Error en el seed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
