const Compra = require('../models/compra.model');
const Proveedor = require('../models/proveedor.model');
const Stock = require('../models/stock.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

// Una compra REGISTRADA suma sus cantidades al stock; ANULADA no cuenta.
const listar = () => Compra.listar();

const obtener = async (id, c) => {
  const compra = await Compra.obtenerPorId(id, c);
  if (!compra) throw AppError.notFound('Compra no encontrada');
  return compra;
};

// signo: +1 suma los detalles al stock, -1 los descuenta
const moverStock = async (c, detalles, signo) => {
  for (const d of detalles) {
    if (!(await Stock.ajustar(c, d.id_insumo_producto, signo * d.cantidad))) {
      throw AppError.badRequest(`El insumo ${d.id_insumo_producto} no existe`);
    }
  }
};

const preparar = async (d) => {
  if (!(await Proveedor.obtenerPorId(d.id_proveedor))) throw AppError.badRequest('El proveedor no existe');
  return { ...d, subtotal: d.items.reduce((s, it) => s + it.cantidad * it.costo_unitario, 0), iva: d.iva ?? 0 };
};

const guardarDetalles = async (c, idCompra, items, sumarStock) => {
  for (const it of items) {
    if (!(await Compra.crearDetalle(c, idCompra, it)).rowCount) {
      throw AppError.badRequest(`El insumo ${it.id_insumo_producto} no existe`);
    }
  }
  if (sumarStock) {
    await moverStock(c, items, 1);
    for (const it of items) await Stock.fijarCosto(c, it.id_insumo_producto, it.costo_unitario);
  }
};

const crear = async (datos) => {
  const d = await preparar(datos);
  const id = await withTransaction(async (c) => {
    const idCompra = await Compra.crear(c, d);
    await guardarDetalles(c, idCompra, d.items, true);
    return idCompra;
  });
  return obtener(id);
};

// Reemplaza la compra completa: si está registrada, deshace el stock de los detalles anteriores y aplica los nuevos
const actualizar = async (id, datos) => {
  const d = await preparar(datos);
  await withTransaction(async (c) => {
    const anterior = await obtener(id, c);
    const registrada = anterior.estado === 'REGISTRADA';
    if (registrada) await moverStock(c, anterior.detalles, -1);
    await Compra.borrarDetalles(c, id);
    await Compra.actualizar(c, id, d);
    await guardarDetalles(c, id, d.items, registrada);
  });
  return obtener(id);
};

// Anular descuenta del stock lo que la compra había sumado; reactivar lo vuelve a sumar
const cambiarEstado = async (id, estado) => {
  await withTransaction(async (c) => {
    const compra = await obtener(id, c);
    if (compra.estado === estado) return;
    await moverStock(c, compra.detalles, estado === 'ANULADA' ? -1 : 1);
    await Compra.cambiarEstado(c, id, estado);
  });
  return obtener(id);
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
