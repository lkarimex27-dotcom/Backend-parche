process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: un cliente falso responde las consultas y guarda lo que se insertaría
const mockVentas = [];
const mockPedido = {
  id_pedido: 15, cliente: 'Ana Pérez', estado: 'Recibido', estado_pago: 'Pendiente', metodo_pago: 'Nequi',
  direccion_entrega: 'Calle 45 # 50-20', total: 21500,
  items: [{ producto: 'Hamburguesa Sencilla', cantidad: 1, precio_unitario: 14500,
    detalle: { salsas: ['BBQ'], adiciones: [{ nombre: 'Gaseosa Coca-Cola (Personal)', cantidad: 1, precio: 3000 }] } }],
};
const mockC = {
  query: jest.fn(async (sql, params = []) => {
    if (/FROM ventas WHERE pedido_asociado/.test(sql)) return { rowCount: mockVentas.filter((v) => v[9] === params[0]).length, rows: [] };
    if (/codigo ~/.test(sql)) return { rows: [{ codigo: 'VTA-AUTO-08' }, { codigo: 'VTA-AUTO-07' }] };
    if (/FROM personas/.test(sql)) return { rows: [{ nombre: 'Rosa Colorado' }] };
    if (/nombre_categoria/.test(sql)) return { rows: [{ nombre: 'hamburguesa sencilla', categoria: 'Hamburguesas' }, { nombre: 'gaseosa coca-cola (personal)', categoria: 'Bebidas' }] };
    if (/UPDATE ventas SET datos_panel/.test(sql)) return { rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }),
};
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn(mockC), query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../src/models/panel.model', () => ({
  crearConCliente: jest.fn(async (_c, _cfg, _columnas, fila) => { mockVentas.push(fila); return mockVentas.length }),
}));
jest.mock('../src/models/pedido.model', () => ({
  obtenerPorId: jest.fn(async () => ({ ...mockPedido })),
  actualizar: jest.fn(async (_c, _id, d) => Object.assign(mockPedido, d)),
  registrarEstado: jest.fn(async () => {}),
}));
const service = require('../src/services/pedido.service');

describe('Venta de un pedido de la tienda', () => {
  it('al quedar «Pagado» el servidor crea su venta con el siguiente código y las líneas del pedido', async () => {
    await service.actualizar(15, { estado_pago: 'Pagado' }, 3);
    expect(mockVentas).toHaveLength(1);
    const [codigo, vendedor, cliente, , tipo, metodo, subtotal, total, , pedidoCodigo, , lineas] = mockVentas[0];
    expect([codigo, vendedor, cliente, tipo, metodo, subtotal, total, pedidoCodigo]).toEqual(
      ['VTA-AUTO-09', 'Rosa Colorado', 'Ana Pérez', 'Domicilio', 'Transferencia', 21500, 21500, 'PED-0015']);
    const l = JSON.parse(lineas);
    expect(l[0]).toMatchObject({ product: 'Hamburguesa Sencilla', category: 'Hamburguesas', sauces: ['BBQ'] });
    expect(l[1]).toMatchObject({ product: 'Gaseosa Coca-Cola (Personal)', category: 'Bebidas', parentId: l[0].id });
  });

  it('nunca crea una segunda venta para el mismo pedido', async () => {
    mockPedido.estado_pago = 'Pendiente';
    await service.actualizar(15, { estado_pago: 'Pagado' }, 3);
    expect(mockVentas).toHaveLength(1);
  });

  it('cuando el pedido avanza, su venta muestra el nuevo estado', async () => {
    mockC.query.mockClear();
    await service.actualizar(15, { estado: 'En camino' }, 3);
    const update = mockC.query.mock.calls.find(([sql]) => /UPDATE ventas SET datos_panel/.test(sql));
    expect(update[1]).toEqual(['PED-0015', 'En camino']);
  });
});
