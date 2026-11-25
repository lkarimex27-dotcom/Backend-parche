// Pasa los insumos a unidades enteras (g, ml, und): stock, mínimo, costo, recetas, compras, pérdidas e historial.
// Uso:  node src/utils/convertirUnidadesEnteras.js --prueba   (hace todo y lo deshace: solo muestra el reporte)
//       node src/utils/convertirUnidadesEnteras.js            (lo aplica)
// Antes de aplicar guarda un respaldo JSON de todo lo que toca. Todo va en una transacción: si algo falla, no cambia nada.
// También pone la porción por pedido de las salsas de la casa que no la tengan: 30 ml / 30 g / 1 und.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/db');
const { BASES, destino, convertir, limpio } = require('./unidadesEnteras');

const PRUEBA = process.argv.includes('--prueba');

// "Azúcar (0.05 kg), Limón (2 und)" → misma lista con cada insumo convertido a su unidad entera
const convertirTexto = (texto, porNombre) =>
  String(texto ?? '')
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map((parte) => {
      const m = /^(.*?)\s*\(\s*([\d.]+)\s*([^)]*)\)$/.exec(parte);
      if (!m) return parte;
      const ins = porNombre.get(m[1].trim().toLowerCase());
      if (!ins) return parte;
      const q = convertir(m[2], m[3].trim() || ins.antes, ins.medida, ins.pack);
      return q === null ? parte : `${m[1]} (${limpio(q)} ${ins.medida})`;
    })
    .join(', ');

(async () => {
  const c = await pool.connect();
  const reporte = { insumos: [], redondeos: [], recetasSinConvertir: [], revisar: [], porciones: [] };
  try {
    const insumos = (await c.query(
      `SELECT id_insumo_producto AS id, nombre, medida, stock::float, minimo::float, maximo::float, costo::float,
              unidades_paquete, contenido_unidad, tiene_ficha_tecnica
         FROM insumos_productos WHERE tipo = 'INSUMO'`
    )).rows;
    const cambia = insumos
      .filter((i) => !BASES.includes(i.medida))
      .map((i) => {
        const d = destino(i.medida, i.unidades_paquete, i.contenido_unidad);
        return { ...i, antes: i.medida, medida: d.medida, factor: d.factor, revisar: d.revisar,
          pack: i.medida === 'paq' && Number(i.unidades_paquete) > 0 ? { n: Number(i.unidades_paquete), contenido: i.contenido_unidad || 'und' } : null };
      });
    const ids = cambia.map((i) => i.id);
    // Todos los insumos por nombre (para las recetas en texto), con su unidad final
    const porNombre = new Map(insumos.map((i) => {
      const x = cambia.find((y) => y.id === i.id);
      return [i.nombre.trim().toLowerCase(), x || { ...i, antes: i.medida, pack: null }];
    }));

    // Respaldo de todo lo que se va a tocar
    const respaldo = {
      fecha: new Date().toISOString(),
      insumos,
      ficha_tecnica_insumos: (await c.query('SELECT * FROM ficha_tecnica_insumos')).rows,
      fichas_tecnicas: (await c.query('SELECT id_ficha_tecnica, id_insumo_producto, insumos_principales FROM fichas_tecnicas')).rows,
      detalle_compras: (await c.query('SELECT * FROM detalle_compras WHERE id_insumo_producto = ANY($1)', [ids])).rows,
      perdidas_insumos: (await c.query('SELECT * FROM perdidas_insumos WHERE id_insumo_producto = ANY($1)', [ids])).rows,
      movimientos_stock: (await c.query('SELECT * FROM movimientos_stock WHERE id_insumo_producto = ANY($1)', [ids])).rows,
    };
    const archivo = path.join(process.env.RESPALDO_DIR || path.join(__dirname, '../../respaldos'), `unidades-enteras-${Date.now()}.json`);
    if (!PRUEBA) {
      fs.mkdirSync(path.dirname(archivo), { recursive: true });
      fs.writeFileSync(archivo, JSON.stringify(respaldo));
      console.log('Respaldo:', archivo);
    }

    await c.query('BEGIN');
    // El historial se convierte aparte: que el trigger no anote la conversión como un movimiento
    await c.query('ALTER TABLE insumos_productos DISABLE TRIGGER tr_movimiento_stock');

    for (const i of cambia) {
      const stock = limpio(i.stock * i.factor);
      if (stock !== Math.round(stock)) reporte.redondeos.push({ insumo: i.nombre, era: `${i.stock} ${i.antes}`, exacto: `${stock} ${i.medida}`, queda: Math.round(stock) });
      await c.query(
        `UPDATE insumos_productos
            SET stock = $2, minimo = $3, maximo = $4, costo = round(costo / $5::numeric, 2), medida = $6,
                unidades_paquete = NULL, contenido_unidad = NULL
          WHERE id_insumo_producto = $1`,
        [i.id, Math.round(stock), Math.round(limpio(i.minimo * i.factor)),
         i.maximo == null || i.antes === 'paq' ? null : Math.round(limpio(i.maximo * i.factor)), i.factor, i.medida]
      );
      await c.query('UPDATE movimientos_stock SET cantidad = cantidad * $2, stock_resultante = stock_resultante * $2 WHERE id_insumo_producto = $1', [i.id, i.factor]);
      await c.query('UPDATE perdidas_insumos SET cantidad = round(cantidad * $2), cantidad_devuelta = round(cantidad_devuelta * $2) WHERE id_insumo_producto = $1', [i.id, i.factor]);
      // Compras: cada línea desde la unidad con que se registró
      for (const d of (await c.query('SELECT id_detalle_compra, medida, cantidad::float FROM detalle_compras WHERE id_insumo_producto = $1', [i.id])).rows) {
        const f = convertir(1, d.medida || i.antes, i.medida, i.pack);
        if (f === null) continue;
        await c.query(
          `UPDATE detalle_compras SET cantidad = round(cantidad * $2::numeric), costo_unitario = round(costo_unitario / $2::numeric, 2), medida = $3
            WHERE id_detalle_compra = $1`,
          [d.id_detalle_compra, f, i.medida]
        );
      }
      // El stock debe seguir siendo la suma de su historial: lo que se redondeó queda como un movimiento
      const { suma } = (await c.query('SELECT COALESCE(sum(cantidad), 0)::float AS suma FROM movimientos_stock WHERE id_insumo_producto = $1', [i.id])).rows[0];
      const diferencia = limpio(Math.round(stock) - suma);
      if (diferencia !== 0) {
        await c.query(
          `INSERT INTO movimientos_stock (id_insumo_producto, cantidad, stock_resultante, origen, referencia)
           VALUES ($1, $2, $3, 'CONVERSION_UNIDADES', $4)`,
          [i.id, diferencia, Math.round(stock), `Paso de ${i.antes} a ${i.medida} enteros`]
        );
      }
      if (i.revisar) reporte.revisar.push(`${i.nombre}: era «${i.antes}» sin contenido por paquete; quedó 1 paq = 1 und`);
      reporte.insumos.push({ insumo: i.nombre, antes: `${i.stock} ${i.antes}`, ahora: `${Math.round(stock)} ${i.medida}`, costo: `${i.costo} → ${Math.round((i.costo / i.factor) * 100) / 100} por ${i.medida}` });
    }

    // Recetas (fichas de productos y de insumos): cada cantidad en la unidad entera de su insumo
    for (const r of (await c.query(
      `SELECT fi.id_ficha_tecnica_insumo AS id, fi.medida, fi.cantidad::float, i.id_insumo_producto, i.nombre
         FROM ficha_tecnica_insumos fi JOIN insumos_productos i ON i.id_insumo_producto = fi.id_insumo_producto
        WHERE i.tipo = 'INSUMO'`
    )).rows) {
      const ins = cambia.find((x) => x.id === r.id_insumo_producto) || { ...insumos.find((x) => x.id === r.id_insumo_producto), pack: null };
      const desde = r.medida || ins.antes || ins.medida;
      if (desde === ins.medida && Number.isInteger(r.cantidad)) continue;
      const q = convertir(r.cantidad, desde, ins.medida, ins.pack);
      if (q === null) { reporte.recetasSinConvertir.push(`${r.nombre}: ${r.cantidad} ${desde}`); continue; }
      const entera = Math.max(1, Math.round(limpio(q)));
      if (limpio(q) !== entera) reporte.redondeos.push({ receta: r.nombre, exacto: `${limpio(q)} ${ins.medida}`, queda: entera });
      await c.query('UPDATE ficha_tecnica_insumos SET cantidad = $2, medida = $3 WHERE id_ficha_tecnica_insumo = $1', [r.id, entera, ins.medida]);
    }
    // La receta en texto de cada producto de insumo ("Aceite (0.5 L)") también
    for (const f of respaldo.fichas_tecnicas.filter((x) => x.insumos_principales)) {
      const nuevo = convertirTexto(f.insumos_principales, porNombre);
      if (nuevo !== f.insumos_principales)
        await c.query('UPDATE fichas_tecnicas SET insumos_principales = $2 WHERE id_ficha_tecnica = $1', [f.id_ficha_tecnica, nuevo]);
    }

    // Porción por pedido de las salsas de la casa: 30 ml / 30 g / 1 und
    reporte.porciones = (await c.query(
      `UPDATE insumos_productos SET porcion = CASE medida WHEN 'und' THEN 1 ELSE 30 END
        WHERE tipo = 'INSUMO' AND tiene_ficha_tecnica AND porcion IS NULL
        RETURNING nombre, porcion::float AS porcion, medida`
    )).rows.map((r) => `${r.nombre}: ${r.porcion} ${r.medida}`);

    await c.query('ALTER TABLE insumos_productos ENABLE TRIGGER tr_movimiento_stock');

    // Comprobaciones: todo en g/ml/und, sin decimales, y el stock = suma de su historial
    const malos = (await c.query(
      `SELECT nombre, medida, stock::float FROM insumos_productos
        WHERE tipo = 'INSUMO' AND (medida NOT IN ('g', 'ml', 'und') OR stock <> trunc(stock) OR minimo <> trunc(minimo))`
    )).rows;
    const descuadres = (await c.query(
      `SELECT ip.nombre, ip.stock::float, COALESCE(sum(m.cantidad), 0)::float AS historial
         FROM insumos_productos ip LEFT JOIN movimientos_stock m ON m.id_insumo_producto = ip.id_insumo_producto
        WHERE ip.id_insumo_producto = ANY($1) GROUP BY ip.id_insumo_producto HAVING ip.stock <> COALESCE(sum(m.cantidad), 0)`,
      [ids]
    )).rows;
    if (malos.length || descuadres.length) throw new Error(`Comprobación fallida: ${JSON.stringify({ malos, descuadres })}`);

    await c.query(PRUEBA ? 'ROLLBACK' : 'COMMIT');
    console.log(PRUEBA ? '\nPRUEBA: nada se guardó (se deshizo).' : '\nListo: unidades enteras aplicadas.');
    console.table(reporte.insumos);
    if (reporte.redondeos.length) { console.log('Redondeos:'); console.table(reporte.redondeos); }
    if (reporte.recetasSinConvertir.length) console.log('Recetas sin convertir (revisar):', reporte.recetasSinConvertir);
    if (reporte.revisar.length) console.log('Revisar:', reporte.revisar);
    console.log('Porciones puestas:', reporte.porciones);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('No se cambió nada:', e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
