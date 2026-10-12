const router = require('express').Router();
const categoriaRoutes = require('./categoria.routes');
const insumoProductoRoutes = require('./insumoProducto.routes');

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));

// Roles y permisos / Usuarios
router.use('/roles', require('./rol.routes'));
router.use('/usuarios', require('./usuario.routes'));

// Compras
router.use('/categorias-insumos', categoriaRoutes('INSUMO', 'CATEGORIAS_INSUMOS'));
router.use('/insumos', insumoProductoRoutes('INSUMO', 'INSUMOS'));
router.use('/proveedores', require('./proveedor.routes'));
// router.use('/compras', ...)           // siguiente: transacción que sube el stock
// router.use('/perdidas-insumos', ...)  // siguiente: transacción que baja el stock

// Producción
router.use('/categorias-productos', categoriaRoutes('PRODUCTO', 'CATEGORIAS_PRODUCTO'));
router.use('/productos', insumoProductoRoutes('PRODUCTO', 'PRODUCTOS'));
// router.use('/ordenes-produccion', ...)
// router.use('/productos-no-conformes', ...)

// Ventas
router.use('/clientes', require('./cliente.routes'));
// router.use('/pedidos', ...)
// router.use('/ventas', ...)
// router.use('/devoluciones', ...)

module.exports = router;
