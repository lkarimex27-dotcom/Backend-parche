const router = require('express').Router();
const c = require('../controllers/perdida.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/perdida.validator');

// Registrar una pérdida descuenta el stock del insumo en la misma transacción.
const M = 'PERDIDA_INSUMOS';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), c.listar);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.post('/', authorize(M, 'CREAR'), validate(v.crearPerdida), c.crear);
router.put('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarPerdida), c.actualizar);

module.exports = router;
