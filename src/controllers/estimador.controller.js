const service = require('../services/estimador.service');
const asyncHandler = require('../utils/asyncHandler');

const estimar = asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: await service.calcular(req.body.id_barrio, undefined, undefined, req.body.tipo_entrega),
  });
});

module.exports = { estimar };
