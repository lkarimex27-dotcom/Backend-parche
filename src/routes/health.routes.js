const router = require('express').Router();
const { testConnection } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', (_req, res) => res.json({ ok: true, servicio: 'parche-backend', hora: new Date() }));

router.get('/db', asyncHandler(async (_req, res) => {
  const info = await testConnection();
  res.json({ ok: true, baseDeDatos: info.db, horaDB: info.now });
}));

module.exports = router;
