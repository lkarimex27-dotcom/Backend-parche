const router = require('express').Router();
const { z } = require('zod');
const categoriaRoutes = require('./categoria.routes');
const insumoProductoRoutes = require('./insumoProducto.routes');
const panelRoutes = require('./panel.routes');
const PANEL = require('../config/panel.modulos');
const Panel = require('../models/panel.model');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const filaPanel = z.array(z.union([z.string().max(100_000), z.number(), z.null()])).min(1).max(40);
const pncConReposicionBody = z.object({
  producto_no_conforme: filaPanel,
  orden_produccion: filaPanel,
  orden_produccion_afectada: z.object({
    id: z.coerce.number().int().positive(),
    datos_panel: filaPanel,
  }).optional(),
});

const authorizeEdicionOrdenSiAplica = (req, res, next) =>
  req.body.orden_produccion_afectada
    ? authorize('ORDENES_PRODUCCION', 'EDITAR')(req, res, next)
    : next();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));

router.post(
  '/productos-no-conformes/con-reposicion',
  authenticate,
  authorize('PRODUCTO_NO_CONFORME', 'CREAR'),
  authorize('ORDENES_PRODUCCION', 'CREAR'),
  validate(pncConReposicionBody),
  authorizeEdicionOrdenSiAplica,
  asyncHandler(async (req, res) => {
    const { producto_no_conforme, orden_produccion, orden_produccion_afectada } = req.body;
    const { idA: idProductoNoConforme, idB: idOrdenProduccion } = await Panel.crearPar({
      cfgA: PANEL.productos_no_conformes,
      filaA: producto_no_conforme,
      cfgB: PANEL.ordenes_produccion,
      filaB: orden_produccion,
      idUsuario: req.user.id,
      ...(orden_produccion_afectada
        ? {
            actualizarExistente: {
              cfg: PANEL.ordenes_produccion,
              id: orden_produccion_afectada.id,
              fila: orden_produccion_afectada.datos_panel,
            },
          }
        : {}),
    });

    res.status(201).json({
      ok: true,
      data: {
        id_producto_no_conforme: idProductoNoConforme,
        id_orden_produccion: idOrdenProduccion,
      },
    });
  }),
);

// Roles y permisos / Usuarios
router.use('/roles', require('./rol.routes'));
router.use('/usuarios', require('./usuario.routes'));

// Compras
router.use('/categorias-insumos', categoriaRoutes('INSUMO', 'CATEGORIAS_INSUMOS'));
router.use('/insumos', insumoProductoRoutes('INSUMO', 'INSUMOS'));
router.use('/proveedores', require('./proveedor.routes'));
router.use('/compras', require('./compra.routes'));                    // sube el stock
router.use('/perdidas-insumos', require('./perdida.routes'));          // baja el stock
router.use('/movimientos-stock', require('./movimiento.routes'));      // historial de entradas y salidas

// Producción
router.use('/categorias-productos', categoriaRoutes('PRODUCTO', 'CATEGORIAS_PRODUCTO'));
router.use('/productos', insumoProductoRoutes('PRODUCTO', 'PRODUCTOS'));
router.get('/catalogo', require('../controllers/insumoProducto.controller').catalogo); // público: menú del cliente
router.get('/catalogo/gaseosas', require('../controllers/insumoProducto.controller').gaseosas); // público
router.get('/imagenes/:id', require('../controllers/insumoProducto.controller').imagen); // público: fotos subidas
router.use('/ordenes-produccion', panelRoutes(PANEL.ordenes_produccion));
router.use('/productos-no-conformes', panelRoutes(PANEL.productos_no_conformes));
router.use('/consumos-produccion', require('./consumo.routes'));      // baja el stock al pasar a 'En cocina'

// Ventas
router.use('/clientes', require('./cliente.routes'));
router.use('/pedidos', require('./pedido.routes'));
router.use('/pedidos-panel', panelRoutes(PANEL.pedidos_panel));     // pedidos creados a mano en el panel
router.use('/ventas', panelRoutes(PANEL.ventas));
router.use('/devoluciones', panelRoutes(PANEL.devoluciones));

module.exports = router;
