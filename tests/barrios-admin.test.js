process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: el permiso y los barrios se simulan
jest.mock('../src/models/permiso.model', () => ({
  tienePermiso: jest.fn(async () => true),
  permisosDeUsuario: jest.fn(async () => []),
}));
jest.mock('../src/models/barrio.model', () => ({
  listarTodos: jest.fn(async () => [
    { id_barrio: 55, nombre: 'Niquía', activo: true, es_cercano: false, tiempo_desplazamiento_minutos: 30, costo_domicilio_cop: 5000 },
  ]),
  actualizar: jest.fn(async (id, d) => ({ id_barrio: Number(id), nombre: 'Niquía', ...d })),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Barrio = require('../src/models/barrio.model');
const Permiso = require('../src/models/permiso.model');

const token = jwt.sign({ correo: 'admin@minifood.com' }, process.env.JWT_SECRET, { subject: '1' });

describe('Módulo Domicilios (/api/barrios/admin)', () => {
  it('devuelve cada barrio con su tiempo estimado y su costo de domicilio', async () => {
    const res = await request(app).get('/api/barrios/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ nombre: 'Niquía', tiempo_desplazamiento_minutos: 30, costo_domicilio_cop: 5000 });
    expect(Permiso.tienePermiso).toHaveBeenCalledWith(1, 'BARRIOS', 'VER');
  });

  it('edita el costo y el tiempo de un barrio', async () => {
    const res = await request(app)
      .patch('/api/barrios/admin/55')
      .set('Authorization', `Bearer ${token}`)
      .send({ costo_domicilio_cop: 6000, tiempo_desplazamiento_minutos: 25 });
    expect(res.status).toBe(200);
    expect(Barrio.actualizar).toHaveBeenCalledWith(55, { costo_domicilio_cop: 6000, tiempo_desplazamiento_minutos: 25 });
  });

  it('sin permiso responde 403', async () => {
    Permiso.tienePermiso.mockResolvedValueOnce(false);
    const res = await request(app).get('/api/barrios/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
