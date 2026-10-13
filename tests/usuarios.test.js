process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Sin base de datos: el usuario del token tiene todos los permisos.
jest.mock('../src/models/permiso.model', () => ({ tienePermiso: jest.fn(async () => true) }));
const app = require('../src/app');

const token = jwt.sign({ correo: 'admin@x.co' }, process.env.JWT_SECRET, { subject: '7' });

describe('PATCH /api/usuarios/:id', () => {
  it('no deja que un usuario se desactive a sí mismo', async () => {
    const res = await request(app)
      .patch('/api/usuarios/7')
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'INACTIVO' });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe('No puedes desactivar tu propio usuario');
  });
});
