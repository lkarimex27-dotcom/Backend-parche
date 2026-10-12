const router = require('express').Router();
const c = require('../controllers/rol.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/rol.validator');

const M = 'ROLES_PERMISOS';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), c.listar);
router.get('/catalogo', authorize(M, 'VER'), c.catalogo);   // módulos y privilegios disponibles
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.post('/', authorize(M, 'CREAR'), validate(v.crearRol), c.crear);
router.put('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarRol), c.actualizar);
router.put('/:id/permisos', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.permisos), c.reemplazarPermisos);
router.delete('/:id', authorize(M, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);

module.exports = router;
