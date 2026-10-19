const { Router } = require('express');
const { z } = require('zod');
const Panel = require('../models/panel.model');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const AppError = require('../errors/AppError');

const idParam = z.object({ id: z.coerce.number().int().positive() });
// Fila del panel: textos (pueden ser JSON largos: historial, líneas), números o vacíos
const cuerpo = z.object({
  datos_panel: z.array(z.union([z.string().max(100_000), z.number(), z.null()])).min(1).max(40),
});

// Fábrica: panelRoutes(require('../config/panel.modulos').ventas) -> /api/ventas
// Al crear, id_usuario = quien registra (o lo que diga la config); al editar se conserva salvo usuarioEditable.
module.exports = (cfg) => {
  const router = Router();
  router.use(authenticate);

  router.get('/', authorize(cfg.modulo, 'VER'), asyncHandler(async (_req, res) => {
    const registros = await Panel.listar(cfg);
    res.json({ ok: true, data: registros });
  }));

  router.post('/', authorize(cfg.modulo, 'CREAR'), validate(cuerpo), asyncHandler(async (req, res) => {
    const fila = req.body.datos_panel;
    if (cfg.unico) {
      const v = String(fila[cfg.unico.posicion] ?? '').trim();
      if (!cfg.unico.ignorar.includes(v) && (await Panel.existe(cfg, cfg.unico.columna, v))) throw AppError.conflict(cfg.unico.mensaje);
    }
    const id = await Panel.crear(cfg, await cfg.columnas(fila, req.user.id), fila);
    res.status(201).json({ ok: true, data: { id, datos_panel: fila } });
  }));

  router.put('/:id', authorize(cfg.modulo, 'EDITAR'), validate(idParam, 'params'), validate(cuerpo),
    asyncHandler(async (req, res) => {
      const fila = req.body.datos_panel;
      const { id_usuario, ...resto } = await cfg.columnas(fila, req.user.id);
      const columnas = cfg.usuarioEditable ? { id_usuario, ...resto } : resto;
      if (!(await Panel.actualizar(cfg, req.params.id, columnas, fila))) throw AppError.notFound('Registro no encontrado');
      res.json({ ok: true, data: { id: req.params.id, datos_panel: fila } });
    }));

  if (cfg.borrar) {
    router.delete('/:id', authorize(cfg.modulo, 'ELIMINAR'), validate(idParam, 'params'), asyncHandler(async (req, res) => {
      if (cfg.borrarSi) {
        const actual = await Panel.valor(cfg, req.params.id, cfg.borrarSi.columna);
        if (actual === null) throw AppError.notFound('Registro no encontrado');
        if (actual !== cfg.borrarSi.valor) throw AppError.conflict(cfg.borrarSi.mensaje);
      }
      if (!(await Panel.eliminar(cfg, req.params.id))) throw AppError.notFound('Registro no encontrado');
      res.status(204).send();
    }));
  }
  return router;
};
