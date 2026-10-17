const Modelo = require('../models/insumoProducto.model');
const { withTransaction } = require('../config/db');
const Categoria = require('../models/categoria.model');
const AppError = require('../errors/AppError');

const NOMBRE = { INSUMO: 'Insumo', PRODUCTO: 'Producto' };

const listar = (tipo, filtros) => Modelo.listar(tipo, filtros);

const obtener = async (tipo, id) => {
  const r = await Modelo.obtenerPorId(tipo, id);
  if (!r) throw AppError.notFound(`${NOMBRE[tipo]} no encontrado`);
  return r;
};

const validar = async (tipo, d) => {
  if (d.maximo != null && d.minimo != null && d.maximo < d.minimo) {
    throw AppError.badRequest('El máximo no puede ser menor que el mínimo');
  }
  // La categoría debe ser del mismo tipo (no se puede poner un producto en una categoría de insumos).
  if (d.id_categoria != null && !(await Categoria.obtenerPorId(tipo, d.id_categoria))) {
    throw AppError.badRequest(`La categoría indicada no existe entre las categorías de ${tipo.toLowerCase()}s`);
  }
};

const crear = async (tipo, datos) => {
  await validar(tipo, datos);
  const { id_insumo_producto } = await Modelo.crear(tipo, datos);
  return obtener(tipo, id_insumo_producto);
};

const actualizar = async (tipo, id, datos) => {
  await validar(tipo, datos);
  if (!(await Modelo.actualizar(tipo, id, datos))) throw AppError.notFound(`${NOMBRE[tipo]} no encontrado`);
  return obtener(tipo, id);
};

const eliminar = async (tipo, id) => {
  if (!(await Modelo.eliminar(tipo, id))) throw AppError.notFound(`${NOMBRE[tipo]} no encontrado`);
};

const guardarFicha = async (tipo, id, d) => {
  await obtener(tipo, id); // 404 si no es de este tipo
  await withTransaction(async (c) => {
    const faltante = await Modelo.guardarFicha(c, id, d);
    if (faltante) throw AppError.badRequest(`El insumo «${faltante}» de la ficha técnica no existe`);
  });
  return obtener(tipo, id);
};

const reemplazarImagen = async (tipo, id, url) => {
  await obtener(tipo, id);
  await withTransaction((c) => Modelo.reemplazarImagen(c, id, url));
  return obtener(tipo, id);
};

// Foto subida guardada como data URL -> { tipo, bytes } para servirla como imagen
const imagen = async (idImagen) => {
  const url = await Modelo.obtenerImagen(idImagen);
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(url || '');
  if (!m) throw AppError.notFound('Imagen no encontrada');
  return { tipo: m[1], bytes: Buffer.from(m[2], 'base64') };
};

const productosSinStock = () => Modelo.productosSinStock();
const insumosVendibles = () => Modelo.insumosVendibles();

module.exports = {
  listar, obtener, crear, actualizar, eliminar, guardarFicha, reemplazarImagen, imagen, productosSinStock, insumosVendibles,
};
