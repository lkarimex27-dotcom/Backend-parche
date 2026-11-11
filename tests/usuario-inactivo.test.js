process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Un token vigente de un usuario desactivado no sirve para hacer pedidos
let mockEstado = 'INACTIVO';
jest.mock('../src/models/usuario.model', () => ({ obtenerEstado: jest.fn(async () => mockEstado) }));
jest.mock('../src/controllers/pedido.controller', () => new Proxy({}, { get: () => (_req, res) => res.status(201).json({ ok: true }) }));
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');

const token = jwt.sign({ correo: 'ana@x.com' }, process.env.JWT_SECRET, { subject: '7' });
const pedido = { items: [{ producto: 'Hamburguesa', cantidad: 1 }] };

describe('POST /api/pedidos con usuario inactivo', () => {
  it('responde 403 aunque el token sea válido', async () => {
    mockEstado = 'INACTIVO';
    const res = await request(app).post('/api/pedidos').set('Authorization', `Bearer ${token}`).send(pedido);
    expect(res.status).toBe(403);
    expect(res.body.mensaje || res.body.message || JSON.stringify(res.body)).toMatch(/inactivo/);
  });

  it('un usuario activo pasa el chequeo', async () => {
    mockEstado = 'ACTIVO';
    const res = await request(app).post('/api/pedidos').set('Authorization', `Bearer ${token}`).send(pedido);
    expect(res.status).not.toBe(403);
  });
});
