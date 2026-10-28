const router = require('express').Router();
const c = require('../controllers/barrio.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/barrio.validator');

const ADMIN = 'BARRIOS';

router.get('/', authenticate, validate(v.buscar, 'query'), c.listar);
router.get('/admin', authenticate, authorize(ADMIN, 'VER'), c.listarTodos);
router.post('/admin', authenticate, authorize(ADMIN, 'CREAR'), validate(v.crear), c.crear);
router.patch('/admin/:id', authenticate, authorize(ADMIN, 'EDITAR'), validate(v.idParam, 'params'),
  validate(v.actualizar), c.actualizar);
router.post('/', authenticate, authorize(ADMIN, 'CREAR'), validate(v.crear), c.crear);
router.patch('/:id', authenticate, authorize(ADMIN, 'EDITAR'), validate(v.idParam, 'params'),
  validate(v.actualizar), c.actualizar);

module.exports = router;
