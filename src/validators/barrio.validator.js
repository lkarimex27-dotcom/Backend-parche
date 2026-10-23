const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const nombre = z.string().trim().min(2).max(120);
const minutos = z.number().int().positive().max(1440).nullable();

const buscar = z.object({ buscar: z.string().trim().max(120).optional() });
const crear = z.object({
  nombre,
  activo: z.boolean().default(false),
  es_cercano: z.boolean().default(false),
  tiempo_desplazamiento_minutos: minutos.optional().default(null),
});
const actualizar = z.object({
  nombre: nombre.optional(),
  activo: z.boolean().optional(),
  es_cercano: z.boolean().optional(),
  tiempo_desplazamiento_minutos: minutos.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, buscar, crear, actualizar };
