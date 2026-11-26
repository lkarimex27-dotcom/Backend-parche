jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/insumoProducto.model', () => ({ gaseosas: jest.fn() }));
jest.mock('../config/db', () => ({ withTransaction: jest.fn((fn) => fn({})) }));

const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');
const InsumoProducto = require('../src/models/insumoProducto.model');
const service = require('../src/services/pedido.service');
const v = require('../src/validators/pedido.validator');

// Para recoger: el total es solo lo pedido (cantidad × $13.000)
const pedido = (cantidad, transferencia, extra = {}) => ({
  nombre: 'Cliente', telefono: '3000000000', direccion: 'Calle 1', tipo_entrega: 'recoger',
  pago: 'Nequi', comprobante: 'data:image/png;base64,AAAA', valor_pago: transferencia, pago_mixto: { transferencia },
  items: [{ producto: 'Mini', cantidad, salsas: [], adiciones: [] }], ...extra,
});

describe('Pago mixto: una parte por transferencia y el resto en efectivo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    InsumoProducto.gaseosas.mockResolvedValue([]);
    Pedido.catalogoActivo.mockResolvedValue([{ id_insumo_producto: 4, nombre: 'Hamburguesa Mini', precio: 13000, categoria: 'Hamburguesas' }]);
    Barrio.obtenerActivo.mockResolvedValue(null);
    Pedido.colaCocina.mockResolvedValue([]);
    Pedido.estadisticasDesplazamiento.mockResolvedValue({ observaciones: 0 });
    Pedido.crear.mockResolvedValue(30);
    Pedido.soportesDeOtros.mockResolvedValue([]);
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 30 });
  });

  it('guarda lo transferido como abono, marca el pedido mixto y espera verificar la transferencia', async () => {
    await service.crear(pedido(2, 10000), 7); // 26.000: 10.000 por Nequi y 16.000 en efectivo
    const [, datos] = Pedido.crear.mock.calls[0];
    expect(datos.abono).toBe(10000);
    expect(datos.pago_mixto).toBe(true);
    expect(datos.estado).toBe('Recibido');
    expect(datos.estado_pago).toBe('Pendiente de verificación');
  });

  it('el comprobante se revisa contra la parte transferida, no contra el total', async () => {
    await expect(service.crear(pedido(2, 10000, { valor_pago: 9000 }), 7)).rejects.toThrow(/no cubre/);
  });

  it('no acepta transferir todo (no sería mixto) ni, desde $150.000, menos de la mitad', async () => {
    await expect(service.crear(pedido(2, 26000), 7)).rejects.toThrow(/menor que el total/);
    await expect(service.crear(pedido(13, 50000), 7)).rejects.toThrow(/al menos la mitad/); // 169.000
    await service.crear(pedido(13, 90000), 7);
    expect(Pedido.crear.mock.calls[0][1]).toMatchObject({ abono: 90000, pago_mixto: true, estado: 'Por confirmar' });
  });

  it('el validador pide la transferencia con comprobante', () => {
    expect(v.crearPedido.safeParse({ ...pedido(1, 5000), pago: 'Efectivo' }).success).toBe(false);
    expect(v.crearPedido.safeParse({ ...pedido(1, 5000), comprobante: undefined }).success).toBe(false);
    expect(v.crearPedido.safeParse(pedido(1, 5000)).success).toBe(true);
  });
});
