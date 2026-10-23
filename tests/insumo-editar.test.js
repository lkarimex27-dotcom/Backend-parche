process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: se revisa qué le llega al modelo al editar
jest.mock('../src/models/insumoProducto.model', () => ({
  actualizar: jest.fn(async () => ({ id_insumo_producto: 1 })),
  obtenerPorId: jest.fn(async () => ({ id_insumo_producto: 1, nombre: 'Sal' })),
}));
const Modelo = require('../src/models/insumoProducto.model');
const service = require('../src/services/insumoProducto.service');

describe('Editar un insumo', () => {
  it('no cambia el costo ni el stock (solo cambian con compras, pérdidas y producción)', async () => {
    await service.actualizar('INSUMO', 1, { nombre: 'Sal marina', costo: 1, stock: 999, minimo: 2 });
    expect(Modelo.actualizar).toHaveBeenCalledWith('INSUMO', 1, { nombre: 'Sal marina', minimo: 2 });
  });

  it('un producto sí puede cambiar su precio y stock', async () => {
    await service.actualizar('PRODUCTO', 2, { precio: 15000, stock: 3 });
    expect(Modelo.actualizar).toHaveBeenLastCalledWith('PRODUCTO', 2, { precio: 15000, stock: 3 });
  });
});
