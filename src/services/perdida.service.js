const Perdida = require('../models/perdida.model');
const Compra = require('../models/compra.model');
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

// No se puede perder más de lo que hay (antes el stock quedaba en 0 y el resto se perdía sin aviso)
const descontar = (c, idInsumo, cantidad) => Stock.retirar(c, idInsumo, cantidad, 'No hay tanto en stock');

// "Compra a Postobón del 17 de octubre de 2026" -> { proveedor, fecha: '2026-10-17' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const compraDeOrigen = (observacion) => {
  const m = /^Compra a (.+) del (\d{1,2}) de (\p{L}+) de (\d{4})$/u.exec(String(observacion || '').trim());
  const mes = m && MESES.indexOf(m[3].toLowerCase()) + 1;
  return mes ? { proveedor: m[1], fecha: `${m[4]}-${String(mes).padStart(2, '0')}-${m[2].padStart(2, '0')}` } : null;
};

const crear = async (d, idUsuario) => {
  const id = await withTransaction(async (c) => {
    const idPerdida = await Perdida.crear(c, { ...d, id_usuario: idUsuario });
    await Stock.marcar(c, 'PERDIDA', `Pérdida #${idPerdida}`);
    await descontar(c, d.id_insumo_producto, d.cantidad);
    return idPerdida;
  });
  return obtener(id);
};

// Devuelve al stock la cantidad anterior y descuenta la nueva (puede cambiar de insumo)
const actualizar = async (id, d) => {
  await withTransaction(async (c) => {
    const anterior = await obtener(id, c);
    if (anterior.estado === 'DEVUELTA') throw AppError.conflict('Esta pérdida ya se devolvió a la compra: no se puede editar.');
    await Stock.marcar(c, 'EDICION_PERDIDA', `Pérdida #${id}`);
    await Stock.ajustar(c, anterior.id_insumo_producto, anterior.cantidad);
    await Perdida.actualizar(c, id, d);
    await descontar(c, d.id_insumo_producto, d.cantidad);
  });
  return obtener(id);
};

// Devolver a la compra todo o una parte: eso vuelve al stock y queda el motivo
// (solo pérdidas que vinieron de una compra). Sin cantidad, se devuelve todo.
const devolver = async (id, { cantidad, motivo }) => {
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    if (p.estado === 'DEVUELTA') throw AppError.conflict('Esta pérdida ya se devolvió a la compra.');
    if (!p.id_compra && !String(p.observacion || '').startsWith('Compra a ')) {
      throw AppError.badRequest('Solo se puede devolver a la compra una pérdida que vino de una compra.');
    }
    // Anular la compra ya sacó del stock lo comprado: devolverle algo lo sumaría dos veces.
    // Por su número si la pérdida lo tiene; si es anterior al enlace, por el texto (proveedor + fecha)
    const origen = !p.id_compra && compraDeOrigen(p.observacion);
    const estados = p.id_compra
      ? [(await Compra.obtenerPorId(p.id_compra, c))?.estado].filter(Boolean)
      : origen ? await Compra.estadosDe(c, origen.proveedor, origen.fecha) : [];
    if (estados.length && !estados.includes('REGISTRADA')) {
      throw AppError.conflict('La compra de esta pérdida está anulada: no se le puede devolver nada. Reactívala primero.');
    }
    const devuelta = cantidad ?? p.cantidad;
    if (devuelta > p.cantidad) {
      throw AppError.badRequest(`No puedes devolver más de lo perdido: máximo ${p.cantidad} ${p.medida || ''}`.trim());
    }
    await Stock.marcar(c, 'DEVOLUCION_PERDIDA', `Pérdida #${id}${p.id_compra ? ` → Compra #${p.id_compra}` : ''}`);
    await Stock.ajustar(c, p.id_insumo_producto, devuelta);
    await Perdida.devolver(c, id, {
      cantidad: devuelta,
      total: devuelta === p.cantidad,
      nota: `${devuelta} ${p.medida || ''}`.replace(/\s+$/, '') + `: ${motivo}`,
    });
  });
  return obtener(id);
};

module.exports = { listar, obtener, crear, actualizar, devolver };
