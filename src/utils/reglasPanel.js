// Reglas de negocio de los módulos del panel que se guardan como fila completa (datos_panel).
// Antes solo las aplicaba la app; ahora también el servidor: `revisar(anterior, nueva)` devuelve el motivo del
// rechazo o null. anterior = null al crear.
const { PEDIDO_MONTO_APROBACION } = require('../config/constants');

const texto = (v) => String(v ?? '').trim();
const anulado = (v) => /^anulad/i.test(texto(v));

// ── Órdenes de producción [8 estado, 14 «Sí» si ya descontó insumos, 15 pedido] ──
const FLUJO_PRODUCCION = ['Recibido', 'Confirmado', 'En cocina', 'Finalizada'];
const PNC = 'Producto no conforme';
// Las viejas terminaban en «En camino» / «Entregado»: equivalen a «Finalizada»
const estadoProduccion = (v) => {
  const e = texto(v) || 'Recibido';
  return ['En camino', 'Entregado'].includes(e) ? 'Finalizada' : e;
};
const rango = (e) => FLUJO_PRODUCCION.indexOf(e);

// viaAvanzar: el cambio llega por POST /ordenes-produccion/:id/avanzar (descuenta insumos en la misma transacción).
// Entrar a «En cocina» o «Finalizada» solo se permite por ahí, para que el stock y el estado no se separen.
const revisarProduccion = (anterior, nueva, { viaAvanzar = false } = {}) => {
  const b = estadoProduccion(nueva[8]);
  if (b !== PNC && rango(b) < 0) return `«${b}» no es un estado de producción.`;
  if (!anterior) return ['Recibido', 'Confirmado'].includes(b) ? null : 'Una orden nueva empieza en «Recibido» o «Confirmado».';
  const a = estadoProduccion(anterior[8]);
  if (a === b) return null;
  if (a === PNC || a === 'Finalizada') {
    return b === PNC && a === 'Finalizada' ? null : `La orden ya está «${a}»; no cambia de estado.`;
  }
  if (b === PNC) return a === 'Recibido' ? 'Una orden que no ha empezado no puede ser producto no conforme.' : null;
  if (rango(b) < rango(a)) return `La orden no puede volver de «${a}» a «${b}».`;
  if (!viaAvanzar && rango(b) >= rango('En cocina')) return 'Pasar a «En cocina» o «Finalizada» se hace con el cambio de estado de la orden (descuenta los insumos).';
  return null;
};

// ── Ventas [8 estado, 14 motivo de anulación] ──
const revisarVenta = (anterior, nueva) => {
  if (!anterior) return anulado(nueva[8]) ? 'Una venta no se registra anulada.' : null;
  if (anulado(anterior[8]) && !anulado(nueva[8])) return 'Una venta anulada no se reactiva: registra una nueva.';
  if (!anulado(anterior[8]) && anulado(nueva[8]) && texto(nueva[14]).length < 5) return 'Escribe el motivo de la anulación (mínimo 5 caracteres).';
  return null;
};

// ── Devoluciones [9 estado, 10 motivo de anulación]: no se editan; solo se anulan, con motivo ──
const revisarDevolucion = (anterior, nueva) => {
  if (!anterior) return null;
  if (anulado(anterior[9]) && !anulado(nueva[9])) return 'Una devolución anulada no se reactiva.';
  // [8] total: las viejas no lo guardaban y la app lo calcula al cargarlas (completarlo no es editar)
  const vacio = (v) => v == null || v === '';
  const cambio = nueva.some((v, i) =>
    ![7, 9, 10].includes(i) && !(i === 8 && vacio(anterior[8])) && !(vacio(v) && vacio(anterior[i])) &&
    JSON.stringify(v ?? null) !== JSON.stringify(anterior[i] ?? null));
  if (cambio) return 'Las devoluciones no se editan. Si hay un error, anúlala y registra una nueva.';
  if (!anulado(anterior[9]) && anulado(nueva[9]) && texto(nueva[10]).length < 5) return 'Escribe el motivo de la anulación (mínimo 5 caracteres).';
  return null;
};

// ── Pedidos creados en el panel [3 tipo, 5 modalidad, 6 total, 7 estado, 8 estado de pago] ──
const FLUJO_PEDIDO = ['Por confirmar', 'Recibido', 'Confirmado', 'En cocina', 'En camino', 'Entregado'];
const FLUJO_PAGO = ['Rechazado', 'Pendiente', 'Pendiente de verificación', 'Abonado', 'Pagado'];
const revisarPedidoPanel = (anterior, nueva) => {
  // Al crearlo (los anteriores a esta regla se siguen pudiendo mover)
  if (!anterior) {
    const total = Number(nueva[6]) || 0;
    return total >= PEDIDO_MONTO_APROBACION && texto(nueva[3]) !== 'Local' && texto(nueva[5]) !== 'Abono 50%'
      ? `Un pedido de $${PEDIDO_MONTO_APROBACION.toLocaleString('es-CO')} o más (que no es en el local) va con abono del 50%.`
      : null;
  }
  const a = texto(anterior[7]) || 'Recibido';
  const b = texto(nueva[7]) || 'Recibido';
  if (a !== b) {
    if (['Entregado', 'Cancelado'].includes(a)) return `El pedido ya está «${a}»; no cambia de estado.`;
    if (b !== 'Cancelado' && FLUJO_PEDIDO.indexOf(b) < FLUJO_PEDIDO.indexOf(a)) return `El pedido no puede volver de «${a}» a «${b}».`;
  }
  const pa = texto(anterior[8]) || 'Pendiente';
  const pb = texto(nueva[8]) || 'Pendiente';
  if (pa !== pb && pa !== 'Rechazado' && FLUJO_PAGO.indexOf(pb) < FLUJO_PAGO.indexOf(pa) && pb !== 'Rechazado') {
    return `El pago no puede volver de «${pa}» a «${pb}».`;
  }
  return null;
};

module.exports = { revisarProduccion, revisarVenta, revisarDevolucion, revisarPedidoPanel, estadoProduccion };
