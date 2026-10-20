const router = require('express').Router();
const c = require('../controllers/compra.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/compra.validator');

// Registrar/editar/anular una compra mueve el stock de sus insumos en la misma transacción.
const M = 'COMPRAS';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), c.listar);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.post('/', authorize(M, 'CREAR'), validate(v.crearCompra), c.crear);
router.put('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarCompra), c.actualizar);
router.patch('/:id/estado', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.estado), c.cambiarEstado);

module.exports = router;
