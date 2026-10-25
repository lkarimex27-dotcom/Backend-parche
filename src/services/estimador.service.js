const PREPARATION_BASE_MINUTES = 15;

const calcularCostoDomicilio = (distanciaKm) => {
  if (distanciaKm === undefined || distanciaKm === null) return null;
  const distancia = Number(distanciaKm);
  if (!Number.isFinite(distancia) || distancia < 0) return null;
  const tarifa = [
    { hastaKm: 2, costoCop: 4000 },
    { hastaKm: 4, costoCop: 6000 },
    { hastaKm: null, costoCop: 8000 },
  ].find((opcion) => opcion.hastaKm === null || distancia <= opcion.hastaKm);
  return tarifa?.costoCop ?? null;
};

const calcular = ({ tipo_entrega = 'domicilio', distancia_km: distanciaKm }) => {
  const esDomicilio = tipo_entrega === 'domicilio';
  const kitchenWaitMinutes = 0;
  const preparationMinutes = PREPARATION_BASE_MINUTES;
  const travelMinutes = esDomicilio && distanciaKm !== undefined
    ? Math.max(1, Math.ceil(Number(distanciaKm) * 4))
    : null;
  const estimatedMinutes = kitchenWaitMinutes + preparationMinutes + (travelMinutes ?? 0);

  return {
    minimumMinutes: null,
    maximumMinutes: null,
    estimatedMinutes,
    estimatedArrival: null,
    deliveryCost: esDomicilio ? calcularCostoDomicilio(distanciaKm) : null,
    zone: null,
    source: travelMinutes === null ? 'kitchen' : 'distance',
    isApproximate: true,
    coverageAvailable: null,
    message: esDomicilio
      ? 'Estimación aproximada de cocina y domicilio; el recorrido puede variar por la ruta y el tráfico.'
      : 'El tiempo estimado incluye únicamente la preparación en cocina.',
    components: {
      kitchenWaitMinutes,
      preparationMinutes,
      dispatchWaitMinutes: null,
      travelMinutes,
    },
    observations: 0,
  };
};

module.exports = { calcular, calcularCostoDomicilio };
