const router = require('express').Router();
const categoriaRoutes = require('./categoria.routes');
const insumoProductoRoutes = require('./insumoProducto.routes');
const panelRoutes = require('./panel.routes');
const PANEL = require('../config/panel.modulos');

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));

// Roles y permisos / Usuarios
router.use('/roles', require('./rol.routes'));
router.use('/usuarios', require('./usuario.routes'));

// Compras
router.use('/categorias-insumos', categoriaRoutes('INSUMO', 'CATEGORIAS_INSUMOS'));
router.use('/insumos', insumoProductoRoutes('INSUMO', 'INSUMOS'));
router.use('/proveedores', require('./proveedor.routes'));
router.use('/compras', require('./compra.routes'));                    // sube el stock
router.use('/perdidas-insumos', require('./perdida.routes'));          // baja el stock

// Producción
router.use('/categorias-productos', categoriaRoutes('PRODUCTO', 'CATEGORIAS_PRODUCTO'));
router.use('/productos', insumoProductoRoutes('PRODUCTO', 'PRODUCTOS'));
router.get('/catalogo', require('../controllers/insumoProducto.controller').catalogo); // público: menú del cliente
router.get('/imagenes/:id', require('../controllers/insumoProducto.controller').imagen); // público: fotos subidas
router.use('/ordenes-produccion', panelRoutes(PANEL.ordenes_produccion));
router.use('/productos-no-conformes', panelRoutes(PANEL.productos_no_conformes));
router.use('/consumos-produccion', require('./consumo.routes'));      // baja el stock al pasar a 'En cocina'

// Ventas
router.use('/clientes', require('./cliente.routes'));
router.use('/pedidos', require('./pedido.routes'));
router.use('/barrios', require('./barrio.routes'));
router.use('/pedidos-panel', panelRoutes(PANEL.pedidos_panel));     // pedidos creados a mano en el panel
router.use('/ventas', panelRoutes(PANEL.ventas));
router.use('/devoluciones', panelRoutes(PANEL.devoluciones));

module.exports = router;
