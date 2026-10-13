const service = require('../services/usuario.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.listar(req.query) }));
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) => res.status(201).json({ ok: true, data: await service.crear(req.body) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body, req.user.id) }));
const desactivar = asyncHandler(async (req, res) => {
  await service.desactivar(req.params.id, req.user.id);
  res.status(204).send();
});

module.exports = { listar, obtener, crear, actualizar, desactivar };
