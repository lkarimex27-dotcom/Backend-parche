// Sin base de datos: modelos, transacción y eventos se simulan
let mockPedido;
jest.mock('../config/db', () => ({ withTransaction: async (fn) => fn({}) }));
jest.mock('../src/models/pedido.model', () => ({
  obtenerPorId: jest.fn(async () => mockPedido),
  actualizar: jest.fn(async () => undefined),
  registrarEstado: jest.fn(async () => undefined),
}));
jest.mock('../src/services/ventaPedido.service', () => ({ reflejarEstado: jest.fn(), asegurarVenta: jest.fn() }));
jest.mock('../src/services/pedidoCorreos.service', () => ({ avisarCambio: jest.fn() }));
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

  it('un panel desactualizado no hace retroceder el estado ni el pago', async () => {
    mockPedido = { id_pedido: 1, estado: 'En camino', estado_pago: 'Pagado' };
    await expect(service.actualizar(1, { estado: 'Confirmado', estado_pago: 'Pagado' }, 9)).rejects.toThrow(/no puede volver a «Confirmado»/);
    await expect(service.actualizar(1, { estado: 'En camino', estado_pago: 'Pendiente de verificación' }, 9)).rejects.toThrow(/no puede volver a «Pendiente de verificación»/);
    expect(Pedido.actualizar).not.toHaveBeenCalled();
  });

  it('avanzar, cancelar y rechazar un comprobante sí se permiten', async () => {
    mockPedido = { id_pedido: 1, estado: 'Confirmado', estado_pago: 'Pendiente de verificación' };
    await service.actualizar(1, { estado: 'En cocina', estado_pago: 'Rechazado' }, 9);
    mockPedido = { id_pedido: 1, estado: 'En cocina', estado_pago: 'Rechazado' };
    await service.actualizar(1, { estado: 'Cancelado', estado_pago: 'Pendiente' }, 9);
    expect(Pedido.actualizar).toHaveBeenCalledTimes(2);
  });

  it('un pedido Entregado sí puede quedar Pagado (contraentrega) y genera la venta', async () => {
    mockPedido = { id_pedido: 1, estado: 'Entregado', estado_pago: 'Pendiente' };
    await service.actualizar(1, { estado: 'Entregado', estado_pago: 'Pagado' }, 9);
    expect(Pedido.actualizar).toHaveBeenCalled();
    expect(VentaPedido.asegurarVenta).toHaveBeenCalled();
  });

  it('requiere registrar el pago en una operación anterior a la entrega', async () => {
    mockPedido = { id_pedido: 1, estado: 'En camino', estado_pago: 'Abonado' };
    await expect(service.actualizar(1, { estado: 'Entregado', estado_pago: 'Pagado' }, 9))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(Pedido.actualizar).not.toHaveBeenCalled();

    mockPedido.estado_pago = 'Pagado';
    await service.actualizar(1, { estado: 'Entregado' }, 9);
    expect(Pedido.actualizar).toHaveBeenCalledWith({}, 1, { estado: 'Entregado' });
  });

  it.each([[120000, 'Abonado'], [160000, 'Pagado']])('registra el valor confirmado de %i', async (valor_recibido, estado_pago) => {
    mockPedido = {
      id_pedido: 1, estado: 'Por confirmar', estado_pago: 'Pendiente de verificación',
      total: 160000, abono: 80000, comprobantes: [{ valor: 100000 }],
    };
    await service.actualizar(1, { valor_recibido }, 9);
    expect(Pedido.actualizar).toHaveBeenCalledWith({}, 1, { abono: valor_recibido, estado_pago });
  });

  it('un pedido en curso sí cambia de estado', async () => {
    mockPedido = { id_pedido: 1, estado: 'Recibido', estado_pago: 'Pendiente' };
    await service.actualizar(1, { estado: 'Confirmado' }, 9);
    expect(Pedido.registrarEstado).toHaveBeenCalledWith({}, 1, 'Confirmado', 9);
  });
});
