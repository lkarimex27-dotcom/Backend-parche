process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: la transacción y los modelos se simulan
jest.mock('../src/config/db', () => ({ withTransaction: async (fn) => fn({}) }));
jest.mock('../src/models/proveedor.model', () => ({ obtenerPorId: jest.fn(async () => ({ id_proveedor: 1 })) }));
jest.mock('../src/models/stock.model', () => ({
  ajustar: jest.fn(async () => true),
  marcar: jest.fn(async () => undefined),
  retirar: jest.fn(async () => undefined),
  recalcularCosto: jest.fn(async () => undefined),
}));
// Compra registrada: 10 de pan (id 5) en dos líneas y 3 de queso (id 7)
const compra = {
  id_compra: 9, estado: 'REGISTRADA',
  detalles: [
    { id_insumo_producto: 5, cantidad: 6 }, { id_insumo_producto: 5, cantidad: 4 }, { id_insumo_producto: 7, cantidad: 3 },
  ],
};
jest.mock('../src/models/compra.model', () => ({
  obtenerPorId: jest.fn(async () => compra),
  cambiarEstado: jest.fn(async () => undefined),
  borrarDetalles: jest.fn(async () => undefined),
  actualizar: jest.fn(async () => undefined),
  crearDetalle: jest.fn(async () => ({ rowCount: 1 })),
}));
const Stock = require('../src/models/stock.model');
const Compra = require('../src/models/compra.model');
const service = require('../src/services/compra.service');

describe('Anular una compra', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retira lo comprado por insumo (sin recortar a 0) y la anula', async () => {
    await service.cambiarEstado(9, 'ANULADA');
    expect(Stock.retirar).toHaveBeenCalledWith({}, 5, 10, 'No se puede anular la compra');
    expect(Stock.retirar).toHaveBeenCalledWith({}, 7, 3, 'No se puede anular la compra');
    expect(Compra.cambiarEstado).toHaveBeenCalledWith({}, 9, 'ANULADA');
    expect(Stock.marcar).toHaveBeenCalledWith({}, 'ANULACION_COMPRA', 'Compra #9');
  });

  it('si lo comprado ya se usó, no la anula', async () => {
    Stock.retirar.mockRejectedValueOnce(new Error('No se puede anular la compra: de «Pan» hay 2 und y se necesitan 10 und.'));
    await expect(service.cambiarEstado(9, 'ANULADA')).rejects.toThrow('hay 2 und');
    expect(Compra.cambiarEstado).not.toHaveBeenCalled();
  });
});

describe('Reactivar una compra anulada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devuelve al stock exactamente lo que anular quitó y recalcula el costo', async () => {
    compra.estado = 'ANULADA';
    try {
      await service.cambiarEstado(9, 'REGISTRADA');
    } finally {
      compra.estado = 'REGISTRADA';
    }
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 5, 10);
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 7, 3);
    expect(Stock.retirar).not.toHaveBeenCalled();
    expect(Stock.recalcularCosto).toHaveBeenCalledWith({}, 5);
  });
});

describe('Editar una compra registrada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mueve el stock solo en la diferencia', async () => {
    // Pan 10 -> 12 (+2), queso 3 -> 1 (-2)
    await service.actualizar(9, {
      id_proveedor: 1, fecha: '2026-10-17',
      items: [{ id_insumo_producto: 5, cantidad: 12, costo_unitario: 900 }, { id_insumo_producto: 7, cantidad: 1, costo_unitario: 5000 }],
    });
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 5, 2);
    expect(Stock.retirar).toHaveBeenCalledWith({}, 7, 2, 'No se puede quitar de la compra');
    expect(Stock.retirar).toHaveBeenCalledTimes(1);
  });

  it('solo cambiar el precio no toca el stock', async () => {
    await service.actualizar(9, {
      id_proveedor: 1, fecha: '2026-10-17',
      items: [{ id_insumo_producto: 5, cantidad: 10, costo_unitario: 950 }, { id_insumo_producto: 7, cantidad: 3, costo_unitario: 5000 }],
    });
    expect(Stock.ajustar).not.toHaveBeenCalled();
    expect(Stock.retirar).not.toHaveBeenCalled();
    expect(Stock.recalcularCosto).toHaveBeenCalledWith({}, 5);
    expect(Stock.recalcularCosto).toHaveBeenCalledWith({}, 7);
  });
});
