const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const filtros = z.object({
  id_categoria: z.coerce.number().int().positive().optional(),
  bajoMinimo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

const crearInsumoProducto = z.object({
  nombre: z.string().trim().min(2).max(150),
  medida: z.string().trim().max(50).optional(),     // ej. kg, g, und
  stock: z.number().nonnegative().optional(),
  minimo: z.number().nonnegative().optional(),
  maximo: z.number().nonnegative().optional(),
  id_categoria: z.number().int().positive(),
  costo: z.number().nonnegative().optional(),
  precio: z.number().nonnegative().optional(),
  tiene_ficha_tecnica: z.boolean().optional(),
  descripcion: z.string().trim().max(500).optional(),  // se muestra en el menú del cliente
  etiqueta: z.string().trim().max(30).optional(),      // ej. "Favorita", "Nuevo"
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),   // INACTIVO = no sale en el menú del cliente
});

const actualizarInsumoProducto = crearInsumoProducto
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

const texto = (max) => z.string().trim().max(max).optional();
const ficha = z.object({
  nombre: texto(150),
  version: texto(30),
  insumos_principales: texto(2000),
  preparacion: texto(5000),
  ingredientes: z
    .array(z.object({ insumo: z.string().trim().min(1).max(150), cantidad: z.number().positive(), medida: texto(50) }))
    .max(100)
    .optional(),   // sin enviar = se conserva la receta guardada
});

// Foto: imagen subida (data URL, la app la reduce) o URL externa
const imagen = z.object({
  imagen: z.union([
    z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(900_000),
    z.string().url().max(2000),
  ]),
});

module.exports = { idParam, filtros, crearInsumoProducto, actualizarInsumoProducto, ficha, imagen };
