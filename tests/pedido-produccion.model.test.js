jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../src/config/db');
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
        .mockResolvedValueOnce({ rows: [{ estado: 'Recibido' }] })
        .mockResolvedValueOnce({
          rows: [{
            id_pedido: 30,
            id_cliente: 7,
            estado: 'En cocina',
            estado_produccion: 'Iniciada',
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    await expect(Pedido.actualizarEstadoProduccion(client, 30, 'Iniciada', 5)).resolves.toEqual({
      id_pedido: 30,
      id_cliente: 7,
      estado: 'En cocina',
      estado_produccion: 'Iniciada',
    });
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('estado = COALESCE($3::text, estado)');
    expect(client.query.mock.calls[1][0]).toContain('$3::text IS NOT NULL');
    expect(client.query.mock.calls[1][1]).toEqual([30, 'Iniciada', 'En cocina']);
    expect(client.query.mock.calls[2][1]).toEqual([30, 'En cocina', 5]);
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
      'Recibida',
    ]);
    expect(JSON.parse(insertParams[6])).toEqual([
      'PED-0030',
      '2 x Hamburguesa Tradicional (BBQ, Tocineta)',
      2,
      0,
      expect.any(String),
      '',
      '',
      '',
      'Recibida',
    ]);
    expect(client.query.mock.calls[1][0]).toContain('UPDATE pedidos SET estado_produccion');
    expect(client.query.mock.calls[1][1]).toEqual([30, 'Recibida']);
  });
});
