process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const request = require('supertest');

// Sin base de datos: el servicio devuelve un producto activo con datos internos (costo, stock) y uno inactivo.
jest.mock('../src/services/insumoProducto.service', () => ({
  listar: jest.fn(async () => [
    {
      id_insumo_producto: 1, nombre: 'Mini', descripcion: 'Rica', etiqueta: 'Favorita', precio: 13000,
      nombre_categoria: 'Hamburguesas', imagenes: ['https://x/img.jpg'], costo: 5000, stock: 10, tipo: 'PRODUCTO',
      estado: 'ACTIVO',
    },
    { id_insumo_producto: 2, nombre: 'Vieja', precio: 1, nombre_categoria: 'Hamburguesas', imagenes: [], estado: 'INACTIVO' },
  ]),
}));
const app = require('../src/app');

describe('GET /api/catalogo', () => {
  it('es público, solo trae activos y no expone costo ni stock', async () => {
    const res = await request(app).get('/api/catalogo');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{
      id: 1, nombre: 'Mini', descripcion: 'Rica', etiqueta: 'Favorita', precio: 13000,
      categoria: 'Hamburguesas', imagenes: ['https://x/img.jpg'],
    }]);
  });
});
