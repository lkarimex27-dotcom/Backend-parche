const AppError = require('../errors/AppError');
const Stock = require('../models/stock.model');

// Descuenta del stock los insumos de una orden de producción (al pasar a "En cocina").
// Todo o nada: si a un insumo no le alcanza el stock, no se descuenta ninguno. Una sola vez por orden.
// Con `c`: dentro de una transacción que ya existe (cambio de estado de la orden)
const descontarCon = async (c, { numero_orden, insumos }, idUsuario) => {
    const yaHecho = await c.query(
      `INSERT INTO consumos_produccion (numero_orden, detalle, id_usuario) VALUES ($1, $2, $3)
       ON CONFLICT (numero_orden) DO NOTHING`,
      [numero_orden, JSON.stringify(insumos), idUsuario]
    );
    if (!yaHecho.rowCount) throw AppError.conflict(`Los insumos de la orden ${numero_orden} ya se habían descontado`);
    await Stock.marcar(c, 'PRODUCCION', `Orden ${numero_orden}`);

    for (const { insumo, cantidad } of insumos) {
      const r = await c.query(
        `UPDATE insumos_productos SET stock = stock - $2::numeric
          WHERE lower(nombre) = lower($1) AND ${Stock.CON_STOCK} AND stock >= $2::numeric
          RETURNING stock::float`,
        [insumo, cantidad]
      );
      if (r.rowCount) continue;
      const existe = await c.query(
        `SELECT stock::float FROM insumos_productos WHERE lower(nombre) = lower($1) AND ${Stock.CON_STOCK}`, [insumo]);
      throw AppError.badRequest(existe.rowCount
        ? `Stock insuficiente de «${insumo}»: se necesitan ${cantidad} y hay ${existe.rows[0].stock}`
        : `El insumo «${insumo}» no existe`);
    }
};

// Suma al stock lo que se preparó de un producto de insumo (ej. una salsa de la casa) al terminar su orden.
// Una sola vez por orden: la marca '<orden>#ENTRADA' en consumos_produccion evita sumarlo dos veces.
const ingresarCon = async (c, { numero_orden, productos }, idUsuario) => {
    const marca = `${numero_orden}#ENTRADA`.slice(0, 50);
    const nuevo = await c.query(
      `INSERT INTO consumos_produccion (numero_orden, detalle, id_usuario) VALUES ($1, $2, $3)
       ON CONFLICT (numero_orden) DO NOTHING`,
      [marca, JSON.stringify(productos), idUsuario]
    );
    if (!nuevo.rowCount) return false;
    await Stock.marcar(c, 'PRODUCCION_ENTRADA', `Orden ${numero_orden}`);
    for (const { insumo, cantidad } of productos) {
      const r = await c.query(
        `UPDATE insumos_productos SET stock = stock + $2::numeric
          WHERE lower(nombre) = lower($1) AND tipo = 'INSUMO' AND tiene_ficha_tecnica`,
        [insumo, cantidad]
      );
      if (!r.rowCount) throw AppError.badRequest(`«${insumo}» no es un producto de insumo`);
    }
    return true;
};

// ── M1: el panel calcula qué insumos descontar al pasar a cocina; aquí se revisa que cada uno salga de lo que la
// orden prepara (ficha técnica de sus productos, sus salsas, adiciones o bebidas con stock y las partes a rehacer
// de un producto no conforme) y que no pase de lo que eso pide. Así nadie descuenta de más o de otro insumo.
const UNIDADES = { g: ['masa', 1], kg: ['masa', 1000], ml: ['volumen', 1], L: ['volumen', 1000] };
// Igual que toBaseQuantity del panel: la cantidad en la unidad del insumo (null si no se puede convertir)
const aBase = (cantidad, unidad, base, paquete) => {
  const u = String(unidad || '').trim();
  const b = String(base || '').trim();
  if (u.toLowerCase() === b.toLowerCase()) return cantidad;
  if (paquete) {
    if (b === 'paq') {
      const adentro = aBase(cantidad, u, paquete.unidad);
      return adentro === null ? null : adentro / paquete.tamano;
    }
    if (u === 'paq') return aBase(cantidad * paquete.tamano, paquete.unidad, b);
  }
  const [de, a] = [UNIDADES[u], UNIDADES[b]];
  return de && a && de[0] === a[0] ? (cantidad * de[1]) / a[1] : null;
};
const clave = (nombre) => String(nombre ?? '').trim().toLowerCase();
const paqueteDe = (i) => (Number(i.unidades_paquete) > 0 ? { tamano: Number(i.unidades_paquete), unidad: i.contenido_unidad || 'und' } : undefined);

// Las líneas como las lee el panel ([13] en JSON; las órdenes viejas solo traen [1] producto y [2] cantidad)
const lineasDe = (fila) => {
  try {
    const lineas = JSON.parse(String(fila?.[13] ?? '[]'));
    if (Array.isArray(lineas) && lineas.length) {
      return lineas
        .map((l) => ({ ...l, name: String(l?.name ?? l?.product ?? '').trim(), quantity: Math.max(1, Number(l?.quantity) || 1) }))
        .filter((l) => l.name);
    }
  } catch { /* formato viejo */ }
  const nombre = String(fila?.[1] ?? '').trim();
  return nombre ? [{ name: nombre, quantity: Math.max(1, Number(fila?.[2]) || 1) }] : [];
};

// Lo máximo que la orden puede sacar de cada insumo: Map clave → cantidad en la unidad del insumo
const limitesDeOrden = async (c, fila) => {
  const lineas = lineasDe(fila).filter((l) => !l.reuse);
  const nombres = [...new Set(lineas.flatMap((l) => [l.name, ...(l.sauces || []), ...(l.onlySupplies || []).map((p) => p?.name)]).map(clave))];
  const limites = new Map();
  if (!nombres.length) return limites;
  const sumar = (nombre, cantidad) => {
    if (Number.isFinite(cantidad) && cantidad > 0) limites.set(clave(nombre), (limites.get(clave(nombre)) ?? 0) + cantidad);
  };
  const [{ rows: recetas }, { rows: articulos }] = await Promise.all([
    c.query(
      `SELECT lower(trim(p.nombre)) AS producto, i.nombre AS insumo, fi.cantidad::float AS cantidad, fi.medida,
              i.medida AS base, i.unidades_paquete, i.contenido_unidad
         FROM insumos_productos p
         JOIN fichas_tecnicas f ON f.id_insumo_producto = p.id_insumo_producto
         JOIN ficha_tecnica_insumos fi ON fi.id_ficha_tecnica = f.id_ficha_tecnica
         JOIN insumos_productos i ON i.id_insumo_producto = fi.id_insumo_producto
        WHERE lower(trim(p.nombre)) = ANY($1::text[])`, [nombres]),
    c.query(
      `SELECT lower(trim(nombre)) AS clave, medida AS base, unidades_paquete, contenido_unidad, porcion::float AS porcion
         FROM insumos_productos WHERE lower(trim(nombre)) = ANY($1::text[])`, [nombres]),
  ]);
  const articulo = new Map(articulos.map((a) => [a.clave, a]));
  // Una porción por unidad (salsa de la casa servida), o una unidad (bebida o adición con stock)
  const porciones = (nombre, veces) => articulo.has(clave(nombre)) && sumar(nombre, veces * Math.max(Number(articulo.get(clave(nombre)).porcion) || 0, 1));
  for (const l of lineas) {
    for (const r of recetas.filter((x) => x.producto === clave(l.name))) {
      sumar(r.insumo, (aBase(r.cantidad, r.medida, r.base, paqueteDe(r)) ?? 0) * l.quantity);
    }
    porciones(l.name, l.quantity);
    for (const salsa of l.sauces || []) porciones(salsa, l.quantity);
    for (const parte of l.onlySupplies || []) {
      const a = articulo.get(clave(parte?.name));
      if (a) sumar(parte.name, (aBase(Number(parte.quantity), parte.unit || a.base, a.base, paqueteDe(a)) ?? 0) * l.quantity);
    }
  }
  return limites;
};

const revisarInsumos = async (c, fila, insumos) => {
  if (!insumos.length) return;
  const limites = await limitesDeOrden(c, fila);
  const pedidos = new Map();
  for (const { insumo, cantidad } of insumos) pedidos.set(clave(insumo), { insumo, cantidad: (pedidos.get(clave(insumo))?.cantidad ?? 0) + cantidad });
  for (const [k, { insumo, cantidad }] of pedidos) {
    const maximo = limites.get(k);
    if (maximo === undefined) throw AppError.conflict(`«${insumo}» no está en la ficha técnica de los productos de esta orden: no se descuenta.`);
    // Margen para el redondeo de las conversiones (0,1 %)
    if (cantidad > maximo * 1.001 + 1e-9) {
      const r = (n) => Math.round(n * 1000) / 1000;
      throw AppError.conflict(`Se quieren descontar ${r(cantidad)} de «${insumo}» y la ficha técnica de esta orden pide como máximo ${r(maximo)}.`);
    }
  }
};

// Solo dentro de la transacción del cambio de estado de la orden (POST /ordenes-produccion/:id/avanzar). Las rutas
// sueltas que descontaban o sumaban stock (/consumos-produccion) se quitaron: nadie las usaba y cualquiera que
// pudiera editar pedidos podía mover el inventario con ellas.
module.exports = { descontarCon, ingresarCon, revisarInsumos, aBase };
