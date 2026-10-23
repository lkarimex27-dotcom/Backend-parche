const Barrio = require('../models/barrio.model');
const Pedido = require('../models/pedido.model');
const AppError = require('../errors/AppError');
const { ESTIMADOR } = require('../config/constants');

const minutosValidos = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const enteroMinutos = (value) => Math.max(1, Math.round(Number(value)));

const calcularEsperaCocina = (pedidosActivos) => {
  const capacidad = ESTIMADOR.CAPACIDAD_COCINA_PEDIDOS;
  const pedidos = Math.max(0, Math.floor(Number(pedidosActivos) || 0));
  return Math.floor(pedidos / capacidad) * ESTIMADOR.PREPARACION_BASE_MINUTOS;
};

const estimar = (barrio, pedidosActivos, estadisticas) => {
  const observaciones = Math.max(0, Number.parseInt(estadisticas?.observaciones, 10) || 0);
  const historialSuficiente = observaciones >= ESTIMADOR.MIN_OBSERVACIONES_ZONA
    && minutosValidos(estadisticas.p25)
    && minutosValidos(estadisticas.mediana)
    && minutosValidos(estadisticas.p75)
    && Number(estadisticas.p25) <= Number(estadisticas.mediana)
    && Number(estadisticas.mediana) <= Number(estadisticas.p75);
  const tiempoConfigurado = barrio.tiempo_desplazamiento_minutos
    ?? (barrio.es_cercano ? ESTIMADOR.DESPLAZAMIENTO_CERCANO_MINUTOS : null);
  const desplazamiento = historialSuficiente ? Number(estadisticas.mediana) : Number(tiempoConfigurado);
  const esperaCocinaMinutos = calcularEsperaCocina(pedidosActivos);
  const preparacionMinutos = ESTIMADOR.PREPARACION_BASE_MINUTOS;
  const zona = barrio.nombre;
  const deliveryCost = barrio.costo_domicilio_cop == null
    ? null
    : Number(barrio.costo_domicilio_cop);

  if (!minutosValidos(desplazamiento)) {
    return {
      minimumMinutes: null,
      maximumMinutes: null,
      estimatedMinutes: null,
      estimatedArrival: null,
      zone: zona,
      deliveryCost,
      costConfigured: deliveryCost !== null,
      source: 'unavailable',
      isApproximate: true,
      coverageAvailable: true,
      message: 'Tiempo por confirmar para este barrio.',
      components: {
        kitchenWaitMinutes: esperaCocinaMinutos,
        preparationMinutes: preparacionMinutos,
        dispatchWaitMinutes: null,
        travelMinutes: null,
      },
      observations: observaciones,
    };
  }

  const travel = enteroMinutos(desplazamiento);
  const common = esperaCocinaMinutos + preparacionMinutos;
  const estimatedMinutes = common + travel;
  const minimumMinutes = historialSuficiente
    ? common + enteroMinutos(estadisticas.p25)
    : null;
  const maximumMinutes = historialSuficiente
    ? common + enteroMinutos(estadisticas.p75)
    : null;

  return {
    minimumMinutes,
    maximumMinutes,
    estimatedMinutes,
    estimatedArrival: null,
    zone: zona,
    deliveryCost,
    costConfigured: deliveryCost !== null,
    source: historialSuficiente ? 'history' : 'baseline',
    isApproximate: true,
    coverageAvailable: true,
    message: historialSuficiente
      ? 'El desplazamiento usa historial; preparación y carga de cocina son aproximadas.'
      : 'Estimación aproximada: se usan los tiempos iniciales configurados.',
    components: {
      kitchenWaitMinutes: esperaCocinaMinutos,
      preparationMinutes: preparacionMinutos,
      dispatchWaitMinutes: null,
      travelMinutes: travel,
    },
    observations: observaciones,
  };
};

const calcular = async (idBarrio, c) => {
  const barrio = await Barrio.obtenerActivo(idBarrio, c, Boolean(c));
  if (!barrio) throw AppError.notFound('Barrio no encontrado o fuera de cobertura');
  const [pedidosActivos, estadisticas] = await Promise.all([
    Pedido.cargaCocina(c),
    Pedido.estadisticasDesplazamiento(idBarrio, c),
  ]);
  return estimar(barrio, pedidosActivos, estadisticas);
};

module.exports = { calcular, calcularEsperaCocina, estimar };
