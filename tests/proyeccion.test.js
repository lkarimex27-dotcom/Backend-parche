jest.mock('../src/models/stock.model', () => ({ consumoReciente: jest.fn() }));
const Stock = require('../src/models/stock.model');
const { sugerir, proyectar } = require('../src/services/proyeccion.service');

describe('Proyección de compras', () => {
  it('sugiere lo que falta para cubrir los días pedidos más el mínimo', () => {
    // 3000 g en 30 días = 100 g/día; 15 días = 1500 g + mínimo 500 - stock 400 = 1600
    const [r] = sugerir([{ id: 1, nombre: 'Carne', stock: 400, minimo: 500, consumo: 3000 }], 15);
    expect(r).toMatchObject({ consumo_diario: 100, dias_restantes: 4, sugerido: 1600 });
  });

  it('si el stock alcanza no sugiere comprar', () => {
    const [r] = sugerir([{ id: 1, stock: 5000, minimo: 0, consumo: 300 }], 15);
    expect(r.sugerido).toBe(0);
  });

  it('sin consumo, los días restantes no se calculan y solo pide hasta el mínimo', () => {
    const [r] = sugerir([{ id: 1, stock: 2, minimo: 5, consumo: 0 }], 30);
    expect(r).toMatchObject({ dias_restantes: null, sugerido: 3 });
  });

  it('usa los últimos 30 días de movimientos', async () => {
    Stock.consumoReciente.mockResolvedValueOnce([]);
    await expect(proyectar(7)).resolves.toEqual({ dias_historia: 30, cobertura: 7, insumos: [] });
    expect(Stock.consumoReciente).toHaveBeenCalledWith(30);
  });
});
