const { Router } = require('express');
const c = require('../controllers/categoria.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const v = require('../validators/categoria.validator');

// Fábrica: se monta una vez para insumos y otra para productos.
//   categoriaRoutes('INSUMO', 'CATEGORIAS_INSUMOS')  ->  /api/categorias-insumos
//   categoriaRoutes('PRODUCTO', 'CATEGORIAS_PRODUCTO') -> /api/categorias-productos
module.exports = (tipo, modulo) => {
  const router = Router();
  router.use(authenticate);
  router.use((req, _res, next) => { req.tipo = tipo; next(); });

  router.get('/', authorize(modulo, 'VER'), c.listar);
  router.get('/:id', authorize(modulo, 'VER'), validate(v.idParam, 'params'), c.obtener);
  router.post('/', authorize(modulo, 'CREAR'), validate(v.crearCategoria), c.crear);
  router.put('/:id', authorize(modulo, 'EDITAR'), validate(v.idParam, 'params'), validate(v.actualizarCategoria), c.actualizar);
  router.delete('/:id', authorize(modulo, 'ELIMINAR'), validate(v.idParam, 'params'), c.eliminar);
  return router;
};
