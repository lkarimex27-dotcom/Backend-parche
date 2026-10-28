const Barrio = require('../models/barrio.model');
const Pedido = require('../models/pedido.model');
const { ESTIMADOR } = require('../config/constants');
const AppError = require('../errors/AppError');

const calcularEsperaCocina = (pedidosActivos) =>
  Math.ceil(Math.max(0, Number(pedidosActivos) - 1) / ESTIMADOR.CAPACIDAD_COCINA_PEDIDOS) *
  ESTIMADOR.PREPARACION_BASE_MINUTOS;

const estimar = (barrio, pedidosActivos = 0, historial = {}, tipoEntrega = 'domicilio') => {
  const esDomicilio = tipoEntrega === 'domicilio';
  const cocinaEspera = calcularEsperaCocina(pedidosActivos);
  const preparacion = ESTIMADOR.PREPARACION_BASE_MINUTOS;
  const observaciones = Number(historial.observaciones) || 0;
  const percentilesRaw = [historial.p25, historial.mediana, historial.p75];
  const percentiles = percentilesRaw.map(Number);
  const historialValido =
    observaciones >= ESTIMADOR.MIN_OBSERVACIONES_ZONA &&
    percentilesRaw.every((value) => value !== null && value !== undefined) &&
    percentiles.every(Number.isFinite) &&
    percentiles[0] >= 0 &&
    percentiles[0] <= percentiles[1] &&
    percentiles[1] <= percentiles[2];
  const desplazamiento = !esDomicilio
    ? null
    : historialValido
      ? Math.round(percentiles[1])
      : barrio?.tiempo_desplazamiento_minutos ??
        (barrio?.es_cercano ? ESTIMADOR.DESPLAZAMIENTO_CERCANO_MINUTOS : null);
  const tieneBarrio = !!barrio;
  const tiempoDisponible = !esDomicilio || (tieneBarrio && desplazamiento !== null);
  const tiempoEstimado = tiempoDisponible
    ? cocinaEspera + preparacion + (desplazamiento ?? 0)
    : null;
  const costo = esDomicilio ? barrio?.costo_domicilio_cop ?? null : null;

  return {
    minimumMinutes: esDomicilio && tiempoDisponible && historialValido
      ? cocinaEspera + preparacion + Math.round(percentiles[0])
      : null,
    maximumMinutes: esDomicilio && tiempoDisponible && historialValido
      ? cocinaEspera + preparacion + Math.round(percentiles[2])
      : null,
    estimatedMinutes: tiempoEstimado,
    estimatedArrival: null,
    deliveryCost: costo,
    costConfigured: !esDomicilio || costo !== null,
    zone: barrio?.nombre ?? null,
    source: !esDomicilio
      ? 'kitchen'
      : !tieneBarrio || !tiempoDisponible
        ? 'unavailable'
        : historialValido
          ? 'history'
          : 'baseline',
    isApproximate: esDomicilio && !historialValido,
    coverageAvailable: esDomicilio ? tieneBarrio : null,
    message: !esDomicilio
      ? 'El tiempo estimado incluye únicamente la preparación en cocina.'
      : !tieneBarrio
      ? 'Selecciona un barrio de entrega.'
      : !tiempoDisponible
        ? 'Tiempo de domicilio por confirmar para este barrio.'
        : historialValido
          ? null
          : 'Estimación aproximada según la configuración del barrio.',
    components: {
      kitchenWaitMinutes: cocinaEspera,
      preparationMinutes: preparacion,
      dispatchWaitMinutes: 0,
      travelMinutes: tiempoDisponible ? desplazamiento : null,
    },
    observations: observaciones,
  };
};

const calcular = async (idBarrio, c, barrioConfigurado, tipoEntrega = 'domicilio') => {
  if (tipoEntrega !== 'domicilio') {
    const pedidosActivos = await Pedido.cargaCocina(c);
    return estimar(null, pedidosActivos, {}, tipoEntrega);
  }
  if (!idBarrio) return estimar(null);
  const barrio = barrioConfigurado || await Barrio.obtenerActivo(idBarrio, c);
  if (!barrio) throw AppError.badRequest('Barrio no encontrado o fuera de cobertura');
  const [pedidosActivos, historial] = await Promise.all([
    Pedido.cargaCocina(c),
    Pedido.estadisticasDesplazamiento(idBarrio, c),
  ]);
  return estimar(barrio, pedidosActivos, historial);
};

module.exports = { calcular, calcularEsperaCocina, estimar };
