process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: los barrios activos se simulan
jest.mock('../src/models/barrio.model', () => ({
  listarDisponibles: jest.fn(async () => [
    { id_barrio: 14, nombre: 'Santa Ana', es_cercano: true, tiempo_desplazamiento_minutos: 10, costo_domicilio_cop: 3000 },
    { id_barrio: 13, nombre: 'Niquía', es_cercano: false, tiempo_desplazamiento_minutos: 25, costo_domicilio_cop: 6000 },
  ]),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const token = jwt.sign({ correo: 'cliente@ejemplo.com' }, process.env.JWT_SECRET, { subject: '7' });

describe('GET /api/barrios', () => {
  it('is public: a guest also sees the delivery cost of each neighborhood', async () => {
    const response = await request(app).get('/api/barrios');

    expect(response.status).toBe(200);
  });

  it('returns the active neighborhoods with their delivery time and cost for checkout', async () => {
    const response = await request(app)
      .get('/api/barrios')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data).toContainEqual(expect.objectContaining({
      id_barrio: 14,
      nombre: 'Santa Ana',
      tiempo_desplazamiento_minutos: 10,
      costo_domicilio_cop: 3000,
    }));
  });
});
