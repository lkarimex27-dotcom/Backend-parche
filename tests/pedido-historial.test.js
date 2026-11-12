jest.mock('../config/db', () => ({ query: jest.fn(), withTransaction: (callback) => callback({}) }));
jest.mock('../src/models/pedido.model');
jest.mock('../src/services/ventaPedido.service');

const Pedido = require('../src/models/pedido.model');
const service = require('../src/services/pedido.service');

describe('historial del pedido', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registra el cambio de pago con quién lo hizo', async () => {
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 7, estado: 'Entregado', estado_pago: 'Pendiente', items: [] });
    await service.actualizar(7, { estado_pago: 'Pagado' }, 3);
    expect(Pedido.registrarEstado).toHaveBeenCalledWith({}, 7, 'Pago recibido', 3);
  });

  it('no registra nada si el pago no cambió', async () => {
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 7, estado: 'Entregado', estado_pago: 'Pagado', items: [] });
    await service.actualizar(7, { estado_pago: 'Pagado' }, 3);
    expect(Pedido.registrarEstado).not.toHaveBeenCalled();
  });

  it('al cliente no le muestra quién del equipo hizo cada cambio', async () => {
    Pedido.listarDeCliente.mockResolvedValue([{ id_pedido: 7, historial: [{ estado: 'Recibido', fecha: 'f', usuario: 'Admin' }] }]);
    const [pedido] = await service.listarMios(4);
    expect(pedido.historial).toEqual([{ estado: 'Recibido', fecha: 'f' }]);
  });
});
