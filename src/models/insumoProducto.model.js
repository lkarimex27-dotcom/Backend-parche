const { query, withTransaction } = require('../config/db');

// Fotos subidas (data URL) se devuelven como /imagenes/<id> (GET /api/imagenes/:id) para no inflar los listados.
// La ficha técnica va completa (nombre, versión, preparación y receta con sus insumos).
const BASE = `
  SELECT ip.*, c.nombre_categoria,
         COALESCE(
           (SELECT json_agg(CASE WHEN i.url LIKE 'data:%' THEN '/imagenes/' || i.id_imagen ELSE i.url END ORDER BY i.id_imagen)
              FROM imagenes i WHERE i.id_producto = ip.id_insumo_producto),
           '[]'::json
         ) AS imagenes,
         (SELECT json_build_object(
                   'nombre', f.nombre, 'version', f.version, 'preparacion', f.preparacion,
                   'insumos_principales', f.insumos_principales,
                   'ingredientes', COALESCE((
                     SELECT json_agg(json_build_object('insumo', ins.nombre, 'cantidad', fi.cantidad::float, 'medida', fi.medida)
                                     ORDER BY fi.id_ficha_tecnica_insumo)
                       FROM ficha_tecnica_insumos fi
                       JOIN insumos_productos ins ON ins.id_insumo_producto = fi.id_insumo_producto
                      WHERE fi.id_ficha_tecnica = f.id_ficha_tecnica), '[]'::json))
            FROM fichas_tecnicas f WHERE f.id_insumo_producto = ip.id_insumo_producto) AS ficha
    FROM insumos_productos ip
    JOIN categorias c ON c.id_categoria = ip.id_categoria`;

// `tipo` = 'INSUMO' | 'PRODUCTO' (la tabla es una sola; el módulo decide qué parte ve)
const listar = async (tipo, { id_categoria, bajoMinimo } = {}) => {
  const where = ['ip.tipo = $1'];
  const params = [tipo];
  if (id_categoria) { params.push(id_categoria); where.push(`ip.id_categoria = $${params.length}`); }
  if (bajoMinimo) where.push('ip.stock <= ip.minimo');
  return (await query(`${BASE} WHERE ${where.join(' AND ')} ORDER BY ip.id_insumo_producto`, params)).rows;
};

const obtenerPorId = async (tipo, id) =>
  (await query(`${BASE} WHERE ip.id_insumo_producto = $1 AND ip.tipo = $2`, [id, tipo])).rows[0] || null;

const crear = async (tipo, d) =>
  (await query(
    `INSERT INTO insumos_productos
       (nombre, tipo, medida, stock, minimo, maximo, id_categoria, costo, precio, tiene_ficha_tecnica, descripcion, etiqueta, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_insumo_producto`,
    [d.nombre, tipo, d.medida ?? null, d.stock ?? 0, d.minimo ?? 0, d.maximo ?? null,
     d.id_categoria, d.costo ?? 0, d.precio ?? 0, d.tiene_ficha_tecnica ?? false, d.descripcion ?? null, d.etiqueta ?? null,
     d.estado ?? 'ACTIVO']
  )).rows[0];

const actualizar = async (tipo, id, d) =>
  (await query(
    `UPDATE insumos_productos SET
        nombre              = COALESCE($3, nombre),
        medida              = COALESCE($4, medida),
        stock               = COALESCE($5, stock),
        minimo              = COALESCE($6, minimo),
        maximo              = COALESCE($7, maximo),
        id_categoria        = COALESCE($8, id_categoria),
        costo               = COALESCE($9, costo),
        precio              = COALESCE($10, precio),
        tiene_ficha_tecnica = COALESCE($11, tiene_ficha_tecnica),
        descripcion         = COALESCE($12, descripcion),
        etiqueta            = COALESCE($13, etiqueta),
        estado              = COALESCE($14, estado)
      WHERE id_insumo_producto = $1 AND tipo = $2 RETURNING id_insumo_producto`,
    [id, tipo, d.nombre, d.medida, d.stock, d.minimo, d.maximo, d.id_categoria, d.costo, d.precio, d.tiene_ficha_tecnica,
     d.descripcion, d.etiqueta, d.estado]
  )).rows[0] || null;

// Borra también su propia ficha técnica y lo quita de las recetas; si está en compras, pérdidas o pedidos, Postgres lo impide (409)
const eliminar = (tipo, id) =>
  withTransaction(async (c) => {
    await c.query(
      `DELETE FROM ficha_tecnica_insumos WHERE id_ficha_tecnica IN
         (SELECT id_ficha_tecnica FROM fichas_tecnicas WHERE id_insumo_producto = $1)`,
      [id]
    );
    await c.query('DELETE FROM fichas_tecnicas WHERE id_insumo_producto = $1', [id]);
    // Sale de las recetas de los productos que lo usaban (compras y pérdidas sí lo bloquean: son historial)
    await c.query('DELETE FROM ficha_tecnica_insumos WHERE id_insumo_producto = $1', [id]);
    return (await c.query('DELETE FROM insumos_productos WHERE id_insumo_producto = $1 AND tipo = $2', [id, tipo])).rowCount > 0;
  });

// Ficha técnica: una por producto/insumo; la receta se reemplaza completa
const guardarFicha = async (c, id, d) => {
  const { id_ficha_tecnica } = (await c.query(
    `INSERT INTO fichas_tecnicas (id_insumo_producto, nombre, version, insumos_principales, preparacion)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_insumo_producto) DO UPDATE
       SET nombre = EXCLUDED.nombre, version = EXCLUDED.version,
           insumos_principales = EXCLUDED.insumos_principales, preparacion = EXCLUDED.preparacion
     RETURNING id_ficha_tecnica`,
    [id, d.nombre ?? null, d.version ?? null, d.insumos_principales ?? null, d.preparacion ?? null]
  )).rows[0];
  if (!d.ingredientes) return null; // receta sin cambios
  await c.query('DELETE FROM ficha_tecnica_insumos WHERE id_ficha_tecnica = $1', [id_ficha_tecnica]);
  for (const ing of d.ingredientes) {
    const r = await c.query(
      `INSERT INTO ficha_tecnica_insumos (id_ficha_tecnica, id_insumo_producto, tipo, medida, cantidad)
       SELECT $1, id_insumo_producto, tipo, COALESCE($3::varchar, medida), $4::numeric FROM insumos_productos
        WHERE lower(nombre) = lower($2::text) AND tipo = 'INSUMO' LIMIT 1`,
      [id_ficha_tecnica, ing.insumo, ing.medida ?? null, ing.cantidad]
    );
    if (!r.rowCount) return ing.insumo; // insumo inexistente: el service revierte
  }
  return null;
};

// Reemplaza la foto del producto (data URL subida o URL externa)
const reemplazarImagen = async (c, id, url) => {
  await c.query('DELETE FROM imagenes WHERE id_producto = $1', [id]);
  await c.query('INSERT INTO imagenes (id_producto, url) VALUES ($1, $2)', [id, url]);
};

const obtenerImagen = async (idImagen) =>
  (await query('SELECT url FROM imagenes WHERE id_imagen = $1', [idImagen])).rows[0]?.url ?? null;

// Un insumo "alcanza" para vender si tiene lo que pide la receta y no está por debajo de su mínimo
const AGOTADO = 'i.stock < fi.cantidad OR i.stock < i.minimo OR i.estado <> \'ACTIVO\''

// Productos con receta que hoy no se pueden preparar (algún insumo agotado o bajo su mínimo)
const productosSinStock = async () =>
  (await query(
    `SELECT DISTINCT f.id_insumo_producto AS id
       FROM fichas_tecnicas f
       JOIN ficha_tecnica_insumos fi ON fi.id_ficha_tecnica = f.id_ficha_tecnica
       JOIN insumos_productos i ON i.id_insumo_producto = fi.id_insumo_producto
      WHERE ${AGOTADO}`
  )).rows.map((r) => Number(r.id));

// Insumos que se venden tal cual (las gaseosas: "Gaseosa Coca-Cola 1.5 L") y hoy tienen stock para vender
const insumosVendibles = async () =>
  (await query(
    `SELECT nombre FROM insumos_productos
      WHERE tipo = 'INSUMO' AND estado = 'ACTIVO' AND stock >= 1 AND stock >= minimo`
  )).rows.map((r) => r.nombre);

module.exports = {
  listar, obtenerPorId, crear, actualizar, eliminar, guardarFicha, reemplazarImagen, obtenerImagen,
  productosSinStock, insumosVendibles,
};
