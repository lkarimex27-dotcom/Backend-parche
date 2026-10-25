const { z } = require('zod');

const estimar = z.object({
  tipo_entrega: z.enum(['local', 'domicilio', 'recoger']).default('domicilio'),
  id_barrio: z.coerce.number().int().positive().optional(),
  nombre_barrio: z.string().trim().min(2).max(120).optional(),
  direccion: z.string().trim().min(3).max(300).optional(),
  distancia_km: z.number().finite().min(0).optional(),
});

module.exports = { estimar };
