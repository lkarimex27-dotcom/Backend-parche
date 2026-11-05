const { z } = require('zod');

const ubicacion = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
});

const identificadorBarrio = z.union([
  z.object({ id_barrio: z.coerce.number().int().positive() }),
  z.object({ nombre_barrio: z.string().trim().min(2).max(120) }),
]);

const estimar = z.object({
  tipo_entrega: z.enum(['local', 'domicilio', 'recoger']).default('domicilio'),
  id_barrio: z.coerce.number().int().positive().optional(),
  nombre_barrio: z.string().trim().min(2).max(120).optional(),
  direccion: z.string().trim().min(3).max(300).optional(),
  distancia_km: z.number().finite().min(0).optional(),
  ubicacion: ubicacion.optional(),
}).refine((d) => d.tipo_entrega !== 'domicilio' || d.id_barrio !== undefined || d.nombre_barrio !== undefined, {
  message: 'Selecciona un barrio válido',
}).refine((d) => d.tipo_entrega === 'domicilio' || d.distancia_km === undefined || d.distancia_km !== null, {
  message: 'La distancia solo aplica a domicilio',
});

module.exports = { estimar, identificadorBarrio, ubicacion };
