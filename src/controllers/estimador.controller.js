const service = require('../services/estimador.service');
const asyncHandler = require('../utils/asyncHandler');

const estimar = asyncHandler(async (req, res) => {
  const { estimacion } = await service.calcular(
    req.body.id_barrio ?? req.body.nombre_barrio,
    undefined,
    req.body.distancia_km,
    req.body.tipo_entrega ?? 'domicilio',
    req.body.items,
    req.body.ubicacion,
  );
  res.json({ ok: true, data: estimacion });
});

module.exports = { estimar };
