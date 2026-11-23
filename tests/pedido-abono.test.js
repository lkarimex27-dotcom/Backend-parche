jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/insumoProducto.model', () => ({ gaseosas: jest.fn() }));
jest.mock('../src/config/db', () => ({ withTransaction: jest.fn((fn) => fn({})) }));

const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');
const InsumoProducto = require('../src/models/insumoProducto.model');
const service = require('../src/services/pedido.service');

// Para recoger (sin domicilio): el total es solo lo pedido
const pedido = (cantidad, extra = {}) => ({
  nombre: 'Cliente', telefono: '3000000000', direccion: 'Calle 1', tipo_entrega: 'recoger',
  pago: 'Nequi', comprobante: 'data:image/png;base64,AAAA',
  items: [{ producto: 'Mini', cantidad, salsas: [], adiciones: [] }], ...extra,
});

describe('Pedidos de $150.000 o más: abono del 50%', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    InsumoProducto.gaseosas.mockResolvedValue([]);
    Pedido.catalogoActivo.mockResolvedValue([{ id_insumo_producto: 4, nombre: 'Hamburguesa Mini', precio: 13000, categoria: 'Hamburguesas' }]);
    Barrio.obtenerActivo.mockResolvedValue(null);
    Pedido.colaCocina.mockResolvedValue([]);
    Pedido.estadisticasDesplazamiento.mockResolvedValue({ observaciones: 0 });
    Pedido.crear.mockResolvedValue(30);
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 30 });
  });

  it('guarda el abono (la mitad, redondeada hacia arriba) y queda por confirmar', async () => {
    await service.crear(pedido(13), 7); // 13 × 13.000 = 169.000
    const [, datos] = Pedido.crear.mock.calls[0];
    expect(datos.total).toBe(169000);
    expect(datos.abono).toBe(84500);
    expect(datos.estado).toBe('Por confirmar');
    expect(datos.estado_pago).toBe('Pendiente de verificación');
  });

  it('no acepta pagarlo en efectivo ni sin comprobante', async () => {
    await expect(service.crear(pedido(13, { pago: 'Efectivo', comprobante: undefined }), 7)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.crear(pedido(13, { comprobante: undefined }), 7)).rejects.toMatchObject({ statusCode: 400 });
    expect(Pedido.crear).not.toHaveBeenCalled();
  });

  it('un pedido menor no lleva abono', async () => {
    await service.crear(pedido(2, { pago: 'Efectivo', comprobante: undefined }), 7);
    const [, datos] = Pedido.crear.mock.calls[0];
    expect(datos.abono).toBeNull();
    expect(datos.estado).toBe('Recibido');
  });
});
