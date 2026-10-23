process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: se simula en qué módulos está cada insumo
const usos = {
  1: { compras: 0, perdidas: 0, recetas: null },
  2: { compras: 3, perdidas: 0, recetas: null },
  3: { compras: 0, perdidas: 1, recetas: null },
  4: { compras: 0, perdidas: 0, recetas: 'Hamburguesa Mini, Perro Mediano' },
};
jest.mock('../src/models/insumoProducto.model', () => ({
  usos: jest.fn(async (id) => usos[id]),
  eliminar: jest.fn(async () => true),
}));
const Modelo = require('../src/models/insumoProducto.model');
const service = require('../src/services/insumoProducto.service');

describe('Eliminar un insumo', () => {
  it('se elimina si ningún otro módulo tiene registros de él', async () => {
    await expect(service.eliminar('INSUMO', 1)).resolves.toBeUndefined();
    expect(Modelo.eliminar).toHaveBeenCalledWith('INSUMO', 1);
  });

  it.each([
    [2, 'compras'],
    [3, 'pérdidas de insumos'],
    [4, 'la ficha técnica de Hamburguesa Mini, Perro Mediano'],
  ])('no se elimina el insumo %i porque está en %s', async (id, donde) => {
    Modelo.eliminar.mockClear();
    await expect(service.eliminar('INSUMO', id)).rejects.toThrow(donde);
    expect(Modelo.eliminar).not.toHaveBeenCalled();
  });
});
