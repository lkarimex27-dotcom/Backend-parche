const Domicilio = require('../models/domicilio.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');

const listar = () => Domicilio.listar();

const obtener = async (id, c, bloquear = false) => {
  const domicilio = await Domicilio.obtenerPorPedido(id, c, bloquear);
  if (!domicilio) throw AppError.notFound('Domicilio no encontrado');
  return domicilio;
};

const crear = async (d) => {
  await withTransaction(async (c) => {
    const pedido = await Domicilio.obtenerPedidoParaCrear(c, d.id_pedido);
    if (!pedido) throw AppError.notFound('Pedido no encontrado');
    if (!pedido.id_cliente) throw AppError.badRequest('El domicilio debe pertenecer a un pedido de cliente');
    if (pedido.direccion_entrega?.trim()) {
      throw AppError.conflict('El pedido ya tiene un domicilio registrado');
    }
    await Domicilio.crear(c, d.id_pedido, d);
  });
  return obtener(d.id_pedido);
};

const actualizar = async (id, d) => {
  await withTransaction(async (c) => {
    await obtener(id, c, true);
    await Domicilio.actualizar(c, id, d);
  });
  return obtener(id);
};

const eliminar = async (id) => {
  await withTransaction(async (c) => {
    await obtener(id, c, true);
    await Domicilio.eliminar(c, id);
  });
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
