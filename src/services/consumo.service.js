const { withTransaction } = require('../../config/db');
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

const descontar = (d, idUsuario) => withTransaction((c) => descontarCon(c, d, idUsuario));
const ingresar = (d, idUsuario) => withTransaction((c) => ingresarCon(c, d, idUsuario));

module.exports = { descontar, ingresar, descontarCon, ingresarCon };
