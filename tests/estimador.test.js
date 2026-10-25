jest.mock('../src/models/barrio.model');
jest.mock('../src/models/pedido.model');

const Barrio = require('../src/models/barrio.model');
const Pedido = require('../src/models/pedido.model');
const {
  calcular, calcularCostoDomicilio, calcularTiempoDomicilio, calcularEsperaCocina, estimar,
} = require('../src/services/estimador.service');

const barrio = (overrides = {}) => ({
  id_barrio: 1,
  nombre: 'Santa Ana',
  activo: true,
  es_cercano: true,
  tiempo_desplazamiento_minutos: null,
  ...overrides,
});

describe('estimador de pedidos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calcula el tiempo de domicilio por kilómetros a 15 km/h', () => {
    const result = estimar(barrio(), [], { observaciones: 0 }, 1.5);

    expect(result.estimatedMinutes).toBe(21);
    expect(result.deliveryCost).toBe(4000);
    expect(result.minimumMinutes).toBeNull();
    expect(result.maximumMinutes).toBeNull();
    expect(result.source).toBe('distance');
    expect(result.isApproximate).toBe(true);
    expect(result.components).toMatchObject({
      kitchenWaitMinutes: 0,
      preparationMinutes: 15,
      travelMinutes: 6,
    });
    expect(calcularTiempoDomicilio(0)).toBe(1);
    expect(calcularTiempoDomicilio(2.1)).toBe(9);
  });

  it('calcula domicilio por bandas y conserva la tarifa más alta sin límite de distancia', () => {
    expect(calcularCostoDomicilio(0)).toBe(4000);
    expect(calcularCostoDomicilio(2)).toBe(4000);
    expect(calcularCostoDomicilio(2.01)).toBe(6000);
    expect(calcularCostoDomicilio(4)).toBe(6000);
    expect(calcularCostoDomicilio(4.01)).toBe(8000);
    expect(calcularCostoDomicilio(5)).toBe(8000);
    expect(calcularCostoDomicilio(5.01)).toBe(8000);
    expect(calcularCostoDomicilio(25)).toBe(8000);
    expect(calcularCostoDomicilio(250)).toBe(8000);
    expect(calcularCostoDomicilio(undefined)).toBeNull();
    expect(calcularCostoDomicilio(null)).toBeNull();
  });

  it('calcula el tiempo por distancia en barrios sin configuración propia', () => {
    const result = estimar(barrio({ es_cercano: false }), [], { observaciones: 0 }, 3);

    expect(result.estimatedMinutes).toBe(27);
    expect(result.source).toBe('distance');
    expect(result.components.travelMinutes).toBe(12);
  });

  it('indica que falta distancia solo si no hay tiempo configurado para el barrio', () => {
    const result = estimar(barrio({ es_cercano: false }), 0, { observaciones: 0 });

    expect(result.estimatedMinutes).toBeNull();
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
