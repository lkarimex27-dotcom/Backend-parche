process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: la transacción y los modelos se simulan
const perdidas = {
  1: { id_perdida: 1, id_insumo_producto: 5, cantidad: 4, medida: 'paq', estado: 'REGISTRADA', observacion: 'Compra a Panadería del 17 de octubre de 2026' },
  4: { id_perdida: 4, id_insumo_producto: 5, cantidad: 30, medida: 'paq', estado: 'REGISTRADA', observacion: 'Compra a Panadería del 17 de octubre de 2026' },
  2: { id_perdida: 2, id_insumo_producto: 5, cantidad: 4, estado: 'DEVUELTA', observacion: 'Compra a Panadería del 17 de octubre de 2026' },
  3: { id_perdida: 3, id_insumo_producto: 5, cantidad: 4, estado: 'REGISTRADA', observacion: null },
  // Enlazada por número: dos compras a Panadería ese día, la 7 está anulada
  5: { id_perdida: 5, id_insumo_producto: 5, cantidad: 4, medida: 'paq', estado: 'REGISTRADA', id_compra: 7, observacion: 'Compra a Panadería del 17 de octubre de 2026' },
};
jest.mock('../src/config/db', () => ({ withTransaction: async (fn) => fn({}) }));
jest.mock('../src/models/stock.model', () => ({ ajustar: jest.fn(async () => true), marcar: jest.fn(async () => undefined) }));
jest.mock('../src/models/compra.model', () => ({
  estadosDe: jest.fn(async () => ['REGISTRADA']),
  obtenerPorId: jest.fn(async () => ({ estado: 'REGISTRADA' })),
}));
jest.mock('../src/models/perdida.model', () => ({
  obtenerPorId: jest.fn(async (id) => perdidas[id]),
  devolver: jest.fn(async () => undefined),
}));
const Stock = require('../src/models/stock.model');
const Perdida = require('../src/models/perdida.model');
const service = require('../src/services/perdida.service');

describe('Devolver una pérdida a la compra', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin cantidad devuelve todo: vuelve al stock y queda devuelta', async () => {
    await service.devolver(1, { motivo: 'El proveedor lo cambió' });
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 5, 4);
    expect(Perdida.devolver).toHaveBeenCalledWith({}, 1, { cantidad: 4, total: true, nota: '4 paq: El proveedor lo cambió' });
  });

  it('devolver 15 de 30: la pérdida sigue con 15 (editable) y 15 vuelven al stock', async () => {
    await service.devolver(4, { cantidad: 15, motivo: 'Cambiaron la mitad' });
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 5, 15);
    expect(Perdida.devolver).toHaveBeenCalledWith({}, 4, { cantidad: 15, total: false, nota: '15 paq: Cambiaron la mitad' });
  });

  it('no se devuelve más de lo perdido', async () => {
    await expect(service.devolver(4, { cantidad: 31, motivo: 'De más' })).rejects.toThrow('máximo 30 paq');
    expect(Stock.ajustar).not.toHaveBeenCalled();
  });

  it('no se devuelve dos veces', async () => {
    await expect(service.devolver(2, { motivo: 'Otra vez' })).rejects.toThrow('ya se devolvió');
    expect(Stock.ajustar).not.toHaveBeenCalled();
  });

  it('solo si vino de una compra', async () => {
    await expect(service.devolver(3, { motivo: 'No aplica' })).rejects.toThrow('vino de una compra');
    expect(Stock.ajustar).not.toHaveBeenCalled();
  });

  it('no se devuelve a una compra anulada (su stock ya salió al anularla)', async () => {
    const Compra = require('../src/models/compra.model');
    Compra.estadosDe.mockResolvedValueOnce(['ANULADA']);
    await expect(service.devolver(1, { motivo: 'Tarde' })).rejects.toThrow('está anulada');
    expect(Compra.estadosDe).toHaveBeenCalledWith({}, 'Panadería', '2026-10-17');
    expect(Stock.ajustar).not.toHaveBeenCalled();
  });

  it('con id_compra revisa esa compra exacta (no el texto) y marca el origen del movimiento', async () => {
    const Compra = require('../src/models/compra.model');
    Compra.obtenerPorId.mockResolvedValueOnce({ estado: 'ANULADA' });
    await expect(service.devolver(5, { motivo: 'Tarde' })).rejects.toThrow('está anulada');
    expect(Compra.obtenerPorId).toHaveBeenCalledWith(7, {});
    expect(Compra.estadosDe).not.toHaveBeenCalled();

    await service.devolver(5, { motivo: 'Cambio' });
    expect(Stock.marcar).toHaveBeenCalledWith({}, 'DEVOLUCION_PERDIDA', 'Pérdida #5 → Compra #7');
    expect(Stock.ajustar).toHaveBeenCalledWith({}, 5, 4);
  });
});
