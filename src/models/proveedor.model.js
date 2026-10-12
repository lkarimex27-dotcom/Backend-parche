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

module.exports = { listar, obtenerPorId, crear, actualizar };
