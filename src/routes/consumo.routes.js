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

const entrada = z.object({
  numero_orden: z.string().trim().min(1).max(40),
  productos: z
    .array(z.object({ insumo: z.string().trim().min(1).max(150), cantidad: z.number().positive() }))
    .min(1)
    .max(100),
});

// POST /api/consumos-produccion/entrada  { numero_orden, productos: [{ insumo, cantidad }] }
// Lo preparado de un producto de insumo entra a su stock al terminar la orden (una vez por orden)
router.post('/entrada', authenticate, authorize('ORDENES_PRODUCCION', 'EDITAR'), validate(entrada),
  asyncHandler(async (req, res) => {
    const sumado = await service.ingresar(req.body, req.user.id);
    res.status(sumado ? 201 : 200).json({ ok: true, data: { ...req.body, sumado } });
  }));

module.exports = router;
