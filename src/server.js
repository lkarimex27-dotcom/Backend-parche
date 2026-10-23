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
  // Reintenta: un corte breve de internet (WiFi, suspensión del PC) no debe tumbar el arranque
  const INTENTOS = 5;
  for (let intento = 1; ; intento++) {
    try {
      const info = await testConnection();
      console.log(`Conectado a PostgreSQL (Neon) -> BD: ${info.db}`);
      break;
    } catch (err) {
      if (intento === INTENTOS) {
        console.error(`No se pudo conectar a la base de datos tras ${INTENTOS} intentos:`, err.message);
        console.error('Revisa tu conexión a internet y la DATABASE_URL del .env.');
        process.exit(1);
      }
      console.warn(`No se pudo conectar a la base de datos (${err.message}). Reintento ${intento}/${INTENTOS - 1} en 3 s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const server = app.listen(env.port, () => {
    console.log(`Servidor listo en http://localhost:${env.port}/api/health`);
  });
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `El puerto ${env.port} ya está en uso: probablemente el backend ya está corriendo en otra terminal.\n` +
          'Usa esa terminal, o detenla con Ctrl + C y vuelve a iniciar este.'
      );
    } else {
      console.error('No se pudo iniciar el servidor:', err.message);
    }
    await pool.end();
    process.exit(1);
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
