process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: se simula dónde está registrado cada producto
const mockLibre = { ventas: 0, pedidos: 0, compras: 0, proveedores: null, otros: 0 };
const mockUsos = {
  1: mockLibre,
  2: { ...mockLibre, ventas: 2 },
  3: { ...mockLibre, pedidos: 1 },
  4: { ...mockLibre, compras: 1, proveedores: 'Postobón S.A.' }, // una gaseosa
  5: { ...mockLibre, proveedores: 'Salsas El Sabor' },
};
jest.mock('../src/models/insumoProducto.model', () => ({
  usosProducto: jest.fn(async (id) => mockUsos[id]),
  eliminar: jest.fn(async () => true),
}));
const Modelo = require('../src/models/insumoProducto.model');
const service = require('../src/services/insumoProducto.service');

describe('Eliminar un producto', () => {
  it('se elimina si no tiene ventas, pedidos, compras ni proveedores', async () => {
    await expect(service.eliminar('PRODUCTO', 1)).resolves.toBeUndefined();
    expect(Modelo.eliminar).toHaveBeenCalledWith('PRODUCTO', 1);
  });

  it.each([
    [2, 'ventas'],
    [3, 'pedidos'],
    [4, 'compras, el proveedor Postobón S.A.'],
    [5, 'el proveedor Salsas El Sabor'],
  ])('no se elimina el producto %i porque está en %s', async (id, donde) => {
    Modelo.eliminar.mockClear();
    await expect(service.eliminar('PRODUCTO', id)).rejects.toThrow(donde);
    expect(Modelo.eliminar).not.toHaveBeenCalled();
  });
});
