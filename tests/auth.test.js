process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const request = require('supertest');
const app = require('../src/app');

// Estas pruebas no necesitan base de datos: la seguridad responde antes de llegar a ella.
describe('Seguridad', () => {
  it.each(['/api/usuarios', '/api/roles', '/api/insumos', '/api/productos', '/api/proveedores', '/api/clientes'])(
    'GET %s sin token devuelve 401',
    async (ruta) => {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(401);
    }
  );

  it('rechaza un token falso', async () => {
    const res = await request(app).get('/api/usuarios').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('login con cuerpo inválido devuelve 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ correo: 'no-es-correo' });
    expect(res.status).toBe(400);
  });

  it('registro con contraseña corta devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ correo: 'a@b.com', contrasena: '123', nombre: 'Ana' });
    expect(res.status).toBe(400);
  });
});
