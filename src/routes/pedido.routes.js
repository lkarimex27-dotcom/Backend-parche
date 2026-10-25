const router = require('express').Router();
const c = require('../controllers/pedido.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/pedido.validator');
const estimador = require('../controllers/estimador.controller');
const estimacionValidator = require('../validators/estimador.validator');

const M = 'PEDIDOS';
router.use(authenticate);

// Cliente (cualquier usuario con sesión): hace sus pedidos, los ve y sube el comprobante de pago
router.post('/estimacion', validate(estimacionValidator.estimar), estimador.estimar);
router.post('/', validate(v.crearPedido), c.crear);
router.get('/mios', c.listarMios);
router.patch('/:id/comprobante', validate(v.idParam, 'params'), validate(v.subirComprobante), c.subirComprobante);

// Panel
router.get('/', authorize(M, 'VER'), c.listar);
router.get('/:id', authorize(M, 'VER'), validate(v.idParam, 'params'), c.obtener);
router.patch('/:id', authorize(M, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarPedido), c.actualizar);

module.exports = router;
