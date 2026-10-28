process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: Santa Ana tiene tiempo y costo en el módulo Domicilios; Niquía todavía no
jest.mock('../src/models/barrio.model', () => {
  const mockBarrios = [
    { id_barrio: 14, nombre: 'Santa Ana', tiempo_desplazamiento_minutos: 10, costo_domicilio_cop: 3000 },
    { id_barrio: 13, nombre: 'Niquía', tiempo_desplazamiento_minutos: null, costo_domicilio_cop: null },
  ];
  return {
    obtenerActivo: jest.fn(async (id) => mockBarrios.find((b) => b.id_barrio === Number(id)) || null),
    listarDisponibles: jest.fn(async (buscar) => mockBarrios.filter((b) => b.nombre.includes(buscar))),
  };
});

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

  it('uses the time and cost configured for the chosen neighborhood', async () => {
    const response = await request(app)
      .post('/api/pedidos/estimacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo_entrega: 'domicilio', id_barrio: 14, distancia_km: 1.5 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      estimatedMinutes: 25,
      deliveryCost: 3000,
      source: 'barrio',
      zone: 'Santa Ana',
      components: { preparationMinutes: 15, travelMinutes: 10 },
    });
  });

  it('estimates delivery time and its charge from the address distance', async () => {
    const response = await request(app)
      .post('/api/pedidos/estimacion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo_entrega: 'domicilio',
        nombre_barrio: 'Niquía',
        direccion: 'Calle 1, Barrio Niquía',
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
