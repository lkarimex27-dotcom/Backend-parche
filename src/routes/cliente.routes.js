const router = require('express').Router();
const c = require('../controllers/usuario.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/usuario.validator');

const M = 'CLIENTES';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), validate(v.filtros, 'query'), c.listarClientes);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtenerCliente);

module.exports = router;
