const service = require('../services/pedido.service');
const eventos = require('../services/pedidoEventos.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.listar() }));
const listarMios = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.listarMios(req.user.id) }));
const eventosMios = (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': conectado\n\n');

  const detenerEscucha = eventos.alCambiarEstadoProduccion((evento) => {
    if (String(evento.idCliente) !== String(req.user.id)) return;
    res.write(`event: estado-produccion\ndata: ${JSON.stringify({
      id_pedido: evento.idPedido,
      estado: evento.estado,
      estado_produccion: evento.estado_produccion,
    })}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    detenerEscucha();
  });
};
const obtener = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.obtener(req.params.id) }));
const crear = asyncHandler(async (req, res) =>
  res.status(201).json({ ok: true, data: await service.crear(req.body, req.user.id) }));
const subirComprobante = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.subirComprobante(req.params.id, req.body.comprobante, req.user.id) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.params.id, req.body, req.user.id) }));

module.exports = { listar, listarMios, eventosMios, obtener, crear, subirComprobante, actualizar };
