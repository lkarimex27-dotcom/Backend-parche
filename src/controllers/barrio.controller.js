const Barrio = require('../models/barrio.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../errors/AppError');

const listar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await Barrio.listarDisponibles(req.query.buscar) }));
const listarTodos = asyncHandler(async (_req, res) =>
  res.json({ ok: true, data: await Barrio.listarTodos() }));
const crear = asyncHandler(async (req, res) =>
  res.status(201).json({ ok: true, data: await Barrio.crear(req.body) }));
const actualizar = asyncHandler(async (req, res) => {
  const barrio = await Barrio.actualizar(req.params.id, req.body);
  if (!barrio) throw AppError.notFound('Barrio no encontrado');
  res.json({ ok: true, data: barrio });
});

module.exports = { listar, listarTodos, crear, actualizar };
