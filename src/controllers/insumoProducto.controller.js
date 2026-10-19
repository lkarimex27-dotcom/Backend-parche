// req.tipo lo fija el router según el módulo (INSUMO o PRODUCTO).
const service = require('../services/insumoProducto.service');
const asyncHandler = require('../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.listar(req.tipo, req.query) }));
const obtener = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.obtener(req.tipo, req.params.id) }));
const crear = asyncHandler(async (req, res) =>
  res.status(201).json({ ok: true, data: await service.crear(req.tipo, req.body) }));
const actualizar = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizar(req.tipo, req.params.id, req.body) }));
const eliminar = asyncHandler(async (req, res) => {
  await service.eliminar(req.tipo, req.params.id);
  res.status(204).send();
});

// Menú público: solo productos activos que hoy se pueden preparar (su receta tiene stock)
// y solo lo que ve el cliente (sin costo ni stock).
const catalogo = asyncHandler(async (_req, res) => {
  const [productos, sinStock] = await Promise.all([service.listar('PRODUCTO', {}), service.productosSinStock()]);
  const agotado = new Set(sinStock);
  res.json({
    ok: true,
    data: productos
      .filter((p) => p.estado === 'ACTIVO' && !agotado.has(p.id_insumo_producto))
      .map((p) => ({
        id: p.id_insumo_producto,
        nombre: p.nombre,
        descripcion: p.descripcion,
        etiqueta: p.etiqueta,
        precio: p.precio,
        categoria: p.nombre_categoria,
        imagenes: p.imagenes,
      })),
  });
});

const guardarFicha = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.guardarFicha(req.tipo, req.params.id, req.body) }));
const reemplazarImagen = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.reemplazarImagen(req.tipo, req.params.id, req.body.imagen) }));

// Público (las fotos del menú). Otra página (la tienda) la muestra, por eso cross-origin.
const imagen = asyncHandler(async (req, res) => {
  const { tipo, bytes } = await service.imagen(req.params.id);
  res.set({ 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  res.send(bytes);
});

module.exports = { listar, obtener, crear, actualizar, eliminar, catalogo, guardarFicha, reemplazarImagen, imagen };
