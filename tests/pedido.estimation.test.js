jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/insumoProducto.model', () => ({
  gaseosas: jest.fn(),
}));
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
      costo_domicilio_cop: 3500,
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
    Pedido.crearOrdenProduccion.mockResolvedValue(undefined);
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 22 });
  });

  it('almacena el snapshot en la misma transacción sin cambiar los precios del pedido', async () => {
    // Barrio sin tarifa configurada: se cobra por tramos de distancia
    Barrio.obtenerActivo.mockResolvedValueOnce({ id_barrio: 2, nombre: 'Santa Ana', activo: true, es_cercano: true, tiempo_desplazamiento_minutos: null, costo_domicilio_cop: null });
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      id_barrio: 2,
      ubicacion: { lat: 6.3295, lon: -75.55 },
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [client, payload] = Pedido.crear.mock.calls[0];
    expect(client).toEqual({});
    expect(payload.id_barrio).toBe(2);
    expect(payload.estimacion_inicial).toMatchObject({
      source: 'distance',
      zone: 'Santa Ana',
      distanceMethod: 'straight_line_estimate',
    });
    expect(payload.estimacion_inicial).not.toHaveProperty('idBarrio');
    expect(payload.subtotal).toBe(13000);
    expect(payload.costo_domicilio_cop).toBe(4000);
    expect(Pedido.crear.mock.calls[0][1].estimacion_inicial.distanceKm).toBeGreaterThan(1);
    expect(payload.total).toBe(17000);
    expect(Pedido.crearDetalle).toHaveBeenCalledWith(client, 22, expect.objectContaining({
      subtotal: 13000,
    }));
    expect(Pedido.crearOrdenProduccion).toHaveBeenCalledWith(
      client,
      22,
      expect.arrayContaining([expect.objectContaining({ producto: 'Hamburguesa Mini' })]),
      undefined // sin notas del cliente
    );
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
    // Barrio sin tarifa configurada: se cobra por tramos de distancia
    Barrio.obtenerActivo.mockResolvedValueOnce({ id_barrio: 2, nombre: 'Santa Ana', activo: true, es_cercano: true, tiempo_desplazamiento_minutos: null, costo_domicilio_cop: null });
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

  it('aplica la tarifa incremental por distancia y conserva las unidades en la estimación guardada', async () => {
    // Barrio sin tarifa configurada: se cobra por tramos de distancia
    Barrio.obtenerActivo.mockResolvedValueOnce({ id_barrio: 2, nombre: 'Santa Ana', activo: true, es_cercano: true, tiempo_desplazamiento_minutos: null, costo_domicilio_cop: null });
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      id_barrio: 2,
      distancia_km: 8.1,
      costo_domicilio_cop: 1,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 2, salsas: [], adiciones: [] }],
    }, 7);

    const [, payload] = Pedido.crear.mock.calls[0];
    expect(payload.costo_domicilio_cop).toBe(10000);
    expect(payload.total).toBe(36000);
    expect(payload.estimacion_inicial).toMatchObject({
      distanceKm: 8.1,
      distanceMethod: 'straight_line_estimate',
      components: {
        preparationMinutes: 30,
      },
    });
  });

  it('sin distancia cobra la tarifa configurada del barrio', async () => {
    await service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      id_barrio: 2,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7);

    const [, payload] = Pedido.crear.mock.calls[0];
    expect(payload.costo_domicilio_cop).toBe(3500);
    expect(payload.total).toBe(16500);
  });

  it('no crea un pedido cuando el domicilio aún no tiene tarifa configurada', async () => {
    Barrio.obtenerActivo.mockResolvedValueOnce({
      id_barrio: 2,
      nombre: 'Santa Ana',
      activo: true,
      es_cercano: true,
      tiempo_desplazamiento_minutos: null,
      costo_domicilio_cop: null,
    });

    await expect(service.crear({
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Calle 1',
      id_barrio: 2,
      pago: 'Efectivo',
      items: [{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [] }],
    }, 7)).rejects.toThrow('Costo de domicilio por confirmar');

    expect(Pedido.crear).not.toHaveBeenCalled();
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
