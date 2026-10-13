const service = require('../services/compra.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.listar() }));
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) => res.status(201).json({ ok: true, data: await service.crear(req.body) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body) }));
const cambiarEstado = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.cambiarEstado(req.params.id, req.body.estado) }));

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
