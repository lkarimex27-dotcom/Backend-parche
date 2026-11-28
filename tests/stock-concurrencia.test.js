// M2: dos pedidos al mismo tiempo con el último stock → uno pasa y el otro se rechaza (el bloqueo los ordena).
// M3: los descuadres y el consumo usan la misma regla de «qué lleva stock» (incluye Bebidas, como Hit).
jest.mock('../config/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/insumoProducto.model', () => ({ gaseosas: jest.fn() }));

const db = require('../config/db');
const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');
const InsumoProducto = require('../src/models/insumoProducto.model');
const Stock = require('../src/models/stock.model');
const service = require('../src/services/pedido.service');

const pedido = () => ({
  nombre: 'Cliente', telefono: '3000000000', direccion: 'Calle 1', tipo_entrega: 'recoger', pago: 'Efectivo',
  items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
});

describe('Dos pedidos simultáneos con el último pan (M2)', () => {
  let apartado;
  const preparar = ({ conBloqueo }) => {
    apartado = 0;
    let cola = Promise.resolve();
    // Cada transacción tiene su cliente; al terminar suelta su bloqueo (como pg_advisory_xact_lock)
    db.withTransaction.mockImplementation(async (fn) => {
      const c = {};
      try { return await fn(c); } finally { c.soltar?.(); }
    });
    Pedido.bloquearStock.mockImplementation(async (c) => {
      if (!conBloqueo) return;
      const antes = cola;
      cola = new Promise((r) => { c.soltar = r; });
      await antes;
    });
    // 1 pan en stock; lo apartado crece cuando un pedido se guarda
    Pedido.insumosParaPreparar.mockImplementation(async () => [{ producto: 4, insumo: 100, nombre: 'Pan', stock: 1, necesita: 1, apartado }]);
    Pedido.crear.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 15)); apartado += 1; return 30; });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    InsumoProducto.gaseosas.mockResolvedValue([]);
    Pedido.catalogoActivo.mockResolvedValue([{ id_insumo_producto: 4, nombre: 'Hamburguesa Mini', precio: 13000, categoria: 'Hamburguesas' }]);
    Barrio.obtenerActivo.mockResolvedValue(null);
    Pedido.colaCocina.mockResolvedValue([]);
    Pedido.estadisticasDesplazamiento.mockResolvedValue({ observaciones: 0 });
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 30 });
  });

  it('con el bloqueo: el primero se lleva el pan y el segundo recibe «se agotó»', async () => {
    preparar({ conBloqueo: true });
    const [a, b] = await Promise.allSettled([service.crear(pedido(), 7), service.crear(pedido(), 8)]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    expect((a.status === 'rejected' ? a : b).reason.message).toMatch(/se agotó por ahora/);
    expect(Pedido.crear).toHaveBeenCalledTimes(1);
  });

  it('sin el bloqueo los dos se llevaban el mismo pan (lo que pasaba antes)', async () => {
    preparar({ conBloqueo: false });
    const resultados = await Promise.allSettled([service.crear(pedido(), 7), service.crear(pedido(), 8)]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
  });

  it('el bloqueo se pide antes de leer el stock, y con la consulta de Postgres', async () => {
    preparar({ conBloqueo: true });
    await service.crear(pedido(), 7);
    expect(Pedido.bloquearStock.mock.invocationCallOrder[0]).toBeLessThan(Pedido.insumosParaPreparar.mock.invocationCallOrder[0]);
    const c = { query: jest.fn() };
    jest.requireActual('../src/models/pedido.model').bloquearStock(c);
    expect(c.query.mock.calls[0][0]).toBe("SELECT pg_advisory_xact_lock(hashtext('stock-pedidos'))");
  });
});

describe('Una sola regla de «qué lleva stock» (M3)', () => {
  it('descuadres y consumo reciente incluyen las Bebidas, como compras y ventas', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await Stock.descuadres();
    await Stock.consumoReciente(30);
    for (const [sql] of db.query.mock.calls) {
      expect(sql).toContain(Stock.CON_STOCK);
      expect(sql).toContain("'Bebidas'");
    }
  });
});
