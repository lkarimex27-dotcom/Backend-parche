// Ejecuta sql/init.sql contra Neon:  npm run db:init
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../../sql/init.sql'), 'utf8');
    await pool.query(sql);
    console.log('Esquema inicial creado/actualizado correctamente.');
  } catch (err) {
    console.error('Error ejecutando init.sql:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
