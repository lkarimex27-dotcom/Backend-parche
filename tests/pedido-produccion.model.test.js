jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/db');
const Pedido = require('../src/models/pedido.model');

describe('estado de producción en pedidos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('incluye el estado de producción en la lista de pedidos del cliente', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await Pedido.listarDeCliente(7);

    expect(query.mock.calls[0][0]).toContain('p.estado_produccion');
    expect(query.mock.calls[0][0]).toContain('WHERE p.id_cliente = $1');
  });

  it('solo devuelve el pedido cuando el estado cambió', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id_pedido: 30, estado: 'Recibido' }] })
        .mockResolvedValueOnce({
          rows: [{
            id_pedido: 30,
            id_cliente: 7,
            estado: 'Confirmado',
            estado_produccion: 'Confirmado',
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    await expect(Pedido.actualizarEstadoProduccion(client, 30, 'Confirmado', 5)).resolves.toEqual({
      id_pedido: 30,
      id_cliente: 7,
      estado: 'Confirmado',
      estado_produccion: 'Confirmado',
      estado_anterior: 'Recibido',
    });
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('estado = COALESCE($3::text, estado)');
    expect(client.query.mock.calls[1][0]).toContain('$3::text IS NOT NULL');
    expect(client.query.mock.calls[1][1]).toEqual([30, 'Confirmado', 'Confirmado']);
    expect(client.query.mock.calls[2][1]).toEqual([30, 'Confirmado', 5]);
  });

  it('el pedido sigue a la orden en todos los pasos, solo hacia adelante; uno del panel se busca por su código', async () => {
    const paso = async (antes, nuevo, codigo = null) => {
      const client = { query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id_pedido: 10, estado: antes, estado_pago: 'Pagado' }] })
        .mockResolvedValueOnce({ rows: [{ id_pedido: 10, estado: nuevo }] })
        .mockResolvedValueOnce({ rowCount: 1 }) };
      await Pedido.actualizarEstadoProduccion(client, 9, nuevo, 5, codigo);
      return client.query.mock.calls;
    };
    const llamadas = await paso('En cocina', 'En camino', 'PED-0009');
    expect(llamadas[0][1]).toEqual([9, 'PED-0009']);
    expect(llamadas[1][0]).toContain("jsonb_set(datos_panel, '{7}'");
    expect(llamadas[1][1]).toEqual([10, 'En camino', 'En camino']);
    expect((await paso('En camino', 'Entregado'))[1][1][2]).toBe('Entregado');
    expect((await paso('Entregado', 'En cocina'))[1][1][2]).toBeNull();
    expect((await paso('Cancelado', 'Confirmado'))[1][1][2]).toBeNull();
    expect((await paso('En cocina', 'Producto no conforme'))[1][1][2]).toBeNull();
  });

  it('bloquea la entrega de producción cuando el pedido tiene saldo', async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id_pedido: 10, estado: 'En camino', estado_produccion: 'En camino', estado_pago: 'Abonado' }],
      }),
    };
    await expect(Pedido.actualizarEstadoProduccion(client, 10, 'Entregado', 5)).rejects.toMatchObject({ statusCode: 409 });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('crea una orden de producción visible en el panel para el pedido del cliente', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    await Pedido.crearOrdenProduccion(client, 30, [{
      producto: 'Hamburguesa Tradicional',
      cantidad: 2,
      detalle: {
        salsas: ['BBQ'],
        adiciones: [{ nombre: 'Tocineta', cantidad: 1 }],
      },
    }]);

    const [insertSql, insertParams] = client.query.mock.calls[0];
    expect(insertSql).toContain('INSERT INTO ordenes_produccion');
    expect(insertParams.slice(1, 6)).toEqual([
      'PED-0030',
      '2 x Hamburguesa Tradicional (BBQ, Tocineta)',
      2,
      0,
      'Recibido',
    ]);
    const fila = JSON.parse(insertParams[6]);
    expect(fila.slice(0, 4)).toEqual(['PED-0030', '2 x Hamburguesa Tradicional (BBQ, Tocineta)', 2, 0]);
    expect(fila[8]).toBe('Recibido');
    // [15] enlaza la orden con su pedido: el panel no crea otra
    expect(fila[15]).toBe('PED-0030');
    expect(JSON.parse(fila[13])).toEqual([
      { id: 'PED-0030-line-0', name: 'Hamburguesa Tradicional', quantity: 2, category: '', sauces: ['BBQ'] },
      { id: 'PED-0030-line-0-addition-0', name: 'Tocineta', quantity: 2, category: 'Adiciones', parentId: 'PED-0030-line-0' },
    ]);
    expect(client.query.mock.calls[1][0]).toContain('UPDATE pedidos SET estado_produccion');
    expect(client.query.mock.calls[1][1]).toEqual([30, 'Recibido']);
  });
});
