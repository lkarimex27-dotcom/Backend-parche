jest.mock('../src/models/pedido.model');
jest.mock('../config/db', () => ({ withTransaction: jest.fn((fn) => fn({})) }));

const Pedido = require('../src/models/pedido.model');
const service = require('../src/services/pedido.service');

const HORA = 60 * 60 * 1000;
const hecho = new Date('2026-11-25T10:00:00Z');
const pedido = (extra = {}) => ({ id_pedido: 5, id_cliente: 7, estado: 'Entregado', creado_en: hecho, devolucion: null, ...extra });

describe('El cliente pide la devolución (hasta 24 h después de hacer el pedido)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('la guarda si el pedido está entregado y no han pasado 24 h', async () => {
    Pedido.obtenerPorId.mockResolvedValue(pedido());
    await service.solicitarDevolucion(5, { motivo: 'La hamburguesa llegó fría' }, 7, hecho.getTime() + 23 * HORA);
    expect(Pedido.solicitarDevolucion).toHaveBeenCalledWith({}, 5, 'La hamburguesa llegó fría');
  });

  it.each([
    ['pasaron más de 24 h', pedido(), 7, 25 * HORA, /24 horas/],
    ['aún no está entregado', pedido({ estado: 'En camino' }), 7, HORA, /entregado/],
    ['ya la pidió', pedido({ devolucion: { motivo: 'x' } }), 7, HORA, /Ya pediste/],
    ['el pedido es de otro cliente', pedido(), 8, HORA, /no encontrado/],
  ])('no la guarda si %s', async (_caso, p, cliente, despues, error) => {
    Pedido.obtenerPorId.mockResolvedValue(p);
    await expect(service.solicitarDevolucion(5, { motivo: 'La hamburguesa llegó fría' }, cliente, hecho.getTime() + despues)).rejects.toThrow(error);
    expect(Pedido.solicitarDevolucion).not.toHaveBeenCalled();
  });
});
