jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/insumoProducto.model');
jest.mock('../src/config/db', () => ({
  withTransaction: jest.fn((fn) => fn({})),
}));

const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');
const InsumoProducto = require('../src/models/insumoProducto.model');
const service = require('../src/services/pedido.service');

describe('integración de la estimación inicial al crear un pedido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    InsumoProducto.gaseosas.mockResolvedValue([]);
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
    Barrio.obtenerActivoPorNombre.mockResolvedValue({
      id_barrio: 2,
      nombre: 'Santa Ana',
      activo: true,
      es_cercano: true,
      tiempo_desplazamiento_minutos: null,
    });
    Pedido.colaCocina.mockResolvedValue([]);
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
      distancia_km: 1.5,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [client, payload] = Pedido.crear.mock.calls[0];
    expect(client).toEqual({});
    expect(payload.id_barrio).toBe(2);
    expect(payload.estimacion_inicial).toMatchObject({
      estimatedMinutes: 21,
      source: 'distance',
      zone: 'Santa Ana',
    });
    expect(payload.estimacion_inicial).not.toHaveProperty('idBarrio');
    expect(payload.subtotal).toBe(13000);
    expect(payload.costo_domicilio_cop).toBe(4000);
    expect(payload.total).toBe(17000);
    expect(Pedido.crearDetalle).toHaveBeenCalledWith(client, 22, expect.objectContaining({
      subtotal: 13000,
    }));
  });

  it('resuelve el barrio por nombre y persiste su ID sin cambiar el precio', async () => {
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      nombre_barrio: 'Santa Ana',
      distancia_km: 1.5,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [, payload] = Pedido.crear.mock.calls[0];
    expect(payload.id_barrio).toBe(2);
    expect(payload.subtotal).toBe(13000);
    expect(payload.costo_domicilio_cop).toBe(4000);
    expect(payload.total).toBe(17000);
  });

  it('crea pedidos a más de 5 km con la tarifa máxima de domicilio', async () => {
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      id_barrio: 2,
      distancia_km: 5.1,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [, payload] = Pedido.crear.mock.calls[0];
    expect(payload.costo_domicilio_cop).toBe(8000);
    expect(payload.total).toBe(21000);
  });

  it.each(['local', 'recoger'])('estima solo cocina y no cobra domicilio para pedidos tipo %s', async (tipoEntrega) => {
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      tipo_entrega: tipoEntrega,
      direccion: tipoEntrega === 'local' ? 'Consumo en el local' : 'Recoger en el local',
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [client, payload] = Pedido.crear.mock.calls[0];
    expect(payload).toMatchObject({
      tipo_entrega: tipoEntrega,
      id_barrio: null,
      subtotal: 13000,
      costo_domicilio_cop: 0,
      total: 13000,
      estimacion_inicial: {
        estimatedMinutes: 15,
        deliveryCost: null,
        source: 'kitchen',
        components: {
          kitchenWaitMinutes: 0,
          preparationMinutes: 15,
          travelMinutes: null,
        },
      },
    });
    expect(Barrio.obtenerActivo).not.toHaveBeenCalled();
    expect(Barrio.obtenerActivoPorNombre).not.toHaveBeenCalled();
    expect(Pedido.estadisticasDesplazamiento).not.toHaveBeenCalled();
    expect(Pedido.crearDetalle).toHaveBeenCalledWith(client, 22, expect.any(Object));
  });
});
