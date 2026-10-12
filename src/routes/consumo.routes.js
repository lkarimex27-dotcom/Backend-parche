const router = require('express').Router();
const { z } = require('zod');
const service = require('../services/consumo.service');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const consumo = z.object({
  numero_orden: z.string().trim().min(1).max(50),
  insumos: z
    .array(z.object({ insumo: z.string().trim().min(1).max(150), cantidad: z.number().positive() }))
    .min(1)
    .max(100),
});

// POST /api/consumos-produccion  { numero_orden, insumos: [{ insumo, cantidad }] }
router.post('/', authenticate, authorize('ORDENES_PRODUCCION', 'EDITAR'), validate(consumo),
  asyncHandler(async (req, res) => {
    await service.descontar(req.body, req.user.id);
    res.status(201).json({ ok: true, data: req.body });
  }));

module.exports = router;
