const Cliente = require('../models/cliente.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

const listar = () => Cliente.listar();

const obtener = async (id) => {
  const c = await Cliente.obtenerPorId(id);
  if (!c) throw AppError.notFound('Cliente no encontrado');
  return c;
};

const crear = async (d) => obtener((await Cliente.crear(d)).id_persona);

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
