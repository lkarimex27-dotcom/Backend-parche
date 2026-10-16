const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const crearCategoria = z.object({
  nombre_categoria: z.string().trim().min(2).max(100),
  descripcion: z.string().trim().max(500).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});
const actualizarCategoria = crearCategoria;

module.exports = { idParam, crearCategoria, actualizarCategoria };
