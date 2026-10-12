const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const crearCategoria = z.object({ nombre_categoria: z.string().trim().min(2).max(100) });
const actualizarCategoria = crearCategoria;

module.exports = { idParam, crearCategoria, actualizarCategoria };
