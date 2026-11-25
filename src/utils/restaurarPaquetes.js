// Devuelve a cada insumo el contenido de su paquete (pan x 12 und, queso x 20 tajadas…) que tenía antes de pasar
// a g, ml o und, tomado del respaldo que dejó convertirUnidadesEnteras.js (respaldos/unidades-enteras-*.json).
// Uso:  node src/utils/restaurarPaquetes.js            (solo muestra qué haría: no escribe nada)
//       node src/utils/restaurarPaquetes.js --aplicar  (lo guarda)
// Solo toca insumos que hoy no tienen paquete y cuya medida es la del contenido (12 und → insumo en und).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/db');

const APLICAR = process.argv.includes('--aplicar');
const carpeta = path.join(__dirname, '../../respaldos');
const archivo = fs.readdirSync(carpeta).filter((f) => /^unidades-enteras-.*\.json$/.test(f)).sort().pop();
if (!archivo) {
  console.log('No hay respaldo de unidades-enteras en', carpeta);
  process.exit(1);
}
const antes = JSON.parse(fs.readFileSync(path.join(carpeta, archivo), 'utf8')).insumos
  .filter((i) => Number(i.unidades_paquete) > 0);

(async () => {
  const c = await pool.connect();
  try {
    const hoy = new Map((await c.query(
      `SELECT id_insumo_producto AS id, nombre, medida, unidades_paquete FROM insumos_productos WHERE tipo = 'INSUMO'`
    )).rows.map((i) => [i.id, i]));
    const cambios = [];
    for (const i of antes) {
      const actual = hoy.get(i.id);
      const contenido = i.contenido_unidad || 'und';
      const motivo = !actual ? 'ya no existe'
        : Number(actual.unidades_paquete) > 0 ? `ya tiene paquete de ${actual.unidades_paquete} ${actual.medida}`
        : actual.medida !== contenido ? `hoy se mide en ${actual.medida}, el paquete era de ${contenido}`
        : null;
      console.log(`${motivo ? '  ·' : '  ✓'} ${i.nombre}: paquete de ${i.unidades_paquete} ${contenido}${motivo ? ` (se deja: ${motivo})` : ''}`);
      if (!motivo) cambios.push({ id: i.id, n: Number(i.unidades_paquete), contenido });
    }
    if (!APLICAR) {
      console.log(`\n${cambios.length} insumo(s) recuperarían su paquete. Nada se guardó: corre con --aplicar para hacerlo.`);
      return;
    }
    await c.query('BEGIN');
    // La columna la crea el servidor al arrancar; por si este script corre antes de reiniciarlo
    await c.query('ALTER TABLE insumos_productos ADD COLUMN IF NOT EXISTS empaque VARCHAR(10)');
    for (const x of cambios)
      await c.query(
        "UPDATE insumos_productos SET unidades_paquete = $2, contenido_unidad = $3, empaque = COALESCE(empaque, 'Paquete') WHERE id_insumo_producto = $1",
        [x.id, x.n, x.contenido],
      );
    await c.query('COMMIT');
    console.log(`\nListo: ${cambios.length} insumo(s) recuperaron su paquete (respaldo ${archivo}).`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.log('ERROR, no se guardó nada:', e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
