process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const usuarioValidator = require('../src/validators/usuario.validator');

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

  describe('Validaciones de usuarios', () => {
    const usuarioBase = {
      correo: 'ana@example.com',
      contrasena: 'Fuerte123',
      nombre: 'Ana Pérez',
      tipo_documento: 'Cédula de Ciudadanía',
      documento: '123456',
      roles: ['CLIENTE'],
    };

    it('acepta documentos de 6 caracteres y rechaza documentos fuera del rango de 6 a 10', () => {
      expect(usuarioValidator.crearUsuario.safeParse(usuarioBase).success).toBe(true);
      expect(
        usuarioValidator.crearUsuario.safeParse({ ...usuarioBase, documento: '12345' }).success
      ).toBe(false);
      expect(
        usuarioValidator.crearUsuario.safeParse({ ...usuarioBase, documento: '12345678901' }).success
      ).toBe(false);
    });

    it('no permite Tarjeta de Identidad para roles distintos de Cliente', () => {
      expect(
        usuarioValidator.crearUsuario.safeParse({
          ...usuarioBase,
          contrasena: undefined,
          tipo_documento: 'Tarjeta de Identidad',
          roles: ['EMPLEADO'],
        }).success
      ).toBe(false);
    });
  });
});
