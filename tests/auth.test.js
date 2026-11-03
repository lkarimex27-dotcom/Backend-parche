process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const request = require('supertest');
const app = require('../src/app');

// Estas pruebas no necesitan base de datos: la seguridad responde antes de llegar a ella.
describe('Seguridad', () => {
  it.each(['/api/usuarios', '/api/roles', '/api/insumos', '/api/productos', '/api/proveedores', '/api/clientes',
    '/api/compras', '/api/perdidas-insumos', '/api/pedidos', '/api/pedidos/mios', '/api/domicilios', '/api/ventas', '/api/devoluciones',
    '/api/ordenes-produccion', '/api/productos-no-conformes'])(
    'GET %s sin token devuelve 401',
    async (ruta) => {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(401);
    }
  );

  it('POST /api/consumos-produccion sin token devuelve 401 (no descuenta stock)', async () => {
    const res = await request(app).post('/api/consumos-produccion').send({ numero_orden: 'OP-1', insumos: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/productos-no-conformes/con-reposicion sin token devuelve 401', async () => {
    const res = await request(app)
      .post('/api/productos-no-conformes/con-reposicion')
      .send({ producto_no_conforme: [], orden_produccion: [] });
    expect(res.status).toBe(401);
  });

  it('rechaza un token falso', async () => {
    const res = await request(app).get('/api/usuarios').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('login con correo sin arroba devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'no-es-correo.com', contrasena: 'contrasena-valida' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'correo' })])
    );
  });

  it('registro con correo sin arroba devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ correo: 'no-es-correo.com', contrasena: 'contrasena-valida', nombre: 'Ana' });
    expect(res.status).toBe(400);
  });

  it('registro con contraseña corta devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ correo: 'a@b.com', contrasena: '123', nombre: 'Ana' });
    expect(res.status).toBe(400);
  });
});

describe('Recuperar contraseña', () => {
  it('recuperar con correo inválido devuelve 400', async () => {
    const res = await request(app).post('/api/auth/recuperar').send({ correo: 'no-es-correo' });
    expect(res.status).toBe(400);
  });

  it('restablecer exige un PIN validado previamente y una contraseña de 8+', async () => {
    const res = await request(app)
      .post('/api/auth/restablecer')
      .send({ correo: 'ana@correo.com', codigo: '12ab', nueva: 'corta' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'token' }),
        expect.objectContaining({ campo: 'nueva' }),
      ])
    );
  });

  it('verificar recuperación exige un PIN de 6 dígitos', async () => {
    const res = await request(app)
      .post('/api/auth/recuperar/verificar')
      .send({ correo: 'ana@correo.com', codigo: '12ab' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'codigo' })])
    );
  });
});
