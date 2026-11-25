// Los insumos se manejan en su unidad más pequeña y en números enteros: g, ml o und.
// kg → g y L → ml (×1000); un "paq" pasa a lo que trae adentro (paquete de 12 und → und ×12).
const BASES = ['g', 'ml', 'und'];
const FACTOR = { kg: { a: 'g', f: 1000 }, L: { a: 'ml', f: 1000 }, g: { a: 'g', f: 1 }, ml: { a: 'ml', f: 1 }, und: { a: 'und', f: 1 } };

// La unidad entera de un insumo y por cuánto se multiplica lo que tenía.
// paq sin contenido definido: cada paquete cuenta como 1 und (hay que revisarlo a mano).
const destino = (medida, unidadesPaquete, contenido) => {
  if (medida === 'paq') {
    const n = Number(unidadesPaquete) || 0;
    return n > 0 ? { medida: contenido || 'und', factor: n, revisar: false } : { medida: 'und', factor: 1, revisar: true };
  }
  const x = FACTOR[medida];
  return x ? { medida: x.a, factor: x.f, revisar: false } : { medida: 'und', factor: 1, revisar: true };
};

// `cantidad` en `desde` (kg, g, L, ml, und o paq del insumo) → en la unidad entera `hacia`. null si no se puede.
// pack: lo que trae un paquete del insumo antes de convertirlo ({ n, contenido }).
const convertir = (cantidad, desde, hacia, pack) => {
  const q = Number(cantidad);
  if (!Number.isFinite(q)) return null;
  if (desde === 'paq') return pack && pack.n > 0 ? convertir(q * pack.n, pack.contenido || 'und', hacia) : null;
  const d = FACTOR[desde];
  const h = FACTOR[hacia];
  if (!d || !h || d.a !== h.a) return desde === hacia ? q : null;
  return (q * d.f) / h.f;
};

// Sin el ruido de los decimales flotantes (0.15 × 1000 = 150.00000000000003)
const limpio = (n) => Math.round(n * 1000) / 1000;

module.exports = { BASES, destino, convertir, limpio };
