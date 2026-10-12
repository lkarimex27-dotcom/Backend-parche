const Categoria = require('../models/categoria.model');
const AppError = require('../errors/AppError');

const listar = (tipo) => Categoria.listar(tipo);

const obtener = async (tipo, id) => {
  const c = await Categoria.obtenerPorId(tipo, id);
  if (!c) throw AppError.notFound('Categoría no encontrada');
  return c;
};

const crear = (tipo, datos) => Categoria.crear(tipo, datos);

const actualizar = async (tipo, id, datos) => {
  const c = await Categoria.actualizar(tipo, id, datos);
  if (!c) throw AppError.notFound('Categoría no encontrada');
  return c;
};

// Si tiene insumos/productos asociados, Postgres lanza 23503 y el middleware responde 409.
const eliminar = async (tipo, id) => {
  if (!(await Categoria.eliminar(tipo, id))) throw AppError.notFound('Categoría no encontrada');
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
