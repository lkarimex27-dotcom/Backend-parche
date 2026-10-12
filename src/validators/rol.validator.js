const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const rol = z.object({ nombre_rol: z.string().trim().min(2).max(100).transform((s) => s.toUpperCase()) });

// PUT /api/roles/:id/permisos  ->  { "permisos": [ { "modulo": "COMPRAS", "privilegios": ["VER","CREAR"] } ] }
const permisos = z.object({
  permisos: z.array(
    z.object({
      modulo: z.string().trim().min(1),
      privilegios: z.array(z.string().trim().min(1)),
    })
  ),
});

module.exports = { idParam, crearRol: rol, actualizarRol: rol, permisos };
