jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((callback) => callback({})),
}));
jest.mock('../src/models/panel.model', () => ({
  actualizarConCliente: jest.fn(async () => true),
}));
jest.mock('../src/models/pedido.model', () => ({
  actualizarEstadoProduccion: jest.fn(async (_client, idPedido, estadoProduccion) => ({
    id_pedido: idPedido,
    id_cliente: 7,
    estado: 'En cocina',
    estado_produccion: estadoProduccion,
  })),
}));
jest.mock('../src/services/pedidoEventos.service', () => ({
  publicarEstadoProduccion: jest.fn(),
  publicarCambioPanel: jest.fn(),
  alCambiarEstadoProduccion: jest.fn(),
}));
jest.mock('../src/middlewares/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 5 };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const Panel = require('../src/models/panel.model');
const Pedido = require('../src/models/pedido.model');
const pedidoEventos = require('../src/services/pedidoEventos.service');
const panelRoutes = require('../src/routes/panel.routes');
const pedidoController = require('../src/controllers/pedido.controller');

const cfg = {
  modulo: 'ORDENES_PRODUCCION',
  id: 'id_orden_produccion',
  columnas: (fila) => ({ numero_orden: fila[0], estado: fila[8] }),
};
const app = express();
app.use(express.json());
app.use('/ordenes-produccion', panelRoutes(cfg));

describe('Cambios de estado de producción para pedidos de clientes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('actualiza el estado del pedido vinculado y publica el evento al cliente', async () => {
    const response = await request(app)
      .put('/ordenes-produccion/12')
      .send({ datos_panel: ['PED-0030', '', '', 1, '2026-11-03', '', '', '', 'Confirmado'] });
    expect(response.status).toBe(200);

    expect(Panel.actualizarConCliente).toHaveBeenCalledWith(
      expect.anything(),
      cfg,
      12,
      { numero_orden: 'PED-0030', estado: 'Confirmado' },
      ['PED-0030', '', '', 1, '2026-11-03', '', '', '', 'Confirmado']
    );
    expect(Pedido.actualizarEstadoProduccion).toHaveBeenCalledWith({}, 30, 'Confirmado', 5);
    expect(pedidoEventos.publicarEstadoProduccion).toHaveBeenCalledWith({
      idCliente: 7,
      idPedido: 30,
      estado: 'En cocina',
      estado_produccion: 'Confirmado',
    });
  });

  it('no envía evento si el código no corresponde a un pedido de cliente', async () => {
    const response = await request(app)
      .put('/ordenes-produccion/12')
      .send({ datos_panel: ['OP-0030', '', '', 1, '2026-11-03', '', '', '', 'Confirmado'] });
    expect(response.status).toBe(200);

    expect(Pedido.actualizarEstadoProduccion).not.toHaveBeenCalled();
    expect(pedidoEventos.publicarEstadoProduccion).not.toHaveBeenCalled();
  });

  it('envía el evento SSE solo al cliente propietario del pedido', () => {
    let publicar;
    pedidoEventos.alCambiarEstadoProduccion.mockImplementation((listener) => {
      publicar = listener;
      return jest.fn();
    });
    const req = { user: { id: 7 }, on: jest.fn() };
    const res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
    };

    pedidoController.eventosMios(req, res);
    publicar({
      idCliente: 8,
      idPedido: 30,
      estado: 'En cocina',
      estado_produccion: 'Confirmado',
    });
    publicar({
      idCliente: '7',
      idPedido: 30,
      estado: 'En cocina',
      estado_produccion: 'Confirmado',
    });

    expect(res.write).toHaveBeenCalledTimes(2);
    expect(res.write).toHaveBeenLastCalledWith(
      'event: estado-produccion\ndata: {"id_pedido":30,"estado":"En cocina","estado_produccion":"Confirmado"}\n\n'
    );
    req.on.mock.calls.find(([evento]) => evento === 'close')[1]();
  });
});
