const service = require('../services/rol.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.listar() }));
const catalogo = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.catalogo() }));
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) => res.status(201).json({ ok: true, data: await service.crear(req.body) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body) }));
const eliminar = asyncHandler(async (req, res) => {
  await service.eliminar(req.params.id);
  res.status(204).send();
});
const reemplazarPermisos = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.reemplazarPermisos(req.params.id, req.body) }));

module.exports = { listar, catalogo, obtener, crear, actualizar, eliminar, reemplazarPermisos };
