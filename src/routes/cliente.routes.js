const router = require('express').Router();
const c = require('../controllers/cliente.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/cliente.validator');

// Clientes = personas tipo CLIENTE (con cuenta de la app o creadas en el panel). El id es id_persona.
const M = 'CLIENTES';
router.use(authenticate);

router.get('/', authorize(M, 'VER'), c.listar);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.post('/', authorize(M, 'CREAR'), validate(v.crearCliente), c.crear);
router.patch('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarCliente), c.actualizar);
router.delete('/:id', authorize(M, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar); // solo clientes sin cuenta

module.exports = router;
