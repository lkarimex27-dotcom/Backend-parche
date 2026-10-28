const Barrio = require('../models/barrio.model');
const Pedido = require('../models/pedido.model');
const AppError = require('../errors/AppError');
const { ESTIMADOR } = require('../config/constants');

const minutosValidos = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const enteroMinutos = (value) => Math.max(1, Math.round(Number(value)));

const calcularDistanciaKm = (ubicacion) => {
  if (
    !ubicacion
    || !Number.isFinite(ubicacion.lat)
    || !Number.isFinite(ubicacion.lon)
    || ubicacion.lat < -90
    || ubicacion.lat > 90
    || ubicacion.lon < -180
    || ubicacion.lon > 180
  ) return null;

  const radianes = (grados) => (grados * Math.PI) / 180;
  const latitudOrigen = radianes(ESTIMADOR.LOCAL_LATITUD);
  const latitudDestino = radianes(ubicacion.lat);
  const diferenciaLatitud = radianes(ubicacion.lat - ESTIMADOR.LOCAL_LATITUD);
  const diferenciaLongitud = radianes(ubicacion.lon - ESTIMADOR.LOCAL_LONGITUD);
  const haversine = Math.sin(diferenciaLatitud / 2) ** 2
    + Math.cos(latitudOrigen) * Math.cos(latitudDestino) * Math.sin(diferenciaLongitud / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, haversine)));
};

const calcularCostoDomicilio = (distanciaKm) => {
  if (typeof distanciaKm !== 'number' || !Number.isFinite(distanciaKm) || distanciaKm < 0) return null;
  if (distanciaKm <= ESTIMADOR.TARIFA_DOMICILIO_HASTA_KM) {
    return ESTIMADOR.TARIFA_DOMICILIO_HASTA_DOS_KM_COP;
  }
  if (distanciaKm <= ESTIMADOR.TARIFA_DOMICILIO_HASTA_CINCO_KM) {
    return ESTIMADOR.TARIFA_DOMICILIO_BASE_COP;
  }
  const tramosAdicionales = Math.ceil(
    (distanciaKm - ESTIMADOR.TARIFA_DOMICILIO_HASTA_CINCO_KM)
      / ESTIMADOR.TARIFA_DOMICILIO_KM_POR_TRAMO,
  );
  const costo = ESTIMADOR.TARIFA_DOMICILIO_BASE_COP
    + tramosAdicionales * ESTIMADOR.TARIFA_DOMICILIO_COP_POR_TRAMO;
  return Number.isSafeInteger(costo) ? costo : null;
};

const calcularTiempoDomicilio = (distanciaKm) => {
  if (typeof distanciaKm !== 'number' || !Number.isFinite(distanciaKm) || distanciaKm < 0) return null;
  return Math.max(1, Math.ceil(distanciaKm * ESTIMADOR.MINUTOS_DOMICILIO_POR_KM));
};

const calcularEsperaCocina = (pedidosActivos, ahora = Date.now()) => {
  const capacidad = Math.max(1, Math.floor(Number(ESTIMADOR.CAPACIDAD_COCINA_PEDIDOS) || 1));
  const pedidos = Array.isArray(pedidosActivos) ? pedidosActivos : [];
  const espacios = Array.from({ length: capacidad }, () => 0);
  const asignar = (duracion) => {
    const indice = espacios.indexOf(Math.min(...espacios));
    espacios[indice] += duracion;
  };

  const activos = pedidos.filter((pedido) =>
    ['Recibido', 'Confirmado', 'En cocina', 'Por confirmar'].includes(pedido.estado));
  const enCocina = activos
    .filter((pedido) => pedido.estado === 'En cocina')
    .sort((a, b) => new Date(a.inicio_cocina || a.creado_en).getTime()
      - new Date(b.inicio_cocina || b.creado_en).getTime());
  const pendientes = activos.filter((pedido) => pedido.estado !== 'En cocina');
  const duracionPedido = (pedido) => {
    const unidades = Number(pedido.unidades ?? 1);
    if (!Number.isFinite(unidades) || unidades < 0) return 0;
    return unidades * ESTIMADOR.PREPARACION_BASE_MINUTOS;
  };

  for (const pedido of enCocina) {
    const inicio = pedido.inicio_cocina ? new Date(pedido.inicio_cocina).getTime() : NaN;
    const transcurrido = Number.isFinite(inicio) ? Math.max(0, (ahora - inicio) / 60_000) : 0;
    asignar(Math.max(0, duracionPedido(pedido) - transcurrido));
  }
  for (const pedido of pendientes) asignar(duracionPedido(pedido));

  return Math.ceil(Math.min(...espacios));
};

const calcularTiempoPreparacion = (items) => {
  const lineas = items === undefined ? [{ cantidad: 1 }] : Array.isArray(items) ? items : [];
  const unidades = lineas.reduce((total, item) => {
    const cantidad = Number(item.cantidad);
    return total + (Number.isSafeInteger(cantidad) && cantidad > 0 ? cantidad : 0);
  }, 0);
  return unidades * ESTIMADOR.PREPARACION_BASE_MINUTOS;
};

const distanciaValida = (distanciaKm) =>
  typeof distanciaKm === 'number' && Number.isFinite(distanciaKm) && distanciaKm >= 0;

const estimar = (barrio, pedidosActivos, estadisticas, distanciaKm, items) => {
  const observaciones = Math.max(0, Number.parseInt(estadisticas?.observaciones, 10) || 0);
  const historialSuficiente = observaciones >= ESTIMADOR.MIN_OBSERVACIONES_ZONA
    && minutosValidos(estadisticas.p25)
    && minutosValidos(estadisticas.mediana)
    && minutosValidos(estadisticas.p75)
    && Number(estadisticas.p25) <= Number(estadisticas.mediana)
    && Number(estadisticas.mediana) <= Number(estadisticas.p75);
  const tiempoConfigurado = barrio.tiempo_desplazamiento_minutos
    ?? (barrio.es_cercano ? ESTIMADOR.DESPLAZAMIENTO_CERCANO_MINUTOS : null);
  const tiempoPorDistancia = calcularTiempoDomicilio(distanciaKm);
  const desplazamiento = historialSuficiente
    ? Number(estadisticas.mediana)
    : tiempoPorDistancia ?? Number(tiempoConfigurado);
  const source = historialSuficiente ? 'history' : tiempoPorDistancia !== null ? 'distance' : 'baseline';
  const esperaCocinaMinutos = calcularEsperaCocina(pedidosActivos);
  const preparacionMinutos = calcularTiempoPreparacion(items);
  const zona = barrio.nombre;
  const deliveryCost = calcularCostoDomicilio(distanciaKm);
  const distanceKm = distanciaValida(distanciaKm) ? distanciaKm : null;

  if (!minutosValidos(desplazamiento)) {
    return {
      minimumMinutes: null,
      maximumMinutes: null,
      estimatedMinutes: null,
      estimatedArrival: null,
      deliveryCost,
      distanceKm,
      distanceMethod: distanceKm === null ? null : 'straight_line_estimate',
      zone: zona,
      source: 'unavailable',
      isApproximate: true,
      coverageAvailable: true,
      message: 'No se pudo calcular el domicilio sin una distancia o un tiempo configurado para el barrio.',
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
    deliveryCost,
    distanceKm,
    distanceMethod: distanceKm === null ? null : 'straight_line_estimate',
    zone: zona,
    source,
    isApproximate: true,
    coverageAvailable: true,
    message: historialSuficiente
      ? 'El desplazamiento usa el historial válido de entregas de este barrio; preparación y carga de cocina son aproximadas.'
      : tiempoPorDistancia !== null
      ? 'El tiempo de domicilio se estima a 15 km/h según la distancia aproximada en línea recta; puede variar por la ruta y el tráfico.'
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

const estimarSinDomicilio = (pedidosActivos, items) => {
  const kitchenWaitMinutes = calcularEsperaCocina(pedidosActivos);
  const preparationMinutes = calcularTiempoPreparacion(items);

  return {
    minimumMinutes: null,
    maximumMinutes: null,
    estimatedMinutes: kitchenWaitMinutes + preparationMinutes,
    estimatedArrival: null,
    deliveryCost: null,
    zone: null,
    source: 'kitchen',
    isApproximate: true,
    coverageAvailable: null,
    message: 'El tiempo estimado incluye únicamente la espera y preparación en cocina.',
    components: {
      kitchenWaitMinutes,
      preparationMinutes,
      dispatchWaitMinutes: null,
      travelMinutes: null,
    },
    observations: 0,
  };
};

const calcular = async (identificadorBarrio, c, distanciaKm, tipoEntrega = 'domicilio', items, ubicacion) => {
  if (tipoEntrega !== 'domicilio') {
    return {
      idBarrio: null,
      estimacion: estimarSinDomicilio(await Pedido.colaCocina(c), items),
    };
  }

  const porId = typeof identificadorBarrio === 'number' || /^\d+$/.test(String(identificadorBarrio));
  const barrio = porId
    ? await Barrio.obtenerActivo(Number(identificadorBarrio), c, Boolean(c))
    : await Barrio.obtenerActivoPorNombre(String(identificadorBarrio), c, Boolean(c));
  if (!barrio) throw AppError.notFound('Barrio no encontrado o fuera de cobertura');
  const [pedidosActivos, estadisticas] = await Promise.all([
    Pedido.colaCocina(c),
    Pedido.estadisticasDesplazamiento(barrio.id_barrio, c),
  ]);
  const distanciaCalculada = ubicacion === undefined ? distanciaKm : calcularDistanciaKm(ubicacion);
  return {
    idBarrio: barrio.id_barrio,
    estimacion: estimar(barrio, pedidosActivos, estadisticas, distanciaCalculada, items),
  };
};

module.exports = {
  calcular, calcularCostoDomicilio, calcularTiempoDomicilio, calcularEsperaCocina,
  calcularDistanciaKm, calcularTiempoPreparacion, estimar,
  estimarSinDomicilio,
};
