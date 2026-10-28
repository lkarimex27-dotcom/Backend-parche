const service = require('../services/estimador.service');
const asyncHandler = require('../utils/asyncHandler');

const estimar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.estimar(req.body) }));

module.exports = { estimar };
