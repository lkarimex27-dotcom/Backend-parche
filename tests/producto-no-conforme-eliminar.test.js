process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

jest.mock('../src/models/panel.model', () => ({
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
const { productos_no_conformes } = require('../src/config/panel.modulos');
const { errorHandler } = require('../src/middlewares/error.middleware');

const app = express();
app.use('/productos-no-conformes', panelRoutes(productos_no_conformes));
app.use(errorHandler);

describe('Eliminar un producto no conforme', () => {
  beforeEach(() => jest.clearAllMocks());

  it('elimina el registro por su id', async () => {
    await request(app).delete('/productos-no-conformes/6').expect(204);
    expect(Panel.eliminar).toHaveBeenCalledWith(productos_no_conformes, 6);
  });
});
