process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/permiso.model');

const Barrio = require('../src/models/barrio.model');
const Permiso = require('../src/models/permiso.model');
const app = require('../src/app');

const token = jwt.sign({ correo: 'admin@ejemplo.com' }, process.env.JWT_SECRET, { subject: '7' });
const barrio = {
  id_barrio: 2,
  nombre: 'Santa Ana',
  municipio: 'Bello',
  departamento: 'Antioquia',
  activo: true,
  es_cercano: true,
  tiempo_desplazamiento_minutos: null,
  costo_domicilio_cop: 3500,
};

describe('/api/barrios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Permiso.tienePermiso.mockResolvedValue(true);
    Barrio.listarDisponibles.mockResolvedValue([{
      id_barrio: barrio.id_barrio,
      nombre: barrio.nombre,
      costo_domicilio_cop: barrio.costo_domicilio_cop,
    }]);
    Barrio.listarTodos.mockResolvedValue([barrio]);
    Barrio.crear.mockResolvedValue(barrio);
    Barrio.actualizar.mockResolvedValue(barrio);
    Barrio.desactivar.mockResolvedValue({ id_barrio: barrio.id_barrio });
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/barrios');
    expect(response.status).toBe(401);
  });

  it('returns active configured neighborhoods to checkout', async () => {
    const response = await request(app)
      .get('/api/barrios')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: [{
        id_barrio: 2,
        nombre: 'Santa Ana',
        costo_domicilio_cop: 3500,
      }],
    });
    expect(Barrio.listarDisponibles).toHaveBeenCalledWith(undefined);
  });

  it('passes a partial name search to the neighborhood catalog', async () => {
    const response = await request(app)
      .get('/api/barrios?buscar=ana')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Barrio.listarDisponibles).toHaveBeenCalledWith('ana');
  });

  it('exposes protected list, create, update and soft-delete operations to administrators', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const list = await request(app).get('/api/barrios/admin').set(auth);
    const created = await request(app).post('/api/barrios/admin').set(auth).send({
      nombre: 'Santa Ana',
      activo: true,
      es_cercano: true,
      tiempo_desplazamiento_minutos: null,
      costo_domicilio_cop: 3500,
    });
    const updated = await request(app).patch('/api/barrios/admin/2').set(auth).send({
      costo_domicilio_cop: 4000,
    });
    const deleted = await request(app).delete('/api/barrios/admin/2').set(auth);

    expect(list.status).toBe(200);
    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(Permiso.tienePermiso).toHaveBeenCalledWith(7, 'BARRIOS', 'CREAR');
    expect(Barrio.desactivar).toHaveBeenCalledWith(2);
  });
});
