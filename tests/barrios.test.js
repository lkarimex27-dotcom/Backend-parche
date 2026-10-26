process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const token = jwt.sign({ correo: 'cliente@ejemplo.com' }, process.env.JWT_SECRET, { subject: '7' });

describe('GET /api/barrios', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/barrios');

    expect(response.status).toBe(401);
  });

  it('returns the Bello neighborhood options expected by checkout', async () => {
    const response = await request(app)
      .get('/api/barrios')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data).toContainEqual({
      id_barrio: null,
      nombre: 'Santa Ana',
      costo_domicilio_cop: null,
    });
    expect(response.body.data).toContainEqual({
      id_barrio: null,
      nombre: 'Niquía',
      costo_domicilio_cop: null,
    });
    expect(response.body.data).toHaveLength(18);
  });
});
