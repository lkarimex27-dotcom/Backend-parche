const { Pool, types } = require('pg');
const env = require('./env');

// pg devuelve BIGINT (20) y NUMERIC/DECIMAL (1700) como string. Los convertimos a número
// para que el JSON llegue limpio al frontend/Flutter (ids y montos están muy por debajo de 2^53).
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

// Neon exige SSL. Solo se desactiva si apuntas a un PostgreSQL local (localhost / 127.0.0.1).
// Tip: usa la cadena "pooled" (-pooler) de Neon para despliegues serverless.
const esLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(env.databaseUrl || '');
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: esLocal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

// Helper para consultas parametrizadas: query('SELECT * FROM x WHERE id=$1', [id])
const query = (text, params) => pool.query(text, params);

// Ejecuta varias consultas como una sola transacción (todo o nada).
// Uso: await withTransaction(async (client) => { await client.query(...); ... })
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Verifica la conexión (se usa al arrancar el servidor y en /api/health/db)
const testConnection = async () => {
  const { rows } = await pool.query('SELECT NOW() AS now, current_database() AS db');
  return rows[0];
};

module.exports = { pool, query, withTransaction, testConnection };
