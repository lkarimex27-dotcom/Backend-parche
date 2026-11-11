const Stock = require('../models/stock.model');

const DIAS_HISTORIA = 30;
const redondear = (n) => Math.round(n * 1000) / 1000;

// Sugerencia de compra por insumo: lo que se gastaría en `cobertura` días al ritmo de los últimos 30, más el mínimo,
// menos lo que ya hay. Solo lectura: no crea compras.
const sugerir = (filas, cobertura) =>
  filas.map((f) => {
    const diario = f.consumo / DIAS_HISTORIA;
    const necesario = diario * cobertura + (f.minimo || 0);
    return {
      ...f,
      consumo_diario: redondear(diario),
      dias_restantes: diario > 0 ? Math.floor(f.stock / diario) : null,
      sugerido: redondear(Math.max(0, necesario - f.stock)),
    };
  });

const proyectar = async (cobertura) => ({
  dias_historia: DIAS_HISTORIA,
  cobertura,
  insumos: sugerir(await Stock.consumoReciente(DIAS_HISTORIA), cobertura),
});

module.exports = { proyectar, sugerir };
