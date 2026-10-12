const app = require('./app');
const env = require('./config/env');
const { testConnection, pool } = require('./config/db');

const start = async () => {
  if (!env.databaseUrl) {
    console.error('Falta DATABASE_URL en el archivo .env');
    process.exit(1);
  }
  if (!env.jwtSecret || env.jwtSecret.length < 32 || env.jwtSecret.startsWith('cambia_esto')) {
    console.error('JWT_SECRET falta, es muy corto (mín. 32 caracteres) o sigue siendo el de ejemplo. Genera uno nuevo.');
    process.exit(1);
  }
  try {
    const info = await testConnection();
    console.log(`Conectado a PostgreSQL (Neon) -> BD: ${info.db}`);
  } catch (err) {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`Servidor listo en http://localhost:${env.port}/api/health`);
  });

  const shutdown = async () => {
    console.log('Cerrando servidor...');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start();
