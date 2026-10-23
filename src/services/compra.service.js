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
    await recalcularCostos(c, items);
  }
};

// El costo de cada insumo tocado vuelve a ser el de su compra registrada más reciente
const recalcularCostos = async (c, ...listas) => {
  for (const idInsumo of new Set(listas.flat().map((d) => d.id_insumo_producto))) await Stock.recalcularCosto(c, idInsumo);
};

const crear = async (datos) => {
  const d = await preparar(datos);
  const id = await withTransaction(async (c) => {
    const idCompra = await Compra.crear(c, d);
    await Stock.marcar(c, 'COMPRA', `Compra #${idCompra}`);
    await guardarDetalles(c, idCompra, d.items, true);
    return idCompra;
  });
  return obtener(id);
};

// Cantidad por insumo (una compra puede traer el mismo insumo en varias líneas). signo: +1 / -1
const porInsumo = (detalles, signo, total = new Map()) => {
  for (const d of detalles)
    total.set(d.id_insumo_producto, (total.get(d.id_insumo_producto) || 0) + signo * Number(d.cantidad));
  return total;
};

// Aplica la diferencia de stock. Lo que hay que quitar falla si ya se usó (producción, pérdidas)
// en vez de dejar el stock en 0 y descuadrar el inventario.
const aplicarNeto = async (c, neto, accion) => {
  for (const [idInsumo, delta] of neto) {
    const cantidad = Math.round(Math.abs(delta) * 1000) / 1000;
    if (!cantidad) continue;
    if (delta < 0) await Stock.retirar(c, idInsumo, cantidad, accion);
    else if (!(await Stock.ajustar(c, idInsumo, cantidad))) throw AppError.badRequest(`El insumo ${idInsumo} no existe`);
  }
};

// Reemplaza la compra completa: si está registrada, el stock cambia solo en la diferencia entre el detalle anterior y el nuevo
const actualizar = async (id, datos) => {
  const d = await preparar(datos);
  await withTransaction(async (c) => {
    const anterior = await obtener(id, c);
    const registrada = anterior.estado === 'REGISTRADA';
    await Compra.borrarDetalles(c, id);
    await Compra.actualizar(c, id, d);
    await guardarDetalles(c, id, d.items, false);
    if (registrada) {
      await Stock.marcar(c, 'EDICION_COMPRA', `Compra #${id}`);
      await aplicarNeto(c, porInsumo(d.items, 1, porInsumo(anterior.detalles, -1)), 'No se puede quitar de la compra');
      await recalcularCostos(c, anterior.detalles, d.items);
    }
  });
  return obtener(id);
};

// Anular descuenta del stock lo que la compra había sumado (falla si ya se usó); reactivar lo vuelve a sumar
const cambiarEstado = async (id, estado) => {
  await withTransaction(async (c) => {
    const compra = await obtener(id, c);
    if (compra.estado === estado) return;
    await Stock.marcar(c, estado === 'ANULADA' ? 'ANULACION_COMPRA' : 'REACTIVACION_COMPRA', `Compra #${id}`);
    await aplicarNeto(c, porInsumo(compra.detalles, estado === 'ANULADA' ? -1 : 1), 'No se puede anular la compra');
    await Compra.cambiarEstado(c, id, estado);
    await recalcularCostos(c, compra.detalles);
  });
  return obtener(id);
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
