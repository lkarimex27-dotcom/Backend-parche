process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: el modelo genérico del panel se simula
const mockConVenta = new Set(['PED-6']);
jest.mock('../src/models/panel.model', () => ({
  existe: jest.fn(async (_cfg, _col, v) => mockConVenta.has(v)),
  crear: jest.fn(async () => 99),
}));
jest.mock('../src/config/db', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../src/middlewares/auth.middleware', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 1 }; next(); },
  authorize: () => (_req, _res, next) => next(),
}));
const express = require('express');
const request = require('supertest');
const Panel = require('../src/models/panel.model');
const panelRoutes = require('../src/routes/panel.routes');
const { ventas } = require('../src/config/panel.modulos');
const { errorHandler } = require('../src/middlewares/error.middleware');

const app = express();
app.use(express.json());
app.use('/ventas', panelRoutes(ventas));
app.use(errorHandler);
const fila = (pedido) => ['VTA-1', 'Admin', 'Ana', '2026-10-17', 'Online', 'Efectivo', 100, 100, 'Pendiente', pedido];

describe('Una venta por pedido', () => {
  beforeEach(() => jest.clearAllMocks());
  it('no crea otra venta para un pedido que ya la tiene', async () => {
    await request(app).post('/ventas').send({ datos_panel: fila('PED-6') }).expect(409);
    expect(Panel.crear).not.toHaveBeenCalled();
  });
  it('sí crea la venta de un pedido nuevo y las ventas sin pedido', async () => {
    await request(app).post('/ventas').send({ datos_panel: fila('PED-10') }).expect(201);
    await request(app).post('/ventas').send({ datos_panel: fila('Sin pedido') }).expect(201);
    expect(Panel.crear).toHaveBeenCalledTimes(2);
  });
});
