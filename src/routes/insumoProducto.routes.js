const { Router } = require('express');
const c = require('../controllers/insumoProducto.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/insumoProducto.validator');

// Fábrica:  insumoProductoRoutes('INSUMO', 'INSUMOS')  ->  /api/insumos
//           insumoProductoRoutes('PRODUCTO', 'PRODUCTOS') -> /api/productos
// GET /api/productos?id_categoria=1&bajoMinimo=true
module.exports = (tipo, modulo) => {
  const router = Router();
  router.use(authenticate);
  router.use((req, _res, next) => { req.tipo = tipo; next(); });

  router.get('/', authorize(modulo, 'VER'), validate(v.filtros, 'query'), c.listar);
  router.get('/:id', authorize(modulo, 'VER'), validate(v.idParam, 'params'), c.obtener);
  router.post('/', authorize(modulo, 'CREAR'), validate(v.crearInsumoProducto), c.crear);
  router.patch('/:id', authorize(modulo, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarInsumoProducto), c.actualizar);
  router.delete('/:id', authorize(modulo, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);
  return router;
};
