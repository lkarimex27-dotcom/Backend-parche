const { z } = require('zod');

const identificadorBarrio = z.object({
  id_barrio: z.coerce.number().int().positive().optional(),
  nombre_barrio: z.string().trim().min(2).max(120).optional(),
});

const estimar = identificadorBarrio.extend({
  tipo_entrega: z.enum(['local', 'domicilio', 'recoger']).default('domicilio'),
  direccion: z.string().trim().min(3).max(300).optional(),
  distancia_km: z.number().finite().min(0).optional(),
}).refine((d) => d.tipo_entrega !== 'domicilio' || d.id_barrio !== undefined || d.nombre_barrio !== undefined, {
  message: 'Selecciona un barrio válido',
});

module.exports = { estimar, identificadorBarrio };
