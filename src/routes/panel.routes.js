const { Router } = require('express');
const { z } = require('zod');
const Panel = require('../models/panel.model');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const AppError = require('../errors/AppError');
const { withTransaction } = require('../config/db');
const Pedido = require('../models/pedido.model');
const pedidoEventos = require('../services/pedidoEventos.service');
const Consumo = require('../services/consumo.service');
const Reglas = require('../utils/reglasPanel');

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
    const rechazo = (await cfg.rechazarAlCrear?.(fila)) || cfg.revisar?.(null, fila);
    if (rechazo) throw AppError.conflict(rechazo);
    const id = await Panel.crear(cfg, await cfg.columnas(fila, req.user.id), fila);
    res.status(201).json({ ok: true, data: { id, datos_panel: fila } });
  }));

  router.put('/:id', authorize(cfg.modulo, 'EDITAR'), validate(idParam, 'params'), validate(cuerpo),
    asyncHandler(async (req, res) => {
      const fila = req.body.datos_panel;
      // Reglas del negocio también aquí (no solo en la app): estados que solo avanzan, anulaciones con motivo...
      if (cfg.revisar) {
        const anterior = await Panel.datos(cfg, req.params.id);
        if (!anterior) throw AppError.notFound('Registro no encontrado');
        const rechazo = cfg.revisar(anterior, fila);
        if (rechazo) throw AppError.conflict(rechazo);
      }
      const { id_usuario, ...resto } = await cfg.columnas(fila, req.user.id);
      const columnas = cfg.usuarioEditable ? { id_usuario, ...resto } : resto;
      let pedidoActualizado = null;
      if (cfg.modulo === 'ORDENES_PRODUCCION') {
        const codigoPedido = /^PED-(\d+)$/i.exec(String(fila[15] || fila[0] || '').trim());
        pedidoActualizado = await withTransaction(async (client) => {
          if (!(await Panel.actualizarConCliente(client, cfg, req.params.id, columnas, fila))) {
            throw AppError.notFound('Registro no encontrado');
          }
          if (!codigoPedido || typeof columnas.estado !== 'string') return null;
          return Pedido.actualizarEstadoProduccion(
            client,
            Number(codigoPedido[1]),
            columnas.estado,
            req.user.id
          );
        });
      } else if (!(await Panel.actualizar(cfg, req.params.id, columnas, fila))) {
        throw AppError.notFound('Registro no encontrado');
      }

      if (pedidoActualizado) pedidoEventos.publicarCambioPanel('pedidos');
      if (pedidoActualizado?.id_cliente != null) {
        pedidoEventos.publicarEstadoProduccion({
          idCliente: pedidoActualizado.id_cliente,
          idPedido: pedidoActualizado.id_pedido,
          estado: pedidoActualizado.estado,
          estado_produccion: pedidoActualizado.estado_produccion,
        });
      }
      res.json({ ok: true, data: { id: req.params.id, datos_panel: fila } });
    }));

  // Producción: el cambio de estado, el descuento de insumos (al entrar a cocina) y lo preparado (al finalizar)
  // van en UNA transacción: o pasa todo o nada (antes la app los hacía por separado)
  if (cfg.modulo === 'ORDENES_PRODUCCION') {
    const lista = z.array(z.object({ insumo: z.string().trim().min(1).max(150), cantidad: z.number().positive() })).max(100);
    const avanzar = z.object({ datos_panel: cuerpo.shape.datos_panel, insumos: lista.default([]), productos: lista.default([]) });
    router.post('/:id/avanzar', authorize(cfg.modulo, 'EDITAR'), validate(idParam, 'params'), validate(avanzar),
      asyncHandler(async (req, res) => {
        const { datos_panel: fila, insumos, productos } = req.body;
        const numero = String(fila[0] ?? '').trim();
        const pedido = await withTransaction(async (client) => {
          const anterior = await Panel.datos(cfg, req.params.id, client, true);
          if (!anterior) throw AppError.notFound('Orden de producción no encontrada');
          if (String(anterior[0] ?? '').trim() !== numero) throw AppError.badRequest('El código de la orden no coincide.');
          const rechazo = Reglas.revisarProduccion(anterior, fila, { viaAvanzar: true });
          if (rechazo) throw AppError.conflict(rechazo);
          if (insumos.length) await Consumo.descontarCon(client, { numero_orden: numero, insumos }, req.user.id);
          if (productos.length) await Consumo.ingresarCon(client, { numero_orden: numero, productos }, req.user.id);
          const { id_usuario, ...columnas } = await cfg.columnas(fila, req.user.id);
          await Panel.actualizarConCliente(client, cfg, req.params.id, columnas, fila);
          const codigoPedido = /^PED-(\d+)$/i.exec(String(fila[15] || '').trim());
          return codigoPedido ? Pedido.actualizarEstadoProduccion(client, Number(codigoPedido[1]), columnas.estado, req.user.id) : null;
        });
        if (pedido) pedidoEventos.publicarCambioPanel('pedidos');
        if (pedido?.id_cliente != null) {
          pedidoEventos.publicarEstadoProduccion({
            idCliente: pedido.id_cliente, idPedido: pedido.id_pedido, estado: pedido.estado, estado_produccion: pedido.estado_produccion,
          });
        }
        res.json({ ok: true, data: { id: req.params.id, datos_panel: fila } });
      }));
  }

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
