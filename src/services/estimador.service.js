const Barrio = require('../models/barrio.model');
const Pedido = require('../models/pedido.model');
const AppError = require('../errors/AppError');
const { ESTIMADOR } = require('../config/constants');

const minutosValidos = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const enteroMinutos = (value) => Math.max(1, Math.round(Number(value)));

const calcularCostoDomicilio = (distanciaKm) => {
  if (distanciaKm === undefined || distanciaKm === null || distanciaKm === '') return null;
  const distancia = Number(distanciaKm);
  if (!Number.isFinite(distancia) || distancia < 0) return null;
  return ESTIMADOR.TARIFAS_DOMICILIO.find(
    (tarifa) => tarifa.hastaKm === null || distancia <= tarifa.hastaKm,
  )?.costoCop ?? null;
};

const calcularTiempoDomicilio = (distanciaKm) => {
  const distancia = Number(distanciaKm);
  if (!Number.isFinite(distancia) || distancia < 0) return null;
  return Math.max(1, Math.ceil(distancia * ESTIMADOR.MINUTOS_DOMICILIO_POR_KM));
};

const calcularEsperaCocina = (pedidosActivos, ahora = Date.now()) => {
  const capacidad = Math.max(1, Math.floor(Number(ESTIMADOR.CAPACIDAD_COCINA_PEDIDOS) || 1));
  const pedidos = Array.isArray(pedidosActivos) ? pedidosActivos : [];
  const espacios = Array.from({ length: capacidad }, () => 0);
  const asignar = (duracion) => {
    const indice = espacios.indexOf(Math.min(...espacios));
    espacios[indice] += duracion;
  };

  const enCocina = pedidos
    .filter((pedido) => pedido.estado === 'En cocina')
    .sort((a, b) => new Date(a.inicio_cocina || a.creado_en).getTime()
      - new Date(b.inicio_cocina || b.creado_en).getTime());
  const pendientes = pedidos.filter((pedido) => pedido.estado !== 'En cocina');

  for (const pedido of enCocina) {
    const inicio = pedido.inicio_cocina ? new Date(pedido.inicio_cocina).getTime() : NaN;
    const transcurrido = Number.isFinite(inicio) ? Math.max(0, (ahora - inicio) / 60_000) : 0;
    asignar(Math.max(0, ESTIMADOR.PREPARACION_BASE_MINUTOS - transcurrido));
  }
  for (const _pedido of pendientes) asignar(ESTIMADOR.PREPARACION_BASE_MINUTOS);

  return Math.ceil(Math.min(...espacios));
};

const estimar = (barrio, pedidosActivos, estadisticas, distanciaKm) => {
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
  const desplazamiento = tiempoPorDistancia
    ?? (historialSuficiente ? Number(estadisticas.mediana) : Number(tiempoConfigurado));
  const source = tiempoPorDistancia !== null
    ? 'distance'
    : historialSuficiente
      ? 'history'
      : 'baseline';
  const esperaCocinaMinutos = calcularEsperaCocina(pedidosActivos);
  const preparacionMinutos = ESTIMADOR.PREPARACION_BASE_MINUTOS;
  const zona = barrio.nombre;
  const deliveryCost = calcularCostoDomicilio(distanciaKm);

  if (!minutosValidos(desplazamiento)) {
    return {
      minimumMinutes: null,
      maximumMinutes: null,
      estimatedMinutes: null,
      estimatedArrival: null,
      deliveryCost,
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
    zone: zona,
    source,
    isApproximate: true,
    coverageAvailable: true,
    message: tiempoPorDistancia !== null
      ? 'El tiempo de domicilio se estima a 15 km/h según la distancia en línea recta; puede variar por la ruta y el tráfico.'
      : historialSuficiente
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

const estimarSinDomicilio = (pedidosActivos) => {
  const kitchenWaitMinutes = calcularEsperaCocina(pedidosActivos);
  const preparationMinutes = ESTIMADOR.PREPARACION_BASE_MINUTOS;

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

const calcular = async (identificadorBarrio, c, distanciaKm, tipoEntrega = 'domicilio') => {
  if (tipoEntrega !== 'domicilio') {
    return {
      idBarrio: null,
      estimacion: estimarSinDomicilio(await Pedido.colaCocina(c)),
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
  return {
    idBarrio: barrio.id_barrio,
    estimacion: estimar(barrio, pedidosActivos, estadisticas, distanciaKm),
  };
};

module.exports = {
  calcular, calcularCostoDomicilio, calcularTiempoDomicilio, calcularEsperaCocina, estimar,
  estimarSinDomicilio,
};
