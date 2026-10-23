const AppError = require('../errors/AppError');
const { query } = require('../config/db');

// Movimientos de stock. Siempre dentro de la transacción (`c`) de la compra, pérdida o producción.
// Llevan stock los insumos y las gaseosas de reventa: productos "Gaseosa <sabor> (<tamaño>)" (categoría «Bebidas»),
// que se compran y se venden tal cual. Devuelve false si el id no lleva stock (el service revierte).
const CON_STOCK = `(tipo = 'INSUMO' OR (tipo = 'PRODUCTO' AND nombre ILIKE 'Gaseosa %'))`;
// shortcut: el stock no baja de 0 (igual que el panel); validar existencias cuando todo el stock se registre por compras.
const ajustar = async (c, idInsumo, delta) =>
  (await c.query(
    `UPDATE insumos_productos SET stock = GREATEST(0, stock + $2)
      WHERE id_insumo_producto = $1 AND ${CON_STOCK}`,
    [idInsumo, delta]
  )).rowCount > 0;

// Saca `cantidad` solo si alcanza: nunca recorta a 0 en silencio. Si no alcanza, falla con
// "<accion>: de «X» hay N kg y se necesitan M kg." (la transacción del service se revierte)
const retirar = async (c, idInsumo, cantidad, accion) => {
  const r = await c.query(
    `UPDATE insumos_productos SET stock = stock - $2
      WHERE id_insumo_producto = $1 AND ${CON_STOCK} AND stock >= $2`,
    [idInsumo, cantidad]
  );
  if (r.rowCount) return;
  const i = (await c.query(
    `SELECT nombre, stock::float AS stock, COALESCE(medida, '') AS medida
       FROM insumos_productos WHERE id_insumo_producto = $1 AND ${CON_STOCK}`,
    [idInsumo]
  )).rows[0];
  if (!i) throw AppError.badRequest(`El insumo ${idInsumo} no existe`);
  const u = i.medida ? ` ${i.medida}` : '';
  throw AppError.badRequest(`${accion}: de «${i.nombre}» hay ${i.stock}${u} y se necesitan ${Number(cantidad)}${u}.`);
};

// El costo del insumo es el precio de su compra registrada más reciente (por fecha de compra, no de registro):
// editar una compra vieja, registrar una atrasada o anular la última no lo dejan con un precio desactualizado.
// Sin compras registradas se queda el costo que tenía.
const recalcularCosto = (c, idInsumo) =>
  c.query(
    `UPDATE insumos_productos SET costo = u.costo_unitario
       FROM (SELECT dc.costo_unitario FROM detalle_compras dc JOIN compras co ON co.id_compra = dc.id_compra
              WHERE dc.id_insumo_producto = $1 AND co.estado = 'REGISTRADA'
              ORDER BY co.fecha DESC, co.id_compra DESC, dc.id_detalle_compra DESC LIMIT 1) u
      WHERE id_insumo_producto = $1 AND ${CON_STOCK}`,
    [idInsumo]
  );

// Origen de los cambios de stock que siguen en esta transacción: el trigger tr_movimiento_stock lo
// guarda en movimientos_stock (ej. marcar(c, 'COMPRA', 'Compra #12')). Sin marcar quedan como 'AJUSTE'.
const marcar = (c, origen, referencia) =>
  c.query(`SELECT set_config('app.mov_origen', $1, true), set_config('app.mov_ref', $2, true)`, [origen, referencia ?? '']);

// Historial de un insumo, del más reciente al más antiguo
const movimientos = async (idInsumo, limite = 50) =>
  (await query(
    `SELECT id_movimiento, cantidad::float AS cantidad, stock_resultante::float AS stock_resultante, origen, referencia,
            to_char(fecha AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS fecha
       FROM movimientos_stock WHERE id_insumo_producto = $1
      ORDER BY id_movimiento DESC LIMIT $2`,
    [idInsumo, limite]
  )).rows;

// Insumos y gaseosas cuyo stock no es la suma de sus movimientos (debería estar siempre vacío)
const descuadres = async () =>
  (await query(
    `SELECT ip.id_insumo_producto AS id, ip.nombre, ip.stock::float AS stock, COALESCE(sum(m.cantidad), 0)::float AS suma_movimientos
       FROM insumos_productos ip LEFT JOIN movimientos_stock m ON m.id_insumo_producto = ip.id_insumo_producto
      WHERE (ip.tipo = 'INSUMO' OR (ip.tipo = 'PRODUCTO' AND ip.nombre ILIKE 'Gaseosa %'))
      GROUP BY ip.id_insumo_producto, ip.nombre, ip.stock
     HAVING ip.stock <> COALESCE(sum(m.cantidad), 0)
      ORDER BY ip.nombre`
  )).rows;

module.exports = { CON_STOCK, ajustar, retirar, recalcularCosto, marcar, movimientos, descuadres };
