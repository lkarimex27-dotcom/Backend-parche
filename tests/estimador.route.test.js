process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const token = jwt.sign({ correo: 'cliente@ejemplo.com' }, process.env.JWT_SECRET, { subject: '7' });

describe('POST /api/pedidos/estimacion', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/pedidos/estimacion')
      .send({ tipo_entrega: 'local' });

    expect(response.status).toBe(401);
  });

  it('estimates kitchen time for local orders without requiring a neighborhood', async () => {
    const response = await request(app)
      .post('/api/pedidos/estimacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo_entrega: 'local' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      estimatedMinutes: 15,
      deliveryCost: null,
      source: 'kitchen',
      components: {
        kitchenWaitMinutes: 0,
        preparationMinutes: 15,
        travelMinutes: null,
      },
    });
  });

  it('estimates delivery time and its charge from the address distance', async () => {
    const response = await request(app)
      .post('/api/pedidos/estimacion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo_entrega: 'domicilio',
        nombre_barrio: 'Santa Ana',
        direccion: 'Calle 1, Barrio Santa Ana',
        distancia_km: 1.5,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      estimatedMinutes: 21,
      deliveryCost: 4000,
      source: 'distance',
      components: {
        preparationMinutes: 15,
        travelMinutes: 6,
      },
    });
  });
});
