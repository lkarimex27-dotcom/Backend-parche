jest.mock('../src/models/barrio.model');
jest.mock('../src/models/pedido.model');

const Barrio = require('../src/models/barrio.model');
const Pedido = require('../src/models/pedido.model');
const {
  calcular, calcularCostoDomicilio, calcularDistanciaKm, calcularTiempoDomicilio, calcularEsperaCocina, estimar,
} = require('../src/services/estimador.service');

const barrio = (overrides = {}) => ({
  id_barrio: 1,
  nombre: 'Santa Ana',
  activo: true,
  es_cercano: true,
  tiempo_desplazamiento_minutos: null,
  costo_domicilio_cop: 3500,
  ...overrides,
});

describe('estimador de pedidos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calcula el tiempo de domicilio por distancia en línea recta', () => {
    const result = estimar(barrio(), [], { observaciones: 0 }, 1.5);

    expect(result.estimatedMinutes).toBe(21);
    expect(result.deliveryCost).toBe(4000);
    expect(result.minimumMinutes).toBeNull();
    expect(result.maximumMinutes).toBeNull();
    expect(result.deliveryCost).toBe(3500);
    expect(result.costConfigured).toBe(true);
    expect(result.source).toBe('baseline');
    expect(result.isApproximate).toBe(true);
    expect(result.distanceKm).toBe(1.5);
    expect(result.distanceMethod).toBe('straight_line_estimate');
    expect(result.components).toMatchObject({
      kitchenWaitMinutes: 0,
      preparationMinutes: 15,
      travelMinutes: 6,
    });
  });

  it('calcula la distancia desde las coordenadas del domicilio en el backend', () => {
    expect(calcularDistanciaKm({ lat: 6.3295, lon: -75.5627 })).toBe(0);
    expect(calcularDistanciaKm({ lat: 6.3295, lon: -75.5627 + 0.01 })).toBeGreaterThan(1);
    expect(calcularDistanciaKm({ lat: Number.NaN, lon: -75.5627 })).toBeNull();
    expect(calcularDistanciaKm({ lat: 6.3295, lon: 181 })).toBeNull();
    expect(calcularTiempoDomicilio(0)).toBe(1);
    expect(calcularTiempoDomicilio(2.1)).toBe(9);
  });

  it.each([
    [0, 4000], [1, 4000], [2, 4000],
    [2.1, 6000], [2.5, 6000], [4, 6000], [5, 6000],
    [5.1, 8000], [6, 8000], [8, 8000],
    [8.1, 10000], [9, 10000], [11, 10000],
    [11.1, 12000], [12, 12000], [14, 12000],
    [14.1, 14000],
  ])('calcula el costo correcto a %s km', (distancia, costo) => {
    expect(calcularCostoDomicilio(distancia)).toBe(costo);
  });

  it('cobra el tramo adicional por cualquier distancia superior al límite exacto', () => {
    expect(calcularCostoDomicilio(5.000000000001)).toBe(8000);
    expect(calcularCostoDomicilio(8.000000000001)).toBe(10000);
  });

  it('rechaza distancias ausentes, inválidas y costos fuera del rango seguro', () => {
    expect(calcularCostoDomicilio(0)).toBe(4000);
    expect(calcularCostoDomicilio(undefined)).toBeNull();
    expect(calcularCostoDomicilio(null)).toBeNull();
    expect(calcularCostoDomicilio('5')).toBeNull();
    expect(calcularCostoDomicilio(Number.NaN)).toBeNull();
    expect(calcularCostoDomicilio(Number.POSITIVE_INFINITY)).toBeNull();
    expect(calcularCostoDomicilio(-1)).toBeNull();
    expect(calcularCostoDomicilio(Number.MAX_VALUE)).toBeNull();
    expect(calcularTiempoDomicilio(null)).toBeNull();
    expect(calcularTiempoDomicilio('3')).toBeNull();
  });

  it('calcula el tiempo por distancia en barrios sin configuración propia', () => {
    const result = estimar(barrio({ es_cercano: false }), [], { observaciones: 0 }, 3);

    expect(result.estimatedMinutes).toBe(27);
    expect(result.source).toBe('distance');
    expect(result.components.travelMinutes).toBe(12);
  });

  it('no inventa un tiempo de desplazamiento para una zona sin configuración', () => {
    const result = estimar(barrio({ es_cercano: false, costo_domicilio_cop: null }), 0, { observaciones: 0 });

    expect(result.estimatedMinutes).toBeNull();
    expect(result.deliveryCost).toBeNull();
    expect(result.costConfigured).toBe(false);
    expect(result.source).toBe('unavailable');
    expect(result.coverageAvailable).toBe(true);
    expect(result.message).toMatch(/sin una distancia/i);
  });

  it('aproxima la espera por lotes y no agrega preparación completa por cada pedido activo', () => {
    const pedidos = (count) => Array.from({ length: count }, (_, index) => ({
      id_pedido: index + 1,
      estado: 'Recibido',
    }));

    expect(calcularEsperaCocina([])).toBe(0);
    expect(calcularEsperaCocina(pedidos(1))).toBe(0);
    expect(calcularEsperaCocina(pedidos(2))).toBe(15);
    expect(calcularEsperaCocina(pedidos(4))).toBe(30);
    expect(estimar(barrio(), pedidos(4), { observaciones: 0 }, 3)).toMatchObject({
      estimatedMinutes: 57,
      deliveryCost: 6000,
      source: 'distance',
      components: {
        kitchenWaitMinutes: 30,
        preparationMinutes: 15,
        travelMinutes: 12,
      },
    });
  });

  it('estima el tiempo restante de cocina y conserva la cola PEPS', () => {
    const ahora = Date.parse('2026-10-24T12:00:00Z');
    const pedidos = [
      { id_pedido: 1, estado: 'En cocina', inicio_cocina: '2026-10-24T11:52:00Z' },
      { id_pedido: 2, estado: 'Recibido' },
      { id_pedido: 3, estado: 'Confirmado' },
    ];

    expect(calcularEsperaCocina(pedidos, ahora)).toBe(15);
  });

  it('calcula preparación y carga de cocina según unidades, no líneas del pedido', () => {
    const items = [
      { producto: 'Mini', cantidad: 2 },
      { producto: 'Papas', cantidad: 1 },
      { producto: 'Bebida', cantidad: 1 },
    ];
    const result = estimar(barrio(), [], { observaciones: 0 }, 1, items);
    const queue = [
      { id_pedido: 1, estado: 'Recibido', unidades: 2 },
      { id_pedido: 2, estado: 'Recibido', unidades: 1 },
      { id_pedido: 3, estado: 'Cancelado', unidades: 100 },
    ];

    expect(result.estimatedMinutes).toBe(64);
    expect(result.components.preparationMinutes).toBe(60);
    expect(calcularEsperaCocina(queue)).toBe(15);
  });

  it('no descuenta preparación transcurrida cuando falta su marca de inicio', () => {
    const ahora = Date.parse('2026-10-24T12:00:00Z');
    const pedidos = [
      { id_pedido: 1, estado: 'En cocina', inicio_cocina: null },
      { id_pedido: 2, estado: 'En cocina', inicio_cocina: null },
    ];

    expect(calcularEsperaCocina(pedidos, ahora)).toBe(15);
  });

  it('usa percentiles históricos por zona solo con suficientes observaciones', () => {
    const result = estimar(barrio({ es_cercano: false }), 0, {
      observaciones: 5,
      p25: 7.2,
      mediana: 10,
      p75: 13.8,
    });
    expect(result).toMatchObject({
      minimumMinutes: 22,
      estimatedMinutes: 25,
      maximumMinutes: 29,
      source: 'history',
      observations: 5,
    });
  });

  it('prefiere el historial suficiente del barrio para el tiempo de desplazamiento', () => {
    const result = estimar(barrio({ es_cercano: false }), [], {
      observaciones: 5,
      p25: 7,
      mediana: 10,
      p75: 13,
    }, 3);

    expect(result.estimatedMinutes).toBe(25);
    expect(result.source).toBe('history');
    expect(result.deliveryCost).toBe(6000);
    expect(result.distanceKm).toBe(3);
  });

  it('ignora estadísticas insuficientes o inconsistentes y usa el tiempo configurado', () => {
    const result = estimar(barrio({
      es_cercano: false,
      tiempo_desplazamiento_minutos: 12,
    }), 0, {
      observaciones: 4,
      p25: 9,
      mediana: 8,
      p75: 10,
    });

    expect(result.estimatedMinutes).toBe(27);
    expect(result.minimumMinutes).toBeNull();
    expect(result.source).toBe('baseline');
  });

  it('valida el barrio activo antes de consultar carga e historial', async () => {
    Barrio.obtenerActivo.mockResolvedValueOnce(null);

    await expect(calcular(8)).rejects.toThrow('Barrio no encontrado o fuera de cobertura');
    expect(Pedido.colaCocina).not.toHaveBeenCalled();
    expect(Pedido.estadisticasDesplazamiento).not.toHaveBeenCalled();
  });

  it('resuelve por nombre el barrio elegido desde la lista predeterminada', async () => {
    Barrio.obtenerActivoPorNombre.mockResolvedValueOnce(barrio({ id_barrio: 9 }));
    Pedido.colaCocina.mockResolvedValueOnce([]);
    Pedido.estadisticasDesplazamiento.mockResolvedValueOnce({ observaciones: 0 });

    await expect(calcular('Santa Ana')).resolves.toMatchObject({
      idBarrio: 9,
      estimacion: { estimatedMinutes: 20 },
    });
    expect(Pedido.estadisticasDesplazamiento).toHaveBeenCalledWith(9, undefined);
  });
});
