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
});

const actualizarInsumoProducto = crearInsumoProducto
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, filtros, crearInsumoProducto, actualizarInsumoProducto };
