jest.mock('../src/models/pedido.model');
jest.mock('../src/models/barrio.model');
jest.mock('../src/models/insumoProducto.model', () => ({ gaseosas: jest.fn() }));
jest.mock('../config/db', () => ({ withTransaction: jest.fn((fn) => fn({})) }));
jest.mock('../src/services/ventaPedido.service', () => ({ asegurarVenta: jest.fn(), actualizarVenta: jest.fn() }));

const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');
const InsumoProducto = require('../src/models/insumoProducto.model');
const VentaPedido = require('../src/services/ventaPedido.service');
const service = require('../src/services/pedido.service');

const item = (producto, cantidad) => ({ producto, cantidad, salsas: [], adiciones: [] });
const pedido = (items) => ({
  nombre: 'Cliente', telefono: '3000000000', direccion: 'Calle 1', tipo_entrega: 'recoger', pago: 'Efectivo', items,
});
// La Mini pide 1 pan; la Doble, 1 pan y 2 carnes. Hay 5 panes (2 apartados por otros pedidos) y 10 carnes.
const receta = [
  { producto: 4, insumo: 100, nombre: 'Pan', stock: 5, necesita: 1, apartado: 2 },
  { producto: 5, insumo: 100, nombre: 'Pan', stock: 5, necesita: 1, apartado: 2 },
  { producto: 5, insumo: 101, nombre: 'Carne', stock: 10, necesita: 2, apartado: 0 },
];

beforeEach(() => {
  jest.clearAllMocks();
  InsumoProducto.gaseosas.mockResolvedValue([]);
  Pedido.catalogoActivo.mockResolvedValue([
    { id_insumo_producto: 4, nombre: 'Hamburguesa Mini', precio: 13000, categoria: 'Hamburguesas' },
    { id_insumo_producto: 5, nombre: 'Hamburguesa Doble', precio: 20000, categoria: 'Hamburguesas' },
  ]);
  Barrio.obtenerActivo.mockResolvedValue(null);
  Pedido.colaCocina.mockResolvedValue([]);
  Pedido.estadisticasDesplazamiento.mockResolvedValue({ observaciones: 0 });
  Pedido.crear.mockResolvedValue(30);
  Pedido.insumosParaPreparar.mockResolvedValue(receta);
});

describe('Sin insumos suficientes según la ficha técnica no se puede pedir', () => {
  it('cuenta lo que apartan otros pedidos y lo que piden juntos los productos del pedido', async () => {
    Pedido.obtenerPorId.mockResolvedValue({ id_pedido: 30 });
    await service.crear(pedido([item('Mini', 1), item('Doble', 2)]), 7); // 3 panes de 3 libres
    await expect(service.crear(pedido([item('Mini', 2), item('Doble', 2)]), 7))
      .rejects.toThrow('Por ahora solo podemos preparar 1 de «Hamburguesa Mini» (no alcanza el insumo «Pan»)');
    expect(Pedido.insumosParaPreparar).toHaveBeenCalledWith({}, [4, 5], 0);
  });

  it('dice que se agotó si no alcanza ni para uno', async () => {
    Pedido.insumosParaPreparar.mockResolvedValue([{ producto: 5, insumo: 100, nombre: 'Pan', stock: 2, necesita: 1, apartado: 2 }]);
    await expect(service.crear(pedido([item('Doble', 6)]), 7)).rejects.toThrow('«Hamburguesa Doble» se agotó por ahora');
    expect(Pedido.crear).not.toHaveBeenCalled();
  });
});

describe('El panel cambia los productos de un pedido ya pagado', () => {
  const guardado = (extra) => ({
    id_pedido: 30, estado: 'Confirmado', estado_produccion: 'Recibido', estado_pago: 'Pagado',
    total: 26000, abono: null, costo_domicilio_cop: 0, ...extra,
  });

  it('agregar: el pago queda «Abonado» con lo ya recibido y dice cuánto falta cobrar', async () => {
    Pedido.obtenerPorId.mockResolvedValue(guardado());
    const r = await service.cambiarProductos(30, [item('Mini', 2), item('Doble', 1)], 1); // 46.000
    expect(Pedido.reemplazarDetalle).toHaveBeenCalled();
    expect(Pedido.actualizar).toHaveBeenCalledWith({}, 30, { subtotal: 46000, total: 46000, estado_pago: 'Abonado', abono: 26000 });
    expect(Pedido.registrarEstado).toHaveBeenCalledWith({}, 30, 'Productos: cobrar $20.000', 1);
    expect(r).toMatchObject({ pagado: 26000, diferencia: 20000 });
    expect(VentaPedido.actualizarVenta).toHaveBeenCalled();
  });

  it('quitar: sigue «Pagado» y dice cuánto hay que devolver', async () => {
    Pedido.obtenerPorId.mockResolvedValue(guardado());
    const r = await service.cambiarProductos(30, [item('Mini', 1)], 1);
    expect(Pedido.actualizar).toHaveBeenCalledWith({}, 30, { subtotal: 13000, total: 13000, estado_pago: 'Pagado', abono: 26000 });
    expect(Pedido.registrarEstado).toHaveBeenCalledWith({}, 30, 'Productos: devolver $13.000', 1);
    expect(r.diferencia).toBe(-13000);
  });

  it('con el abono cubierto pasa a «Pagado» y se crea su venta', async () => {
    Pedido.obtenerPorId.mockResolvedValue(guardado({ estado_pago: 'Abonado', abono: 20000 }));
    await service.cambiarProductos(30, [item('Mini', 1)], 1);
    expect(Pedido.actualizar.mock.calls[0][2]).toMatchObject({ estado_pago: 'Pagado', abono: 20000 });
    expect(VentaPedido.asegurarVenta).toHaveBeenCalled();
  });

  it('sin pagar no toca el pago; con la cocina empezada no deja cambiar', async () => {
    Pedido.obtenerPorId.mockResolvedValue(guardado({ estado_pago: 'Pendiente' }));
    const r = await service.cambiarProductos(30, [item('Mini', 1)], 1);
    expect(Pedido.actualizar).toHaveBeenCalledWith({}, 30, { subtotal: 13000, total: 13000 });
    expect(r.diferencia).toBe(0);
    Pedido.obtenerPorId.mockResolvedValue(guardado({ estado: 'En cocina', estado_produccion: 'En cocina' }));
    await expect(service.cambiarProductos(30, [item('Mini', 1)], 1)).rejects.toThrow(/antes de que la orden de producción entre a cocina/);
  });

  it('el stock no cuenta lo que este mismo pedido ya apartaba', async () => {
    Pedido.obtenerPorId.mockResolvedValue(guardado());
    await service.cambiarProductos(30, [item('Mini', 1)], 1);
    expect(Pedido.insumosParaPreparar).toHaveBeenCalledWith({}, [4], 30);
  });
});
