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
// "Cliente mostrador": anónimo para ventas a quien no da sus datos (lo crea init.sql); es fijo
const DOC_MOSTRADOR = '000000000';
const esMostrador = (c) => String(c?.documento ?? '').replace(/\D/g, '') === DOC_MOSTRADOR;

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
  if (esMostrador(await obtener(id))) {
    throw AppError.badRequest('El cliente mostrador no se puede editar ni desactivar.');
  }
  await withTransaction(async (c) => {
    const p = await Cliente.actualizar(c, id, d);
    if (!p) throw AppError.notFound('Cliente no encontrado');
    if (p.id_usuario && d.correo) await Cliente.actualizarCorreoCuenta(c, p.id_usuario, d.correo);
  });
  return obtener(id);
};

const eliminar = async (id) => {
  const c = await obtener(id);
  if (esMostrador(c)) throw AppError.badRequest('El cliente mostrador no se puede eliminar.');
  const n = await Cliente.compras(c);
  if (n) throw AppError.conflict(`No se puede eliminar: tiene ${n} compra${n === 1 ? '' : 's'} registrada${n === 1 ? '' : 's'}. Anúlalo en su lugar.`);
  await Cliente.eliminar(c);
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
