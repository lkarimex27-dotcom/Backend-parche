// req.tipo lo fija el router según el módulo (INSUMO o PRODUCTO).
const service = require('../services/insumoProducto.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.listar(req.tipo, req.query) }));
const obtener = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.obtener(req.tipo, req.params.id) }));
const crear = asyncHandler(async (req, res) =>
  res.status(201).json({ ok: true, data: await service.crear(req.tipo, req.body) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.tipo, req.params.id, req.body) }));
const eliminar = asyncHandler(async (req, res) => {
  await service.eliminar(req.tipo, req.params.id);
  res.status(204).send();
});

module.exports = { listar, obtener, crear, actualizar, eliminar };
