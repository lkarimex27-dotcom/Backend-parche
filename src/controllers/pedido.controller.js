const service = require('../services/pedido.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.listar() }));
const listarMios = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.listarMios(req.user.id) }));
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) =>
  res.status(201).json({ ok: true, data: await service.crear(req.body, req.user.id) }));
const subirComprobante = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.subirComprobante(req.params.id, req.body.comprobante, req.user.id) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body, req.user.id) }));

module.exports = { listar, listarMios, obtener, crear, subirComprobante, actualizar };
