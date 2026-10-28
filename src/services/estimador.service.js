const Barrio = require('../models/barrio.model');

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

// barrio: el barrio de entrega con su tiempo y costo configurados en el módulo Domicilios (si los tiene, mandan)
const calcular = ({ tipo_entrega = 'domicilio', distancia_km: distanciaKm, barrio = null }) => {
  const esDomicilio = tipo_entrega === 'domicilio';
  const kitchenWaitMinutes = 0;
  const preparationMinutes = PREPARATION_BASE_MINUTES;
  const delBarrio = esDomicilio && barrio?.tiempo_desplazamiento_minutos != null;
  const travelMinutes = delBarrio
    ? Number(barrio.tiempo_desplazamiento_minutos)
    : esDomicilio && distanciaKm !== undefined
      ? Math.max(1, Math.ceil(Number(distanciaKm) * 4))
      : null;
  const costoBarrio = esDomicilio && barrio?.costo_domicilio_cop != null ? Number(barrio.costo_domicilio_cop) : null;
  const estimatedMinutes = kitchenWaitMinutes + preparationMinutes + (travelMinutes ?? 0);

  return {
    minimumMinutes: null,
    maximumMinutes: null,
    estimatedMinutes,
    estimatedArrival: null,
    deliveryCost: esDomicilio ? costoBarrio ?? calcularCostoDomicilio(distanciaKm) : null,
    zone: delBarrio ? barrio.nombre : null,
    source: travelMinutes === null ? 'kitchen' : delBarrio ? 'barrio' : 'distance',
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

const sinTildes = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// El barrio elegido en el checkout: por id (de /barrios) o por nombre
const buscarBarrio = async ({ id_barrio: id, nombre_barrio: nombre }) => {
  if (id) return Barrio.obtenerActivo(id);
  if (!nombre) return null;
  return (await Barrio.listarDisponibles(nombre)).find((b) => sinTildes(b.nombre) === sinTildes(nombre)) || null;
};

const estimar = async (datos) =>
  calcular({ ...datos, barrio: datos.tipo_entrega === 'domicilio' ? await buscarBarrio(datos) : null });

module.exports = { calcular, calcularCostoDomicilio, estimar };
