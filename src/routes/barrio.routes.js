const router = require('express').Router();
const c = require('../controllers/barrio.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/barrio.validator');

// Opciones del checkout: los barrios activos con su tiempo y costo de domicilio (módulo Domicilios).
// Sin sesión: un invitado también ve cuánto cuesta el domicilio a su barrio
router.get('/', validate(v.buscar, 'query'), c.listar);

// Módulo Domicilios del panel: los barrios de la base de datos con su tiempo estimado y costo de domicilio
router.get('/admin', authenticate, authorize('BARRIOS', 'VER'), c.listarTodos);
router.post('/admin', authenticate, authorize('BARRIOS', 'CREAR'), validate(v.crear), c.crear);
router.patch('/admin/:id', authenticate, authorize('BARRIOS', 'EDITAR'), validate(v.idParam, 'params'),
  validate(v.actualizar), c.actualizar);

module.exports = router;
