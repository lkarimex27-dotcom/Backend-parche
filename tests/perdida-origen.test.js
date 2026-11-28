// B1: editar o devolver una pérdida deja en el historial del insumo su origen («Pérdida editada», «Devuelto a la
// compra»), marcado antes de mover el stock; sin marcar quedaba como «Ajuste manual»
jest.mock('../config/db', () => ({ withTransaction: jest.fn((fn) => fn({})) }));
jest.mock('../src/models/perdida.model');
jest.mock('../src/models/stock.model', () => ({ marcar: jest.fn(), ajustar: jest.fn(async () => true), retirar: jest.fn() }));

const Perdida = require('../src/models/perdida.model');
const Stock = require('../src/models/stock.model');
const service = require('../src/services/perdida.service');

beforeEach(() => jest.clearAllMocks());
const perdida = (extra = {}) => ({ id_perdida: 4, id_insumo_producto: 9, cantidad: 3, medida: 'und', estado: 'REGISTRADA', observacion: 'Compra a Postobón del 17 de octubre de 2026', ...extra });

it('editar: «EDICION_PERDIDA» antes de devolver la cantidad anterior y descontar la nueva', async () => {
  Perdida.obtenerPorId.mockResolvedValue(perdida());
  await service.actualizar(4, { id_insumo_producto: 9, cantidad: 5 });
  expect(Stock.marcar).toHaveBeenCalledWith({}, 'EDICION_PERDIDA', 'Pérdida #4');
  expect(Stock.marcar.mock.invocationCallOrder[0]).toBeLessThan(Stock.ajustar.mock.invocationCallOrder[0]);
  expect(Stock.marcar.mock.invocationCallOrder[0]).toBeLessThan(Stock.retirar.mock.invocationCallOrder[0]);
});

it('devolver a la compra: «DEVOLUCION_PERDIDA» antes de sumar al stock', async () => {
  Perdida.obtenerPorId.mockResolvedValue(perdida());
  await service.devolver(4, { cantidad: 2, motivo: 'El proveedor la cambió' });
  expect(Stock.marcar).toHaveBeenCalledWith({}, 'DEVOLUCION_PERDIDA', 'Pérdida #4');
  expect(Stock.marcar.mock.invocationCallOrder[0]).toBeLessThan(Stock.ajustar.mock.invocationCallOrder[0]);
});
