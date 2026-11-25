const { destino, convertir, limpio } = require('../src/utils/unidadesEnteras');

describe('Paso de los insumos a unidades enteras', () => {
  it('kg → g, L → ml, paquete → lo que trae adentro', () => {
    expect(destino('kg')).toEqual({ medida: 'g', factor: 1000, revisar: false });
    expect(destino('L')).toEqual({ medida: 'ml', factor: 1000, revisar: false });
    expect(destino('paq', 12, 'und')).toEqual({ medida: 'und', factor: 12, revisar: false });
    expect(destino('paq', 250, 'g')).toEqual({ medida: 'g', factor: 250, revisar: false });
    expect(destino('g')).toEqual({ medida: 'g', factor: 1, revisar: false });
  });

  it('un paquete sin contenido cuenta como 1 und y queda marcado para revisar', () => {
    expect(destino('paq', null, null)).toEqual({ medida: 'und', factor: 1, revisar: true });
  });

  it('convierte las cantidades de recetas y compras a la unidad entera', () => {
    expect(limpio(convertir(0.15, 'kg', 'g'))).toBe(150);
    expect(convertir(50, 'g', 'g')).toBe(50);
    expect(limpio(convertir(0.03, 'L', 'ml'))).toBe(30);
    expect(convertir(2, 'paq', 'und', { n: 12, contenido: 'und' })).toBe(24);
    expect(convertir(3, 'und', 'und')).toBe(3);
    expect(convertir(1, 'paq', 'g', { n: 250, contenido: 'g' })).toBe(250);
  });

  it('no inventa conversiones entre masa, volumen y unidades', () => {
    expect(convertir(1, 'kg', 'ml')).toBeNull();
    expect(convertir(1, 'paq', 'und')).toBeNull(); // paquete sin contenido conocido
    expect(convertir(1, 'cucharada', 'g')).toBeNull();
  });
});
