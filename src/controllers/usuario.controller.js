const service = require('../services/usuario.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.listar(req.query) }));
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) => res.status(201).json({ ok: true, data: await service.crear(req.body) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body, req.user.id) }));

const listarClientes = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.listar({ ...req.query, rol: 'CLIENTE' }) }));
const obtenerCliente = asyncHandler(async (req, res) => {
  const usuario = await service.obtener(req.params.id);
  if (!usuario.roles.includes('CLIENTE')) {
    return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado' });
  }
  return res.json({ ok: true, data: usuario });
});
const eliminar = asyncHandler(async (req, res) => {
  await service.eliminar(req.params.id, req.user.id);
  res.status(204).send();
});

module.exports = { listar, obtener, crear, actualizar, eliminar, listarClientes, obtenerCliente };
