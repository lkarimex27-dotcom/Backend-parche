process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: el modelo genérico del panel se simula
const estados = { 1: 'Recibida', 2: 'Iniciada' };
jest.mock('../src/models/panel.model', () => ({
  valor: jest.fn(async (_cfg, id) => estados[id] ?? null),
  eliminar: jest.fn(async () => true),
}));
jest.mock('../src/middlewares/auth.middleware', () => ({
  authenticate: (_req, _res, next) => next(),
  authorize: () => (_req, _res, next) => next(),
}));
const express = require('express');
const request = require('supertest');
const Panel = require('../src/models/panel.model');
const panelRoutes = require('../src/routes/panel.routes');
const { ordenes_produccion } = require('../src/config/panel.modulos');
const { errorHandler } = require('../src/middlewares/error.middleware');

const app = express();
app.use('/ordenes', panelRoutes(ordenes_produccion));
app.use(errorHandler);

describe('Eliminar una orden de producción', () => {
  beforeEach(() => jest.clearAllMocks());

  it('se elimina si está Recibida', async () => {
    await request(app).delete('/ordenes/1').expect(204);
    expect(Panel.eliminar).toHaveBeenCalled();
  });

  it('no se elimina si ya empezó', async () => {
    const res = await request(app).delete('/ordenes/2').expect(409);
    expect(res.body.message || res.body.error || JSON.stringify(res.body)).toMatch(/Recibida/);
    expect(Panel.eliminar).not.toHaveBeenCalled();
  });
});
