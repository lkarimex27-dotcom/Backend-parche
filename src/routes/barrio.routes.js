const router = require('express').Router();
const c = require('../controllers/barrio.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/barrio.validator');

const ADMIN = 'BARRIOS';

router.get('/', c.listar);
router.use(authenticate);
router.get('/admin', authorize(ADMIN, 'VER'), c.listarTodos);
router.post('/admin', authorize(ADMIN, 'CREAR'), validate(v.crear), c.crear);
router.patch('/admin/:id', authorize(ADMIN, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizar), c.actualizar);
router.delete('/admin/:id', authorize(ADMIN, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);
// Rutas compatibles con el panel (sin /admin)
router.post('/', authorize(ADMIN, 'CREAR'), validate(v.crear), c.crear);
router.patch('/:id', authorize(ADMIN, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizar), c.actualizar);

module.exports = router;
