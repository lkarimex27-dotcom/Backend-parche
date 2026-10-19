const service = require('../services/perdida.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.listar() }));
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) =>
  res.status(201).json({ ok: true, data: await service.crear(req.body, req.user.id) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body) }));

const devolver = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.devolver(req.params.id, req.body) }));

module.exports = { listar, obtener, crear, actualizar, devolver };
