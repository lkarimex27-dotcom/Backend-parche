const Proveedor = require('../models/proveedor.model');
const AppError = require('../errors/AppError');

const listar = (filtros) => Proveedor.listar(filtros);

const obtener = async (id) => {
  const p = await Proveedor.obtenerPorId(id);
  if (!p) throw AppError.notFound('Proveedor no encontrado');
  return p;
};

const crear = (d) => Proveedor.crear(d);

const actualizar = async (id, d) => {
  const p = await Proveedor.actualizar(id, d);
  if (!p) throw AppError.notFound('Proveedor no encontrado');
  return p;
};

// Las compras referencian al proveedor, así que "eliminar" lo desactiva.
const desactivar = async (id) => actualizar(id, { estado: 'INACTIVO' });

module.exports = { listar, obtener, crear, actualizar, desactivar };
