const router = require('express').Router();
const c = require('../controllers/barrio.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/barrio.validator');

const ADMIN = 'BARRIOS';

router.get('/admin', authorize(M, 'VER'), c.listarTodos);
router.post('/admin', authorize(M, 'CREAR'), validate(v.crear), c.crear);
router.patch('/admin/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizar), c.actualizar);
router.delete('/admin/:id', authorize(M, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);
// Rutas compatibles con el panel (sin /admin)
router.post('/', authorize(M, 'CREAR'), validate(v.crear), c.crear);
router.patch('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizar), c.actualizar);

module.exports = router;
