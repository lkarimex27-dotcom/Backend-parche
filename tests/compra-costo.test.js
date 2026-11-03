process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: la transacción y los modelos se simulan
jest.mock('../src/config/db', () => ({ withTransaction: async (fn) => fn({}) }));
jest.mock('../src/models/proveedor.model', () => ({ obtenerPorId: jest.fn(async () => ({ id_proveedor: 1 })) }));
jest.mock('../src/models/stock.model', () => ({
  ajustar: jest.fn(async () => true),
  fijarCosto: jest.fn(async () => undefined),
}));
jest.mock('../src/models/compra.model', () => ({
  crear: jest.fn(async () => 9),
  crearDetalle: jest.fn(async () => ({ rowCount: 1 })),
  obtenerPorId: jest.fn(async () => ({ id_compra: 9, estado: 'REGISTRADA', detalles: [] })),
}));
const Stock = require('../src/models/stock.model');
const service = require('../src/services/compra.service');

describe('Precio unitario de una compra', () => {
  it('pasa a ser el costo unitario del insumo y suma la cantidad al stock', async () => {
    // El pan costaba 700; en esta compra vino a 1000
    await service.crear({ id_proveedor: 1, fecha: '2026-10-17', items: [{ id_insumo_producto: 5, cantidad: 20, costo_unitario: 1000 }] });
    expect(Stock.fijarCosto).toHaveBeenCalledWith({}, 5, 1000);
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 5, 20);
  });
});

describe('Fecha de una compra', () => {
  const { crearCompra } = require('../src/validators/compra.validator');
  const datos = (fecha) => ({ id_proveedor: 1, fecha, items: [{ id_insumo_producto: 5, cantidad: 1, costo_unitario: 700 }] });
  it('acepta hoy y fechas pasadas', () => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    expect(crearCompra.safeParse(datos(hoy)).success).toBe(true);
    expect(crearCompra.safeParse(datos('2026-01-15')).success).toBe(true);
  });
  it('no acepta una fecha futura', () => {
    const r = crearCompra.safeParse(datos('2999-01-01'));
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/posterior a hoy/);
  });
});

describe('Fecha de una pérdida', () => {
  const { crearPerdida } = require('../src/validators/perdida.validator');
  it('no acepta una fecha futura', () => {
    expect(crearPerdida.safeParse({ id_insumo_producto: 5, cantidad: 1, fecha: '2999-01-01' }).success).toBe(false);
    expect(crearPerdida.safeParse({ id_insumo_producto: 5, cantidad: 1, fecha: '2026-01-15' }).success).toBe(true);
  });
});
