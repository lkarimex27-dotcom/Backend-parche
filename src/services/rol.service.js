const Rol = require('../models/rol.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

const listar = () => Rol.listar();
const catalogo = async () => ({ modulos: await Rol.listarModulos(), privilegios: await Rol.listarPrivilegios() });

const obtener = async (id) => {
  const r = await Rol.obtenerPorId(id);
  if (!r) throw AppError.notFound('Rol no encontrado');
  return { ...r, permisos: await Rol.permisosDeRol(id) };
};

const crear = (d) => Rol.crear(d);

const actualizar = async (id, d) => {
  const r = await Rol.actualizar(id, d);
  if (!r) throw AppError.notFound('Rol no encontrado');
  return r;
};

const eliminar = async (id) => {
  if (!(await Rol.eliminar(id))) throw AppError.notFound('Rol no encontrado');
};

const reemplazarPermisos = async (id, { permisos }) => {
  await obtener(id);
  await withTransaction(async (c) => {
    if (!(await Rol.reemplazarPermisos(c, id, permisos))) {
      throw AppError.badRequest('Algún módulo o privilegio indicado no existe (revisa GET /api/roles/catalogo)');
    }
  });
  return obtener(id);
};

module.exports = { listar, catalogo, obtener, crear, actualizar, eliminar, reemplazarPermisos };
