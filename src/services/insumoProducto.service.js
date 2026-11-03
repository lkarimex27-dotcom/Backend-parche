
const Modelo = require('../models/insumoProducto.model');
const { withTransaction } = require('../config/db');
const Categoria = require('../models/categoria.model');
const AppError = require('../errors/AppError');
const cloudinary = require('../config/cloudinary');

const NOMBRE = { INSUMO: 'Insumo', PRODUCTO: 'Producto' };

const listar = (tipo, filtros) => Modelo.listar(tipo, filtros);

const obtener = async (tipo, id) => {
  const r = await Modelo.obtenerPorId(tipo, id);
  if (!r) throw AppError.notFound(`${NOMBRE[tipo]} no encontrado`);
  return r;
};

const validar = async (tipo, d) => {
  if (d.maximo != null && d.minimo != null && d.maximo < d.minimo) {
    throw AppError.badRequest('El máximo no puede ser menor que el mínimo');
  }

  // La categoría debe ser del mismo tipo.
  if (d.id_categoria != null && !(await Categoria.obtenerPorId(tipo, d.id_categoria))) {
    throw AppError.badRequest(`La categoría indicada no existe entre las categorías de ${tipo.toLowerCase()}s`);
  }
};

const crear = async (tipo, datos) => {
  await validar(tipo, datos);
  const { id_insumo_producto } = await Modelo.crear(tipo, datos);
  return obtener(tipo, id_insumo_producto);
};

const actualizar = async (tipo, id, datos) => {
  // El costo y el stock de un insumo solo cambian con compras, pérdidas y producción.
  if (tipo === 'INSUMO') {
    const { costo, stock, ...resto } = datos;
    datos = resto;
  }

  await validar(tipo, datos);
  if (!(await Modelo.actualizar(tipo, id, datos))) throw AppError.notFound(`${NOMBRE[tipo]} no encontrado`);
  // Cambió la medida de un insumo: sus fichas técnicas la siguen (ej. pan en "und" → "paq")
  if (tipo === 'INSUMO' && datos.medida) await Modelo.alinearMedidaFichas(id, datos.medida);
  return obtener(tipo, id);
};

const eliminar = async (tipo, id) => {
  // Un insumo solo se elimina si ningún otro módulo tiene registros de él.
  if (tipo === 'INSUMO') {
    const u = await Modelo.usos(id);

    const en = [
      u.compras && 'compras',
      u.perdidas && 'pérdidas de insumos',
      u.recetas && `la ficha técnica de ${u.recetas}`,
    ].filter(Boolean);

    if (en.length) {
      throw AppError.conflict(
        `No se puede eliminar: está registrado en ${en.join(', ')}. Si ya no lo usas, desactívalo.`
      );
    }
  }
  // Un producto solo se elimina si no tiene ventas, pedidos ni compras, y ningún proveedor lo vende (ej. gaseosas)
  if (tipo === 'PRODUCTO') {
    const u = await Modelo.usosProducto(id);
    const en = [
      u.ventas && 'ventas',
      u.pedidos && 'pedidos',
      u.compras && 'compras',
      u.proveedores && `el proveedor ${u.proveedores}`,
      u.otros && 'productos no conformes o pérdidas',
    ].filter(Boolean);
    if (en.length) {
      throw AppError.conflict(`No se puede eliminar: está registrado en ${en.join(', ')}. Si ya no lo vendes, desactívalo.`);
    }
  }
  if (!(await Modelo.eliminar(tipo, id))) throw AppError.notFound(`${NOMBRE[tipo]} no encontrado`);
};

const guardarFicha = async (tipo, id, d) => {
  await obtener(tipo, id);

  await withTransaction(async (c) => {
    const faltante = await Modelo.guardarFicha(c, id, d);

    if (faltante) {
      throw AppError.badRequest(`El insumo «${faltante}» de la ficha técnica no existe`);
    }
  });

  return obtener(tipo, id);
};

const reemplazarImagen = async (tipo, id, imagen) => {
  await obtener(tipo, id);

  // Consultar la imagen anterior antes de reemplazarla.
  const producto = await Modelo.obtenerPorId(tipo, id);
  const imagenAnterior = producto.imagenes?.[0] || null;

  let urlFinal = imagen;

  // Subir la nueva imagen a Cloudinary si llega en Base64.
  if (typeof imagen === 'string' && imagen.startsWith('data:image/')) {
    const resultado = await cloudinary.uploader.upload(imagen, {
      folder: 'mini-foods-bite/productos',
      resource_type: 'image',
    });

    urlFinal = resultado.secure_url;
  }

  // Guardar la nueva imagen en PostgreSQL.
  await withTransaction((c) =>
    Modelo.reemplazarImagen(c, id, urlFinal)
  );

  // Eliminar la imagen anterior de Cloudinary después de guardar la nueva.
  if (
    imagenAnterior &&
    imagenAnterior.includes('res.cloudinary.com')
  ) {
    try {
      const coincidencia = imagenAnterior.match(
        /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/
      );

      if (coincidencia) {
        await cloudinary.uploader.destroy(coincidencia[1], {
          resource_type: 'image',
        });
      }
    } catch (error) {
      console.error(
        'No se pudo eliminar la imagen anterior de Cloudinary:',
        error.message
      );
    }
  }

  return obtener(tipo, id);
};

// Conserva la compatibilidad con imágenes antiguas guardadas como Base64.
const imagen = async (idImagen) => {
  const url = await Modelo.obtenerImagen(idImagen);
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(url || '');

  if (!m) throw AppError.notFound('Imagen no encontrada');

  return {
    tipo: m[1],
    bytes: Buffer.from(m[2], 'base64'),
  };
};

const productosSinStock = () => Modelo.productosSinStock();
const gaseosas = () => Modelo.gaseosas();

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  guardarFicha,
  reemplazarImagen,
  imagen,
  productosSinStock,
  gaseosas,
};
