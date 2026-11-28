// M1: al pasar una orden a cocina, el servidor revisa los insumos que manda el panel contra lo que la orden prepara
// (ficha técnica, salsas de la casa, bebidas con stock, partes a rehacer) y rechaza lo que no sale de ahí.
const { revisarInsumos, aBase } = require('../src/services/consumo.service');

// Base simulada: fichas y artículos como los devuelve Postgres
const recetas = [
  { producto: 'hamburguesa mini', insumo: 'Pan', cantidad: 1, medida: 'und', base: 'und' },
  { producto: 'hamburguesa mini', insumo: 'Carne', cantidad: 120, medida: 'g', base: 'kg' },
  { producto: 'hamburguesa mini', insumo: 'Huevo', cantidad: 2, medida: 'und', base: 'paq', unidades_paquete: 15, contenido_unidad: 'und' },
];
const articulos = [
  { clave: 'hamburguesa mini', base: 'und' },
  { clave: 'salsa de la casa', base: 'ml', porcion: 30 },
  { clave: 'hit litro', base: 'und' },
  { clave: 'carne', base: 'kg' },
];
const cliente = () => ({
  query: jest.fn(async (sql, [nombres]) => ({
    rows: sql.includes('fichas_tecnicas') ? recetas.filter((r) => nombres.includes(r.producto)) : articulos.filter((a) => nombres.includes(a.clave)),
  })),
});
const orden = (lineas) => { const f = Array(17).fill(''); f[13] = JSON.stringify(lineas); return f; };
const mini = (extra = {}) => ({ id: 'l0', name: 'Hamburguesa Mini', quantity: 2, ...extra });

describe('Insumos de una orden que pasa a cocina (M1)', () => {
  it('acepta lo que pide la ficha, con las unidades del inventario (kg, paquetes)', async () => {
    await expect(revisarInsumos(cliente(), orden([mini()]), [
      { insumo: 'Pan', cantidad: 2 }, { insumo: 'Carne', cantidad: 0.24 }, { insumo: 'Huevo', cantidad: 4 / 15 },
    ])).resolves.toBeUndefined();
  });

  it('rechaza descontar más de lo que pide la ficha', async () => {
    await expect(revisarInsumos(cliente(), orden([mini()]), [{ insumo: 'Pan', cantidad: 50 }]))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/como máximo 2/) });
  });

  it('rechaza un insumo que no está en la ficha de la orden', async () => {
    await expect(revisarInsumos(cliente(), orden([mini()]), [{ insumo: 'Queso', cantidad: 1 }]))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/no está en la ficha técnica/) });
  });

  it('cuenta la porción de la salsa de la casa y la bebida con stock', async () => {
    const lineas = [mini({ sauces: ['Salsa de la casa'] }), { id: 'l1', name: 'Hit Litro', quantity: 3 }];
    await expect(revisarInsumos(cliente(), orden(lineas), [
      { insumo: 'Salsa de la casa', cantidad: 60 }, { insumo: 'Hit Litro', cantidad: 3 },
    ])).resolves.toBeUndefined();
    await expect(revisarInsumos(cliente(), orden(lineas), [{ insumo: 'Hit Litro', cantidad: 4 }])).rejects.toMatchObject({ statusCode: 409 });
  });

  it('las líneas reutilizadas no dan insumos; las partes a rehacer sí, en la unidad del insumo', async () => {
    await expect(revisarInsumos(cliente(), orden([mini({ reuse: true })]), [{ insumo: 'Pan', cantidad: 1 }])).rejects.toMatchObject({ statusCode: 409 });
    const rehacer = { id: 'l0', name: 'Otra cosa', quantity: 1, onlySupplies: [{ name: 'Carne', quantity: 200, unit: 'g' }] };
    await expect(revisarInsumos(cliente(), orden([rehacer]), [{ insumo: 'Carne', cantidad: 0.2 }])).resolves.toBeUndefined();
  });

  it('una orden vieja sin líneas usa su producto y cantidad', async () => {
    const f = Array(17).fill(''); f[1] = 'Hamburguesa Mini'; f[2] = 3;
    await expect(revisarInsumos(cliente(), f, [{ insumo: 'Pan', cantidad: 3 }])).resolves.toBeUndefined();
  });

  it('convierte unidades igual que el panel', () => {
    expect(aBase(500, 'ml', 'L')).toBe(0.5);
    expect(aBase(2, 'und', 'paq', { tamano: 15, unidad: 'und' })).toBeCloseTo(2 / 15);
    expect(aBase(1, 'paq', 'und', { tamano: 12, unidad: 'und' })).toBe(12);
    expect(aBase(1, 'cucharada', 'kg')).toBeNull();
  });
});
