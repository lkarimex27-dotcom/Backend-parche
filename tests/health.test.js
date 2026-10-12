const request = require('supertest');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('responde ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('devuelve 404 en rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
  });
});
