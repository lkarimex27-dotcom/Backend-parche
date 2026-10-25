const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { withTransaction } = require('../config/db');
const Usuario = require('../models/usuario.model');
const Permiso = require('../models/permiso.model');
const AppError = require('../errors/AppError');
const { enviarBienvenida } = require('../utils/provisional');

const firmarToken = (u) =>
  jwt.sign(
    { correo: u.correo, ...(u.requiere_cambio_contrasena ? { requiere_cambio_contrasena: true } : {}) },
    env.jwtSecret,
    { subject: String(u.id_usuario), expiresIn: env.jwtExpiresIn }
  );

const perfilCompleto = async (id) => {
  const usuario = await Usuario.obtenerPorId(id);
  const permisos = await Permiso.permisosDeUsuario(id);
  return { usuario, permisos };
};

// Registro público: crea un CLIENTE (para la app móvil).
const registrar = async (d) => {
  const hash = await bcrypt.hash(d.contrasena, 10);
  const id = await withTransaction(async (c) => {
    const u = await Usuario.crearUsuario(c, { correo: d.correo, hash });
    await Usuario.crearPersona(c, { id_usuario: u.id_usuario, ...d, tipo: 'CLIENTE' });
    if (!(await Usuario.reemplazarRoles(c, u.id_usuario, ['CLIENTE']))) {
      throw AppError.badRequest('El rol CLIENTE no existe. Ejecuta npm run db:seed');
    }
    return u.id_usuario;
  });
  // Correo de bienvenida: si no sale, la cuenta igual queda creada (ya eligió su contraseña)
  enviarBienvenida({ para: d.correo, nombre: d.nombre }).catch((err) =>
    console.warn(`No se pudo enviar la bienvenida a ${d.correo}:`, err.message));
  return { token: firmarToken({ id_usuario: id, correo: d.correo }), ...(await perfilCompleto(id)) };
};

const login = async ({ correo, contrasena }) => {
  const u = await Usuario.obtenerParaLogin(correo);
  // Mismo mensaje para "no existe" y "clave incorrecta": no revela qué correos están registrados.
  const ok = u && (await bcrypt.compare(contrasena, u.contrasena));
  if (!ok) throw AppError.unauthorized('Correo o contraseña incorrectos');
  if (u.estado !== 'ACTIVO') throw AppError.forbidden('Tu usuario está inactivo');
  return {
    token: firmarToken(u),
    ...(await perfilCompleto(u.id_usuario)),
    requiere_cambio_contrasena: Boolean(u.requiere_cambio_contrasena),
  };
};

const me = async (id) => {
  const p = await perfilCompleto(id);
  if (!p.usuario || p.usuario.estado !== 'ACTIVO') throw AppError.unauthorized('Usuario inactivo o inexistente');
  return p;
};

const actualizarPerfil = async (id, d) => {
  await Usuario.actualizarPerfil(id, d);
  return me(id);
};

const cambiarContrasena = async (id, { actual, nueva }) => {
  const hash = await Usuario.obtenerHash(id);
  if (!hash || !(await bcrypt.compare(actual, hash))) throw AppError.badRequest('La contraseña actual es incorrecta');
  if (actual === nueva) throw AppError.badRequest('La nueva contraseña debe ser diferente a la actual');
  await Usuario.cambiarContrasena(id, await bcrypt.hash(nueva, 10));
};

const cambiarContrasenaInicial = async (id, { nueva }) => {
  const usuario = await Usuario.obtenerPorId(id);
  if (!usuario || !usuario.requiere_cambio_contrasena) {
    throw AppError.badRequest('Esta cuenta no requiere un cambio inicial de contraseña.');
  }
  const hash = await bcrypt.hash(nueva, 10);
  const result = await withTransaction((c) => Usuario.cambiarContrasenaInicial(c, id, hash));
  if (!result.rowCount) {
    throw AppError.badRequest('Esta cuenta no requiere un cambio inicial de contraseña.');
  }
  const actualizado = await Usuario.obtenerPorId(id);
  return { token: firmarToken(actualizado) };
};

module.exports = { registrar, login, me, actualizarPerfil, cambiarContrasena, cambiarContrasenaInicial };
