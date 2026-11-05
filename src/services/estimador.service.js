const Barrio = require('../models/barrio.model');
const Pedido = require('../models/pedido.model');
const { ESTIMADOR } = require('../config/constants');
const AppError = require('../errors/AppError');

const calcularDistanciaKm = (ubicacion) => {
  if (!ubicacion || typeof ubicacion !== 'object') return null;
  const lat = Number(ubicacion.lat);
  const lon = Number(ubicacion.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const toRad = (valor) => (valor * Math.PI) / 180;
  const dLat = toRad(ESTIMADOR.LOCAL_LATITUD - lat);
  const dLon = toRad(ESTIMADOR.LOCAL_LONGITUD - lon);
  const lat1 = toRad(lat);
  const lat2 = toRad(ESTIMADOR.LOCAL_LATITUD);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distanciaKm = 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number(distanciaKm.toFixed(3));
};

const calcularTiempoDomicilio = (distanciaKm) => {
  const distancia = Number(distanciaKm);
  if (!Number.isFinite(distancia) || distancia < 0) return null;
  return Math.max(1, Math.ceil(distancia * ESTIMADOR.MINUTOS_DOMICILIO_POR_KM));
};

const calcularCostoDomicilio = (distanciaKm) => {
  const distancia = Number(distanciaKm);
  if (!Number.isFinite(distancia) || distancia < 0) return null;
  if (distancia <= 2) return ESTIMADOR.TARIFA_DOMICILIO_HASTA_DOS_KM_COP;
  if (distancia <= 5) return ESTIMADOR.TARIFA_DOMICILIO_BASE_COP;
  const tramosAdicionales = Math.max(0, Math.ceil((distancia - 5) / ESTIMADOR.TARIFA_DOMICILIO_KM_POR_TRAMO));
  return ESTIMADOR.TARIFA_DOMICILIO_BASE_COP + tramosAdicionales * ESTIMADOR.TARIFA_DOMICILIO_COP_POR_TRAMO;
};

const calcularTiempoPreparacion = (items = []) => {
  if (!Array.isArray(items)) return ESTIMADOR.PREPARACION_BASE_MINUTOS;
  const totalUnidades = items.reduce((suma, item) => suma + (Number(item?.cantidad) || 0), 0);
  return totalUnidades > 0 ? totalUnidades * ESTIMADOR.PREPARACION_BASE_MINUTOS : ESTIMADOR.PREPARACION_BASE_MINUTOS;
};

const calcularEsperaCocina = (pedidosActivos, ahora = Date.now()) => {
  const pedidos = Array.isArray(pedidosActivos) ? pedidosActivos : [];
  const activos = pedidos.filter((pedido) => (
    pedido &&
    ['Recibido', 'Confirmado', 'En cocina'].includes(pedido.estado) &&
    pedido.estado !== 'Cancelado' &&
    pedido.estado !== 'Entregado'
  ));
  const cola = Math.max(0, activos.length - 1);
  return Math.ceil(cola / ESTIMADOR.CAPACIDAD_COCINA_PEDIDOS) * ESTIMADOR.PREPARACION_BASE_MINUTOS;
};

const estimarSinDomicilio = (pedidosActivos = 0, items = []) => {
  const cocinaEspera = calcularEsperaCocina(pedidosActivos);
  const preparacion = calcularTiempoPreparacion(items);
  const estimatedMinutes = cocinaEspera + preparacion;

  return {
    minimumMinutes: null,
    maximumMinutes: null,
    estimatedMinutes,
    estimatedArrival: null,
    deliveryCost: null,
    costConfigured: false,
    zone: null,
    source: 'kitchen',
    isApproximate: false,
    coverageAvailable: null,
    message: 'El tiempo estimado incluye únicamente la preparación en cocina.',
    components: {
      kitchenWaitMinutes: cocinaEspera,
      preparationMinutes: preparacion,
      dispatchWaitMinutes: 0,
      travelMinutes: null,
    },
    observations: 0,
  };
};

const estimar = (barrio, pedidosActivos = 0, historial = {}, distanciaKm, items = []) => {
  if (!barrio && (distanciaKm === undefined || distanciaKm === null)) {
    return estimarSinDomicilio(pedidosActivos, items);
  }

  const cocinaEspera = calcularEsperaCocina(pedidosActivos);
  const preparacion = calcularTiempoPreparacion(items);
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

  const distancia = Number(distanciaKm);
  const usaDistancia = Number.isFinite(distancia) && distancia >= 0;

  const desplazamiento = historialValido
    ? Math.round(percentiles[1])
    : usaDistancia
      ? calcularTiempoDomicilio(distancia)
      : barrio?.tiempo_desplazamiento_minutos ?? (barrio?.es_cercano ? ESTIMADOR.DESPLAZAMIENTO_CERCANO_MINUTOS : null);

  const costo = usaDistancia ? calcularCostoDomicilio(distancia) : barrio?.costo_domicilio_cop ?? null;
  const source = historialValido
    ? 'history'
    : usaDistancia
      ? 'distance'
      : barrio && (barrio.costo_domicilio_cop !== null || barrio.tiempo_desplazamiento_minutos !== null || barrio.es_cercano)
        ? 'baseline'
        : 'unavailable';

  const tiempoDisponible = desplazamiento !== null && desplazamiento !== undefined;
  const tiempoEstimado = tiempoDisponible ? cocinaEspera + preparacion + desplazamiento : null;

  return {
    minimumMinutes: historialValido && tiempoDisponible ? cocinaEspera + preparacion + Math.round(percentiles[0]) : null,
    maximumMinutes: historialValido && tiempoDisponible ? cocinaEspera + preparacion + Math.round(percentiles[2]) : null,
    estimatedMinutes: tiempoEstimado,
    estimatedArrival: null,
    deliveryCost: costo,
    costConfigured: costo !== null,
    zone: barrio?.nombre ?? null,
    source,
    isApproximate: !historialValido && !usaDistancia,
    coverageAvailable: !!barrio,
    message: !barrio && !usaDistancia
      ? 'El tiempo estimado incluye únicamente la preparación en cocina.'
      : !barrio
        ? 'Selecciona un barrio de entrega.'
        : desplazamiento === null
          ? 'Sin una distancia o tiempo configurado para este barrio.'
          : historialValido
            ? null
            : 'Estimación aproximada según la configuración del barrio.',
    components: {
      kitchenWaitMinutes: cocinaEspera,
      preparationMinutes: preparacion,
      dispatchWaitMinutes: 0,
      travelMinutes: desplazamiento,
    },
    observations: observaciones,
    distanceKm: usaDistancia ? distancia : null,
    distanceMethod: usaDistancia ? 'straight_line_estimate' : null,
  };
};

const calcular = async (idBarrio, c, barrioConfigurado, tipoEntrega = 'domicilio', distanciaKm, ubicacion) => {
  if (tipoEntrega !== 'domicilio') {
    const pedidosActivos = await Pedido.colaCocina(c);
    return estimar(null, pedidosActivos, {}, undefined, []);
  }
  if (!idBarrio) return estimar(null, 0, {}, distanciaKm, []);

  let barrio = barrioConfigurado;
  if (typeof idBarrio === 'string' && Number.isNaN(Number(idBarrio))) {
    barrio = barrio || await Barrio.obtenerActivoPorNombre(idBarrio, c);
    if (!barrio) throw AppError.badRequest('Barrio no encontrado o fuera de cobertura');
    idBarrio = barrio.id_barrio;
  } else {
    barrio = barrio || await Barrio.obtenerActivo(idBarrio, c);
    if (!barrio) throw AppError.badRequest('Barrio no encontrado o fuera de cobertura');
  }

  const distancia = distanciaKm ?? (ubicacion ? calcularDistanciaKm(ubicacion) : undefined);
  const [pedidosActivos, historial] = await Promise.all([
    Pedido.colaCocina(c),
    Pedido.estadisticasDesplazamiento(idBarrio, c),
  ]);

  return estimar(barrio, pedidosActivos, historial, distancia, []);
};

module.exports = {
  calcular,
  calcularCostoDomicilio,
  calcularTiempoDomicilio,
  calcularEsperaCocina,
  calcularDistanciaKm,
  calcularTiempoPreparacion,
  estimar,
  estimarSinDomicilio,
};
