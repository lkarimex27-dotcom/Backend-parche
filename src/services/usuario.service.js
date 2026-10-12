const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

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

const crear = async (d) => {
  const hash = await bcrypt.hash(d.contrasena, ROUNDS);
  const id = await withTransaction(async (c) => {
    const u = await Usuario.crearUsuario(c, { correo: d.correo, hash, estado: d.estado });
    await Usuario.crearPersona(c, { id_usuario: u.id_usuario, ...d });
    asegurarRoles(await Usuario.reemplazarRoles(c, u.id_usuario, d.roles));
    return u.id_usuario;
  });
  return obtener(id);
};

const actualizar = async (id, d) => {
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
