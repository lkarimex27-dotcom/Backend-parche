const router = require('express').Router();
const c = require('../controllers/domicilio.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/domicilio.validator');

const M = 'DOMICILIOS';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), c.listar);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.post('/', authorize(M, 'CREAR'), validate(v.crearDomicilio), c.crear);
router.patch('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarDomicilio), c.actualizar);
router.delete('/:id', authorize(M, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);

module.exports = router;
