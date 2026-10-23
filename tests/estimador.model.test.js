jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../src/config/db');
const Pedido = require('../src/models/pedido.model');
const Barrio = require('../src/models/barrio.model');

describe('consultas del estimador', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca solo barrios activos de Bello mediante un parámetro parcial', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await Barrio.listarDisponibles('ana');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('activo = TRUE'), ['Bello', 'Antioquia', 'ana']);
    expect(query.mock.calls[0][0]).toContain('nombre ILIKE');
    expect(query.mock.calls[0][0]).toContain('ORDER BY lower(nombre)');
  });

  it('limita la carga a pedidos activos que pueden consumir capacidad de cocina', async () => {
    query.mockResolvedValueOnce({ rows: [{ pedidos_activos: 3 }] });

    await expect(Pedido.cargaCocina()).resolves.toBe(3);

    expect(query.mock.calls[0][1]).toEqual([['Recibido', 'Confirmado', 'En cocina']]);
    expect(query.mock.calls[0][0]).toContain('creado_en <= now()');
  });

  it('usa únicamente pedidos entregados con marcas de tiempo válidas para historial', async () => {
    query.mockResolvedValueOnce({ rows: [{ observaciones: 0, p25: null, mediana: null, p75: null }] });

    await Pedido.estadisticasDesplazamiento(4);

    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([4, 180]);
    expect(sql).toContain("p.estado = 'Entregado'");
    expect(sql).toContain("h.estado = 'En camino'");
    expect(sql).toContain("h.estado = 'Entregado'");
    expect(sql).toContain('entrega > salida');
  });

  it('guarda la zona y una copia de la estimación inicial con el pedido', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id_pedido: 77 }] }) };
    const initialEstimate = { estimatedMinutes: 20, source: 'baseline' };

    await Pedido.crear(client, {
      id_cliente: 5,
      id_barrio: 3,
      estimacion_inicial: initialEstimate,
      total: 13000,
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Dirección',
      pago: 'Efectivo',
      estado: 'Recibido',
      estado_pago: 'Pendiente',
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('id_barrio, estimacion_inicial');
    expect(params).toContain(3);
    expect(params).toContain(JSON.stringify(initialEstimate));
    expect(params).toContain(13000);
  });
});
