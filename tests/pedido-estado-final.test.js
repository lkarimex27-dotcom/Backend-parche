// Sin base de datos: modelos, transacción y eventos se simulan
let mockPedido;
jest.mock('../config/db', () => ({ withTransaction: async (fn) => fn({}) }));
jest.mock('../src/models/pedido.model', () => ({
  obtenerPorId: jest.fn(async () => mockPedido),
  actualizar: jest.fn(async () => undefined),
  registrarEstado: jest.fn(async () => undefined),
}));
jest.mock('../src/services/ventaPedido.service', () => ({ reflejarEstado: jest.fn(), asegurarVenta: jest.fn() }));
jest.mock('../src/services/pedidoEventos.service', () => ({ publicarEstadoProduccion: jest.fn() }));
const Pedido = require('../src/models/pedido.model');
const VentaPedido = require('../src/services/ventaPedido.service');
const service = require('../src/services/pedido.service');

describe('Estados finales del pedido', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['Entregado', 'Cancelado'])('un pedido %s no cambia de estado', async (estado) => {
    mockPedido = { id_pedido: 1, estado, estado_pago: 'Pendiente' };
    await expect(service.actualizar(1, { estado: 'En preparación' }, 9)).rejects.toMatchObject({ statusCode: 409 });
    expect(Pedido.actualizar).not.toHaveBeenCalled();
  });

  it('un pedido Entregado sí puede quedar Pagado (contraentrega) y genera la venta', async () => {
    mockPedido = { id_pedido: 1, estado: 'Entregado', estado_pago: 'Pendiente' };
    await service.actualizar(1, { estado: 'Entregado', estado_pago: 'Pagado' }, 9);
    expect(Pedido.actualizar).toHaveBeenCalled();
    expect(VentaPedido.asegurarVenta).toHaveBeenCalled();
  });

  it('un pedido en curso sí cambia de estado', async () => {
    mockPedido = { id_pedido: 1, estado: 'Recibido', estado_pago: 'Pendiente' };
    await service.actualizar(1, { estado: 'En preparación' }, 9);
    expect(Pedido.registrarEstado).toHaveBeenCalledWith({}, 1, 'En preparación', 9);
  });
});
