const { cotizar } = require('../src/services/pedido.service');

const CATALOGO = [
  { id_insumo_producto: 1, nombre: 'Mini', precio: 13000, categoria: 'Hamburguesas' },
  { id_insumo_producto: 2, nombre: 'Queso', precio: 8000, categoria: 'Adiciones' },
  { id_insumo_producto: 3, nombre: 'Tártara', precio: 0, categoria: 'Salsas' },
  { id_insumo_producto: 4, nombre: 'Personal', precio: 3000, categoria: 'Gaseosas' },
  { id_insumo_producto: 5, nombre: 'Coca-Cola', precio: 0, categoria: 'Sabores de bebida' },
];

describe('cotizar (precios del pedido calculados en el servidor)', () => {
  it('suma producto, adiciones y bebidas con los precios de la base', () => {
    const [linea] = cotizar(
      [{ producto: 'mini', cantidad: 2, salsas: ['Tartara'], adiciones: [
        { nombre: 'Queso', cantidad: 1 },
        { nombre: 'Gaseosa Coca-Cola (Personal)', cantidad: 2 },
      ] }],
      CATALOGO,
    );
    expect(linea.precio_unitario).toBe(13000);
    expect(linea.subtotal).toBe((13000 + 8000 + 2 * 3000) * 2);
    expect(linea.detalle.adiciones).toEqual([
      { nombre: 'Queso', cantidad: 1, precio: 8000 },
      { nombre: 'Gaseosa Coca-Cola (Personal)', cantidad: 2, precio: 3000 },
    ]);
  });

  it('acepta la categoría legacy de bebidas y la nueva de gaseosas', () => {
    const legacyCatalog = [...CATALOGO.map((item) => ({ ...item, categoria: item.categoria === 'Gaseosas' ? 'Bebidas' : item.categoria }))];
    const [linea] = cotizar(
      [{ producto: 'mini', cantidad: 1, salsas: [], adiciones: [{ nombre: 'Gaseosa Coca-Cola (Personal)', cantidad: 1 }] }],
      legacyCatalog,
    );
    expect(linea.detalle.adiciones[0].precio).toBe(3000);
  });

  it('rechaza productos o adiciones que no están en el menú', () => {
    expect(() => cotizar([{ producto: 'Pizza', cantidad: 1, salsas: [], adiciones: [] }], CATALOGO)).toThrow('Pizza');
    expect(() => cotizar([{ producto: 'Mini', cantidad: 1, salsas: [], adiciones: [{ nombre: 'Oro', cantidad: 1 }] }], CATALOGO))
      .toThrow('Oro');
    // Una adición no se puede pedir como producto principal
    expect(() => cotizar([{ producto: 'Queso', cantidad: 1, salsas: [], adiciones: [] }], CATALOGO)).toThrow('Queso');
  });
});
