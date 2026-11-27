// Productos bloqueados al confirmar, y el cobro de un domicilio en efectivo (solo el domiciliario o «Pagó en el local")
jest.mock('../config/db', () => ({ withTransaction: jest.fn((fn) => fn({})) }));
jest.mock('../src/models/pedido.model');
jest.mock('../src/models/permiso.model', () => ({ tieneRol: jest.fn() }));
jest.mock('../src/services/ventaPedido.service', () => ({
  reflejarEstado: jest.fn(), asegurarVenta: jest.fn(), codigoPedido: (id) => `PED-${String(id).padStart(4, '0')}`,
}));
jest.mock('../src/services/pedidoCorreos.service', () => ({ avisarCambio: jest.fn() }));
jest.mock('../src/services/pedidoEventos.service', () => ({ publicarEstadoProduccion: jest.fn(), publicarCambioPanel: jest.fn() }));

const R = require('../src/utils/reglasPanel');
const Pedido = require('../src/models/pedido.model');
const Permiso = require('../src/models/permiso.model');
const VentaPedido = require('../src/services/ventaPedido.service');
const service = require('../src/services/pedido.service');

// Pedido del panel: [1 recibe, 2 productos, 3 tipo, 4 método, 5 modalidad, 6 total, 7 estado, 8 pago, 9 autorización, 10 líneas, 15 pagó en el local]
const fila = (cambios) => {
  const f = ['PED-0050', 'Ana', '1 Mini', 'Domicilio', 'Efectivo', 'Contraentrega', 13000, 'Recibido', 'Pendiente', 'Pendiente de confirmar', '[]'];
  Object.entries(cambios).forEach(([i, v]) => { f[i] = v; });
  return f;
};

describe('Los productos de un pedido solo cambian mientras está «Recibido»', () => {
  it('pedido del panel: recibido sí; confirmado o enviado a producción no', () => {
    expect(R.revisarPedidoPanel(fila({}), fila({ 2: '2 Mini', 6: 26000 }))).toBeNull();
    expect(R.revisarPedidoPanel(fila({ 7: 'Confirmado' }), fila({ 7: 'Confirmado', 6: 26000 }))).toMatch(/ya está «Confirmado»: sus productos no se pueden cambiar/);
    expect(R.revisarPedidoPanel(fila({ 9: 'Enviada a producción' }), fila({ 9: 'Enviada a producción', 10: '[1]' }))).toMatch(/no se pueden cambiar/);
  });

  it('la orden de producción de un pedido no cambia sus productos; una hecha a mano sí', () => {
    const op = (estado, productos, pedido = 'PED-0050') => { const f = Array(17).fill(''); f[8] = estado; f[13] = productos; f[15] = pedido; return f; };
    expect(R.revisarProduccion(op('Confirmado', '[a]'), op('Confirmado', '[a,b]'))).toMatch(/no se cambian/);
    expect(R.revisarProduccion(op('Confirmado', '[a]', ''), op('Confirmado', '[a,b]', ''))).toBeNull();
  });
});

describe('Domicilio en efectivo: «Pagado» lo marca el domiciliario', () => {
  it('pedido del panel: el admin no; el domiciliario o «Pagó en el local» sí', () => {
    const pagado = (extra = {}) => fila({ 7: 'En camino', 8: 'Pagado', ...extra });
    expect(R.revisarPedidoPanel(fila({ 7: 'En camino' }), pagado())).toMatch(/lo marca «Pagado» el domiciliario/);
    expect(R.revisarPedidoPanel(fila({ 7: 'En camino' }), pagado(), { domiciliario: true })).toBeNull();
    expect(R.revisarPedidoPanel(fila({ 7: 'En camino' }), pagado({ 15: 'Sí' }))).toBeNull();
    // Para recoger o en el local, el admin sí cobra
    expect(R.revisarPedidoPanel(fila({ 3: 'Para recoger', 7: 'En camino' }), pagado({ 3: 'Para recoger' }))).toBeNull();
  });

  it('pedido de la tienda: el admin no; con «Pagó en el local» sí y queda en el historial', async () => {
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 5, estado: 'En camino', estado_pago: 'Pendiente', tipo_entrega: 'domicilio', metodo_pago: 'Efectivo' });
    Permiso.tieneRol.mockResolvedValue(false);
    await expect(service.actualizar(5, { estado_pago: 'Pagado' }, 1)).rejects.toThrow(/lo marca «Pagado» el domiciliario/);
    await service.actualizar(5, { estado_pago: 'Pagado', pagado_en_local: true }, 1);
    expect(Pedido.registrarEstado).toHaveBeenCalledWith({}, 5, 'Pagó en el local', 1);
  });
});

describe('El domiciliario entrega y cobra (POST /pedidos/:id/entrega)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Permiso.tieneRol.mockResolvedValue(true);
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 5, total: 30000 });
  });
  const tienda = (extra) => ({ id_pedido: 5, id_cliente: 7, codigo: null, estado: 'En camino', estado_pago: 'Pendiente', total: 30000, abono: null, tipo_entrega: 'domicilio', datos_panel: null, ...extra });

  it('solo un domiciliario', async () => {
    Permiso.tieneRol.mockResolvedValue(false);
    await expect(service.entregar(5, { efectivo: 30000 }, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('con el efectivo completo: pagado, entregado, su orden de producción y su venta', async () => {
    Pedido.paraEntrega.mockResolvedValue(tienda());
    await expect(service.entregar(5, { efectivo: 20000 }, 1)).rejects.toThrow(/Falta cobrar \$30\.000/);
    const r = await service.entregar(5, { efectivo: 30000 }, 1);
    expect(r).toMatchObject({ estado: 'Entregado', estado_pago: 'Pagado', cobrado: 30000 });
    expect(Pedido.marcarEntregado).toHaveBeenCalledWith({}, 5);
    expect(Pedido.entregarOrdenProduccion).toHaveBeenCalledWith({}, 'PED-0005');
    expect(VentaPedido.asegurarVenta).toHaveBeenCalled();
  });

  it('pago mixto ya abonado: solo cobra el resto; con la foto del comprobante también sirve', async () => {
    Pedido.paraEntrega.mockResolvedValue(tienda({ estado_pago: 'Abonado', abono: 10000, pago_mixto: true }));
    await expect(service.entregar(5, { efectivo: 20000 }, 1)).resolves.toMatchObject({ cobrado: 20000 });
    Pedido.paraEntrega.mockResolvedValue(tienda());
    await service.entregar(5, { foto: 'data:image/png;base64,AAAA' }, 1);
    expect(Pedido.agregarComprobante).toHaveBeenCalled();
  });

  it('un pedido del panel usa su fila (código, estado, total) y no uno que aún no va en camino', async () => {
    Pedido.paraEntrega.mockResolvedValue(tienda({ id_cliente: null, codigo: 'PED-0009', datos_panel: fila({ 7: 'En camino', 6: 13000 }) }));
    await service.entregar(10, { efectivo: 13000 }, 1);
    expect(Pedido.entregarOrdenProduccion).toHaveBeenCalledWith({}, 'PED-0009');
    expect(VentaPedido.asegurarVenta.mock.calls[0][3]).toMatchObject({ codigo: 'PED-0009' });
    Pedido.paraEntrega.mockResolvedValue(tienda({ estado: 'En cocina' }));
    await expect(service.entregar(5, { efectivo: 30000 }, 1)).rejects.toThrow(/se entrega cuando va «En camino»/);
  });
});
