const router = require('express').Router();
const c = require('../controllers/proveedor.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/proveedor.validator');

const M = 'PROVEEDORES';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), validate(v.filtros, 'query'), c.listar);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.post('/', authorize(M, 'CREAR'), validate(v.crearProveedor), c.crear);
router.patch('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarProveedor), c.actualizar);
router.delete('/:id', authorize(M, 'ELIMINAR'), validate(v.idParam, 'params'), c.desactivar); // desactiva, no borra

module.exports = router;
