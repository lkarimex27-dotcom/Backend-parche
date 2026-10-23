process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const request = require('supertest');

// Sin base de datos: productos de ejemplo y el stock que "hay"
const prod = (id, nombre, cat, extra = {}) => ({
  id_insumo_producto: id, nombre, descripcion: null, etiqueta: null, precio: 1000, nombre_categoria: cat,
  imagenes: [], estado: 'ACTIVO', costo: 500, stock: 10, ...extra,
});
jest.mock('../src/services/insumoProducto.service', () => ({
  listar: jest.fn(async () => [
    prod(1, 'Mini', 'Hamburguesas', { descripcion: 'Rica', etiqueta: 'Favorita', precio: 13000, imagenes: ['https://x/img.jpg'] }),
    prod(2, 'Vieja', 'Hamburguesas', { estado: 'INACTIVO' }),
    prod(3, 'Doble', 'Hamburguesas'), // su receta no alcanza
    prod(4, 'Personal', 'Bebidas'),
    prod(6, 'Coca-Cola', 'Sabores de bebida'),
  ]),
  productosSinStock: jest.fn(async () => [3]),
  gaseosas: jest.fn(async () => [{ nombre: 'Gaseosa Coca-Cola (Personal)', agotada: true }]),
}));
const app = require('../src/app');

describe('GET /api/catalogo', () => {
  it('es público, solo trae activos y no expone costo ni stock', async () => {
    const res = await request(app).get('/api/catalogo');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      id: 1, nombre: 'Mini', descripcion: 'Rica', etiqueta: 'Favorita', precio: 13000,
      categoria: 'Hamburguesas', imagenes: ['https://x/img.jpg'],
    });
  });

  it('no muestra los productos cuya receta no tiene stock (las bebidas no son insumos: siempre salen)', async () => {
    const res = await request(app).get('/api/catalogo');
    expect(res.body.data.map((p) => p.nombre)).toEqual(['Mini', 'Personal', 'Coca-Cola']);
  });
});

describe('GET /api/catalogo/gaseosas', () => {
  it('es público y dice qué gaseosas compradas están agotadas', async () => {
    const res = await request(app).get('/api/catalogo/gaseosas');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ nombre: 'Gaseosa Coca-Cola (Personal)', agotada: true }]);
  });
});
