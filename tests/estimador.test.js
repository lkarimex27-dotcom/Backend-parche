jest.mock('../src/models/barrio.model');
jest.mock('../src/models/pedido.model');

const Barrio = require('../src/models/barrio.model');
const Pedido = require('../src/models/pedido.model');
const { calcular, calcularEsperaCocina, estimar } = require('../src/services/estimador.service');

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

  it('combina la preparación y el desplazamiento inicial de una zona cercana validada', () => {
    const result = estimar(barrio(), 0, { observaciones: 0 });

    expect(result.estimatedMinutes).toBe(20);
    expect(result.minimumMinutes).toBeNull();
    expect(result.maximumMinutes).toBeNull();
    expect(result.source).toBe('baseline');
    expect(result.isApproximate).toBe(true);
  });

  it('no inventa un tiempo de desplazamiento para una zona sin configuración', () => {
    const result = estimar(barrio({ es_cercano: false }), 0, { observaciones: 0 });

    expect(result.estimatedMinutes).toBeNull();
    expect(result.source).toBe('unavailable');
    expect(result.coverageAvailable).toBe(true);
    expect(result.message).toMatch(/por confirmar/i);
  });

  it('aproxima la espera por lotes y no agrega preparación completa por cada pedido activo', () => {
    expect(calcularEsperaCocina(1)).toBe(0);
    expect(calcularEsperaCocina(2)).toBe(15);
    expect(calcularEsperaCocina(4)).toBe(30);
    expect(estimar(barrio(), 4, { observaciones: 0 }).estimatedMinutes).toBe(50);
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
    expect(Pedido.cargaCocina).not.toHaveBeenCalled();
    expect(Pedido.estadisticasDesplazamiento).not.toHaveBeenCalled();
  });
});
