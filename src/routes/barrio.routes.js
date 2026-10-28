const router = require('express').Router();
const c = require('../controllers/barrio.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/barrio.validator');

const M = 'BARRIOS';
router.use(authenticate);

router.get('/admin', authorize(M, 'VER'), c.listarTodos);
router.post('/admin', authorize(M, 'CREAR'), validate(v.crear), c.crear);
router.patch('/admin/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizar), c.actualizar);
router.delete('/admin/:id', authorize(M, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);
router.get('/', validate(v.buscar, 'query'), c.listar);

module.exports = router;
