const router = require('express').Router();
const { z } = require('zod');
const Stock = require('../models/stock.model');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const ver = [authenticate, authorize('INSUMOS', 'VER')];

// GET /api/movimientos-stock/descuadres  insumos cuyo stock no es la suma de sus movimientos (debería ser [])
router.get('/descuadres', ...ver, asyncHandler(async (_req, res) => res.json({ ok: true, data: await Stock.descuadres() })));

// GET /api/movimientos-stock/:id  historial de un insumo (los 50 más recientes)
router.get('/:id', ...ver, validate(z.object({ id: z.coerce.number().int().positive() }), 'params'),
  asyncHandler(async (req, res) => res.json({ ok: true, data: await Stock.movimientos(req.params.id) })));

module.exports = router;
