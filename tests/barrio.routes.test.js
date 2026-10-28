jest.mock('../src/middlewares/auth.middleware', () => ({
  authenticate: (_req, _res, next) => next(),
  authorize: () => (_req, _res, next) => next(),
}));
jest.mock('../src/controllers/barrio.controller', () => ({
  listar: (_req, res) => res.json({ ok: true, data: [] }),
  listarTodos: (_req, res) => res.json({ ok: true, data: [] }),
  crear: (req, res) => res.status(201).json({ ok: true, data: req.body }),
  actualizar: (req, res) => res.json({ ok: true, data: { id: req.params.id, ...req.body } }),
}));

const express = require('express');
const request = require('supertest');
const barrioRoutes = require('../src/routes/barrio.routes');

const app = express();
app.use(express.json());
app.use('/api/barrios', barrioRoutes);

describe('rutas administrativas del catálogo de barrios', () => {
  it('crea barrios en la ruta compatible con el panel', async () => {
    await request(app)
      .post('/api/barrios/admin')
      .send({ nombre: 'Santa Ana' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          ok: true,
          data: {
            nombre: 'Santa Ana',
            activo: false,
            es_cercano: false,
            tiempo_desplazamiento_minutos: null,
          },
        });
      });
  });

  it('edita barrios en la ruta compatible con el panel', async () => {
    await request(app)
      .patch('/api/barrios/admin/12')
      .send({ activo: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true, data: { id: 12, activo: true } });
      });
  });

  it('mantiene disponibles las rutas existentes de creación y edición', async () => {
    await request(app)
      .post('/api/barrios')
      .send({ nombre: 'Centro' })
      .expect(201);

    await request(app)
      .patch('/api/barrios/3')
      .send({ es_cercano: true })
      .expect(200);
  });
});
