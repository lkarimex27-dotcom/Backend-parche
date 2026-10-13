const Perdida = require('../models/perdida.model');
const Stock = require('../models/stock.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

// Una pérdida descuenta su cantidad del stock del insumo.
const listar = () => Perdida.listar();

const obtener = async (id, c) => {
  const p = await Perdida.obtenerPorId(id, c);
  if (!p) throw AppError.notFound('Pérdida no encontrada');
  return p;
};

const descontar = async (c, idInsumo, cantidad) => {
  if (!(await Stock.ajustar(c, idInsumo, -cantidad))) throw AppError.badRequest('El insumo no existe');
};

const crear = async (d, idUsuario) => {
  const id = await withTransaction(async (c) => {
    const idPerdida = await Perdida.crear(c, { ...d, id_usuario: idUsuario });
    await descontar(c, d.id_insumo_producto, d.cantidad);
    return idPerdida;
  });
  return obtener(id);
};

// Devuelve al stock la cantidad anterior y descuenta la nueva (puede cambiar de insumo)
const actualizar = async (id, d) => {
  await withTransaction(async (c) => {
    const anterior = await obtener(id, c);
    await Stock.ajustar(c, anterior.id_insumo_producto, anterior.cantidad);
    await Perdida.actualizar(c, id, d);
    await descontar(c, d.id_insumo_producto, d.cantidad);
  });
  return obtener(id);
};

module.exports = { listar, obtener, crear, actualizar };
