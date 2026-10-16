const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');
const { contrasenaProvisional, enviarProvisional } = require('../utils/provisional');

const ROUNDS = 10;

const listar = (filtros) => Usuario.listar(filtros);

const obtener = async (id) => {
  const u = await Usuario.obtenerPorId(id);
  if (!u) throw AppError.notFound('Usuario no encontrado');
  return u;
};

const asegurarRoles = (ok) => {
  if (!ok) throw AppError.badRequest('Alguno de los roles indicados no existe');
};

// Cuenta creada por el admin: el usuario recibe una contraseña provisional y debe cambiarla al entrar
const crear = async (d) => {
  const provisional = contrasenaProvisional();
  const hash = await bcrypt.hash(provisional, ROUNDS);
  const id = await withTransaction(async (c) => {
    const u = await Usuario.crearUsuario(c, { correo: d.correo, hash, estado: d.estado, debeCambiar: true });
    await Usuario.crearPersona(c, { id_usuario: u.id_usuario, ...d });
    asegurarRoles(await Usuario.reemplazarRoles(c, u.id_usuario, d.roles));
    // Dentro de la transacción: si el correo no sale, el usuario no se crea
    await enviarProvisional({ para: d.correo, nombre: d.nombre, contrasena: provisional });
    return u.id_usuario;
  });
  return obtener(id);
};

const actualizar = async (id, d, idQuienEdita) => {
  if (id === idQuienEdita && d.estado === 'INACTIVO') throw AppError.badRequest('No puedes desactivar tu propio usuario');
  await obtener(id); // 404 si no existe
  const hash = d.contrasena ? await bcrypt.hash(d.contrasena, ROUNDS) : null;
  await withTransaction(async (c) => {
    await Usuario.actualizarUsuario(c, id, { correo: d.correo, hash, estado: d.estado });
    await Usuario.actualizarPersona(c, id, d);
    if (d.roles) asegurarRoles(await Usuario.reemplazarRoles(c, id, d.roles));
  });
  return obtener(id);
};

// No se borra físicamente: ventas, compras y pedidos referencian al usuario. Se desactiva.
const desactivar = async (id, idQuienDesactiva) => {
  if (id === idQuienDesactiva) throw AppError.badRequest('No puedes desactivar tu propio usuario');
  await obtener(id);
  await withTransaction((c) => Usuario.actualizarUsuario(c, id, { estado: 'INACTIVO' }));
};

module.exports = { listar, obtener, crear, actualizar, desactivar };
