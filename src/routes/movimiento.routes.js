const router = require('express').Router();
const { z } = require('zod');
const Stock = require('../models/stock.model');
const Proyeccion = require('../services/proyeccion.service');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const ver = [authenticate, authorize('INSUMOS', 'VER')];

// GET /api/movimientos-stock/descuadres  insumos cuyo stock no es la suma de sus movimientos (debería ser [])
router.get('/descuadres', ...ver, asyncHandler(async (_req, res) => res.json({ ok: true, data: await Stock.descuadres() })));

// GET /api/movimientos-stock/proyeccion?dias=15  cuánto comprar de cada insumo para cubrir N días (solo lectura)
router.get('/proyeccion', ...ver, validate(z.object({ dias: z.coerce.number().int().min(1).max(90).default(15) }), 'query'),
  asyncHandler(async (req, res) => res.json({ ok: true, data: await Proyeccion.proyectar(req.query.dias) })));

// GET /api/movimientos-stock/:id  historial de un insumo (los 50 más recientes)
router.get('/:id', ...ver, validate(z.object({ id: z.coerce.number().int().positive() }), 'params'),
  asyncHandler(async (req, res) => res.json({ ok: true, data: await Stock.movimientos(req.params.id) })));

module.exports = router;
