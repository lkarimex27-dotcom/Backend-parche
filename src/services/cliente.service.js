const bcrypt = require('bcryptjs');
const Cliente = require('../models/cliente.model');
const Usuario = require('../models/usuario.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');
const { contrasenaProvisional, enviarProvisional } = require('../utils/provisional');

const listar = () => Cliente.listar();

const obtener = async (id) => {
  const c = await Cliente.obtenerPorId(id);
  if (!c) throw AppError.notFound('Cliente no encontrado');
  return c;
};

// Con correo: también se le crea la cuenta y le llega una contraseña provisional (la cambia al entrar).
// Sin correo (ej. cliente de local): solo queda registrado, sin cuenta.
const crear = async (d) => {
  if (!d.correo) return obtener((await Cliente.crear(null, d)).id_persona);
  const provisional = contrasenaProvisional();
  const hash = await bcrypt.hash(provisional, 10);
  const id = await withTransaction(async (c) => {
    const u = await Usuario.crearUsuario(c, { correo: d.correo, hash, estado: d.estado, requiereCambioContrasena: true });
    if (!(await Usuario.reemplazarRoles(c, u.id_usuario, ['CLIENTE']))) {
      throw AppError.badRequest('El rol CLIENTE no existe. Ejecuta npm run db:seed');
    }
    const { id_persona } = await Cliente.crear(c, d, u.id_usuario);
    // Dentro de la transacción: si el correo no sale, el cliente no se crea
    await enviarProvisional({ para: d.correo, nombre: d.nombre, contrasena: provisional });
    return id_persona;
  });
  return obtener(id);
};

const actualizar = async (id, d) => {
  await withTransaction(async (c) => {
    const p = await Cliente.actualizar(c, id, d);
    if (!p) throw AppError.notFound('Cliente no encontrado');
    if (p.id_usuario && d.correo) await Cliente.actualizarCorreoCuenta(c, p.id_usuario, d.correo);
  });
  return obtener(id);
};

const eliminar = async (id) => {
  const c = await obtener(id);
  if (c.id_usuario) throw AppError.badRequest('Este cliente tiene cuenta en la app: desactívalo en lugar de eliminarlo');
  await Cliente.eliminarSinCuenta(id);
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
