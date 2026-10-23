jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/config/db', () => ({
  withTransaction: jest.fn((fn) => fn({})),
}));

const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');
const service = require('../src/services/pedido.service');

describe('integración de la estimación inicial al crear un pedido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Pedido.catalogoActivo.mockResolvedValue([
      { id_insumo_producto: 4, nombre: 'Hamburguesa Mini', precio: 13000, categoria: 'Hamburguesas' },
    ]);
    Barrio.obtenerActivo.mockResolvedValue({
      id_barrio: 2,
      nombre: 'Santa Ana',
      activo: true,
      es_cercano: true,
      tiempo_desplazamiento_minutos: null,
    });
    Pedido.cargaCocina.mockResolvedValue(0);
    Pedido.estadisticasDesplazamiento.mockResolvedValue({
      observaciones: 0,
      p25: null,
      mediana: null,
      p75: null,
    });
    Pedido.crear.mockResolvedValue(22);
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 22 });
  });

  it('almacena el snapshot en la misma transacción sin cambiar los precios del pedido', async () => {
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      id_barrio: 2,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [client, payload] = Pedido.crear.mock.calls[0];
    expect(client).toEqual({});
    expect(payload.id_barrio).toBe(2);
    expect(payload.estimacion_inicial).toMatchObject({
      estimatedMinutes: 20,
      source: 'baseline',
      zone: 'Santa Ana',
    });
    expect(payload.total).toBe(13000);
    expect(Pedido.crearDetalle).toHaveBeenCalledWith(client, 22, expect.objectContaining({
      subtotal: 13000,
    }));
  });
});
