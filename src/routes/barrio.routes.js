const router = require('express').Router();
const { BARRIOS_BELLO } = require('../config/barrios');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/', authenticate, (_req, res) =>
  res.json({
    ok: true,
    data: BARRIOS_BELLO.map((nombre) => ({
      id_barrio: null,
      nombre,
      costo_domicilio_cop: null,
    })),
  }),
);

module.exports = router;
