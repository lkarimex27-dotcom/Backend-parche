const { query } = require('../config/db');

const listar = async ({ estado } = {}) =>
  (await query(
    `SELECT * FROM proveedores ${estado ? 'WHERE estado = $1' : ''} ORDER BY nombre`,
    estado ? [estado] : []
  )).rows;

const obtenerPorId = async (id) =>
  (await query('SELECT * FROM proveedores WHERE id_proveedor = $1', [id])).rows[0] || null;

// Columnas opcionales de texto (además de nombre y estado), en el orden de los parámetros
const EXTRAS = ['correo', 'telefono', 'contacto', 'tipo', 'nit', 'direccion', 'insumos',
  'contacto_tipo_documento', 'contacto_documento', 'contacto_telefono', 'contacto_correo', 'contacto_cargo'];

const crear = async (d) =>
  (await query(
    `INSERT INTO proveedores (nombre, estado, ${EXTRAS.join(', ')})
     VALUES ($1, COALESCE($2,'ACTIVO'), ${EXTRAS.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING *`,
    [d.nombre, d.estado ?? null, ...EXTRAS.map((k) => d[k] ?? null)]
  )).rows[0];

const actualizar = async (id, d) =>
  (await query(
    `UPDATE proveedores SET
        nombre = COALESCE($2, nombre), estado = COALESCE($3, estado),
        ${EXTRAS.map((k, i) => `${k} = COALESCE($${i + 4}, ${k})`).join(', ')}
      WHERE id_proveedor = $1 RETURNING *`,
    [id, d.nombre, d.estado, ...EXTRAS.map((k) => d[k])]
  )).rows[0] || null;

// Lo comprado queda en la lista de insumos que vende el proveedor (nombres separados por coma, sin repetir)
const agregarInsumos = async (c, idProveedor, idsInsumos) => {
  const nombres = (await c.query('SELECT nombre FROM insumos_productos WHERE id_insumo_producto = ANY($1::bigint[])', [[...new Set(idsInsumos)]]))
    .rows.map((r) => r.nombre);
  const { rows } = await c.query('SELECT insumos FROM proveedores WHERE id_proveedor = $1 FOR UPDATE', [idProveedor]);
  const actuales = String(rows[0]?.insumos ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  const nuevos = nombres.filter((n) => !actuales.some((a) => a.toLowerCase() === n.toLowerCase()));
  if (nuevos.length)
    await c.query('UPDATE proveedores SET insumos = $2 WHERE id_proveedor = $1', [idProveedor, [...actuales, ...nuevos].join(', ')]);
};

module.exports = { listar, obtenerPorId, crear, actualizar, agregarInsumos };
