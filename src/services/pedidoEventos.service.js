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
