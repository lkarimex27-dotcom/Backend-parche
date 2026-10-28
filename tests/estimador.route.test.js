process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/pedido.model');

const Barrio = require('../src/models/barrio.model');
const Pedido = require('../src/models/pedido.model');
const app = require('../src/app');

const token = jwt.sign({ correo: 'cliente@ejemplo.com' }, process.env.JWT_SECRET, { subject: '7' });

describe('POST /api/pedidos/estimacion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Barrio.obtenerActivo.mockResolvedValue({
      id_barrio: 1,
      nombre: 'Santa Ana',
      activo: true,
      es_cercano: false,
      tiempo_desplazamiento_minutos: 8,
      costo_domicilio_cop: 3500,
    });
    Pedido.cargaCocina.mockResolvedValue(0);
    Pedido.estadisticasDesplazamiento.mockResolvedValue({
      observaciones: 0,
      p25: null,
      mediana: null,
      p75: null,
    });
  });

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

  it('uses the selected neighborhood time and configured delivery cost', async () => {
    const response = await request(app)
      .post('/api/pedidos/estimacion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo_entrega: 'domicilio',
        id_barrio: 1,
        nombre_barrio: 'Santa Ana',
        direccion: 'Calle 1, Barrio Santa Ana',
        distancia_km: 1.5,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      estimatedMinutes: 23,
      deliveryCost: 3500,
      source: 'baseline',
      components: {
        preparationMinutes: 15,
        travelMinutes: 8,
      },
    });
  });
});
