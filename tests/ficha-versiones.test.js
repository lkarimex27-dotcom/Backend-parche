// Sin base de datos: se simula el client de la transacción y se miran las consultas
const mockQuery = jest.fn();
jest.mock('../config/db', () => ({ query: (...a) => mockQuery(...a), withTransaction: async (fn) => fn({ query: (...a) => mockQuery(...a) }) }));
const Modelo = require('../src/models/insumoProducto.model');
const Consumo = require('../src/services/consumo.service');

const v1 = { numero_version: 1, contenido: '{"nombre":"Ficha","ingredientes":[{"insumo":"Carne","cantidad":120,"medida":"g"}]}' };
const v2 = { numero_version: 1, contenido: '{"nombre":"Ficha","ingredientes":[{"insumo":"Carne","cantidad":150,"medida":"g"}]}' };

// Client falso: devuelve las "fotos" de la ficha en orden (antes y después) y acepta lo demás
const clientCon = (...fotos) => {
  const sql = [];
  return {
    sql,
    query: jest.fn(async (q, params) => {
      sql.push({ q, params });
      if (q.includes('AS contenido')) return { rows: fotos.length ? [fotos.shift()].filter(Boolean) : [] };
      if (q.includes('INSERT INTO fichas_tecnicas (')) return { rows: [{ id_ficha_tecnica: 7 }] };
      return { rows: [], rowCount: 1 };
    }),
  };
};
const datos = { nombre: 'Ficha', ingredientes: [{ insumo: 'Carne', cantidad: 150, medida: 'g' }] };

describe('Versiones de la ficha técnica', () => {
  it('editar la receta guarda la versión anterior y sube el número', async () => {
    const c = clientCon(v1, v2);
    await expect(Modelo.guardarFicha(c, 3, datos)).resolves.toBeNull();
    const hist = c.sql.find((s) => s.q.includes('INSERT INTO fichas_tecnicas_historial'));
    expect(hist.params).toEqual([3, 1, v1.contenido]);
    expect(c.sql.some((s) => s.q.includes('numero_version = numero_version + 1'))).toBe(true);
  });

  it('guardar sin cambios no crea versión', async () => {
    const c = clientCon(v1, v1);
    await Modelo.guardarFicha(c, 3, datos);
    expect(c.sql.some((s) => s.q.includes('fichas_tecnicas_historial'))).toBe(false);
  });

  it('la primera ficha de un producto no deja historial', async () => {
    const c = clientCon(null, v1);
    await Modelo.guardarFicha(c, 3, datos);
    expect(c.sql.some((s) => s.q.includes('fichas_tecnicas_historial'))).toBe(false);
  });

  it('si un insumo no existe, no versiona (el service revierte)', async () => {
    const c = clientCon(v1, v2);
    c.query.mockImplementation(async (q) => {
      if (q.includes('AS contenido')) return { rows: [v1] };
      if (q.includes('INSERT INTO fichas_tecnicas (')) return { rows: [{ id_ficha_tecnica: 7 }] };
      if (q.includes('INSERT INTO ficha_tecnica_insumos')) return { rowCount: 0, rows: [] };
      return { rows: [], rowCount: 1 };
    });
    await expect(Modelo.guardarFicha(c, 3, datos)).resolves.toBe('Carne');
    expect(c.query.mock.calls.some(([q]) => q.includes('fichas_tecnicas_historial'))).toBe(false);
  });
});

describe('El descuento de stock no cambia con el versionado', () => {
  beforeEach(() => mockQuery.mockReset());

  it('la producción descuenta exactamente lo que recibe y nunca lee el historial', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ stock: 10 }] });
    await Consumo.descontar({ numero_orden: 'OP-1', insumos: [{ insumo: 'Carne', cantidad: 120 }, { insumo: 'Pan', cantidad: 1 }] }, 1);
    const updates = mockQuery.mock.calls.filter(([q]) => q.includes('UPDATE insumos_productos SET stock = stock -'));
    expect(updates.map(([, p]) => p)).toEqual([['Carne', 120], ['Pan', 1]]);
    expect(mockQuery.mock.calls.some(([q]) => q.includes('historial'))).toBe(false);
  });

  it('los agotados del menú se calculan con la ficha activa, no con versiones viejas', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await Modelo.productosSinStock();
    const [q] = mockQuery.mock.calls[0];
    expect(q).toContain('FROM fichas_tecnicas f');
    expect(q).not.toContain('historial');
  });
});
