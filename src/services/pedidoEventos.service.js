const { EventEmitter } = require('node:events');

const eventos = new EventEmitter();

const publicarEstadoProduccion = ({ idCliente, idPedido, estado, estado_produccion }) => {
  eventos.emit('estado-produccion', { idCliente, idPedido, estado, estado_produccion });
};

const alCambiarEstadoProduccion = (listener) => {
  eventos.on('estado-produccion', listener);
  return () => eventos.off('estado-produccion', listener);
};

module.exports = { publicarEstadoProduccion, alCambiarEstadoProduccion };

// Avisos al panel: «pedidos» o «clientes» cambiaron (sin datos; el panel los vuelve a pedir)
const panel = new EventEmitter();
panel.setMaxListeners(0);
const publicarCambioPanel = (modulo) => panel.emit('cambio', modulo);
const alCambiarPanel = (listener) => {
  panel.on('cambio', listener);
  return () => panel.off('cambio', listener);
};

module.exports.publicarCambioPanel = publicarCambioPanel;
module.exports.alCambiarPanel = alCambiarPanel;
