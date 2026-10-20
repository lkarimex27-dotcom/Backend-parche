// Movimientos de stock de insumos. Siempre dentro de la transacción (`c`) de la compra o pérdida.
// Devuelve false si el id no es un insumo (el service revierte).
// shortcut: el stock no baja de 0 (igual que el panel); validar existencias cuando todo el stock se registre por compras.
const ajustar = async (c, idInsumo, delta) =>
  (await c.query(
    `UPDATE insumos_productos SET stock = GREATEST(0, stock + $2)
      WHERE id_insumo_producto = $1 AND tipo = 'INSUMO'`,
    [idInsumo, delta]
  )).rowCount > 0;

// El costo del insumo es el último precio al que se compró
const fijarCosto = (c, idInsumo, costo) =>
  c.query(`UPDATE insumos_productos SET costo = $2 WHERE id_insumo_producto = $1 AND tipo = 'INSUMO'`, [idInsumo, costo]);

module.exports = { ajustar, fijarCosto };
