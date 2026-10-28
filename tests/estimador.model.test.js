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

  it('resuelve el nombre exacto en el catálogo activo del municipio configurado', async () => {
    const row = { id_barrio: 8, nombre: 'Santa Ana', activo: true };
    query.mockResolvedValueOnce({ rows: [row] });

    await expect(Barrio.obtenerActivoPorNombre('Santa Ana')).resolves.toEqual(row);

    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual(['Santa Ana', 'Bello', 'Antioquia']);
    expect(sql).toContain('lower(nombre) = lower($1)');
    expect(sql).toContain('activo = TRUE');
  });

  it('recupera la cola de cocina en orden PEPS y sus inicios reales de preparación', async () => {
    const queue = [{ id_pedido: 3, estado: 'En cocina', inicio_cocina: new Date() }];
    query.mockResolvedValueOnce({ rows: queue });

    await expect(Pedido.colaCocina()).resolves.toEqual(queue);

    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([['Recibido', 'Confirmado', 'En cocina']]);
    expect(sql).toContain('historial_estados_pedido');
    expect(sql).toContain('p.produccion_autorizada = TRUE');
    expect(sql).toContain('SUM(d.cantidad)');
    expect(sql).toContain('pedido_detalle');
    expect(sql).toContain('ORDER BY p.creado_en ASC, p.id_pedido ASC');
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
      tipo_entrega: 'domicilio',
      estimacion_inicial: initialEstimate,
      subtotal: 13000,
      costo_domicilio_cop: 4000,
      total: 17000,
      nombre: 'Cliente',
      telefono: '3000000000',
      direccion: 'Dirección',
      pago: 'Efectivo',
      estado: 'Recibido',
      estado_pago: 'Pendiente',
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('tipo_entrega, direccion_entrega');
    expect(sql).toContain('id_barrio, estimacion_inicial');
    expect(params).toContain('domicilio');
    expect(params).toContain(3);
    expect(params).toContain(JSON.stringify(initialEstimate));
    expect(sql).toContain('costo_domicilio_cop');
    expect(params).toContain(4000);
    expect(params).toContain(17000);
  });
});
