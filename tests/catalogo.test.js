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
    prod(5, '3 L', 'Bebidas'), // ningún sabor tiene 3 L
    prod(6, 'Coca-Cola', 'Sabores de bebida'),
    prod(7, 'Uva', 'Sabores de bebida'), // sin stock en ningún tamaño
  ]),
  productosSinStock: jest.fn(async () => [3]),
  insumosVendibles: jest.fn(async () => ['Gaseosa Coca-Cola Personal', 'Carne']),
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

  it('no muestra lo que no hay: productos sin insumos, tamaños y sabores de gaseosa agotados', async () => {
    const res = await request(app).get('/api/catalogo');
    expect(res.body.data.map((p) => p.nombre)).toEqual(['Mini', 'Personal', 'Coca-Cola']);
    expect(res.body.data.find((p) => p.nombre === 'Coca-Cola').disponible_en).toEqual(['Personal']);
  });
});
