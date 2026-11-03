const { z } = require('zod');

const identificadorBarrio = z.object({
  id_barrio: z.coerce.number().int().positive().optional(),
  nombre_barrio: z.string().trim().min(2).max(120).optional(),
});

const ubicacion = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
});

const estimar = identificadorBarrio.extend({
  tipo_entrega: z.enum(['local', 'domicilio', 'recoger']).default('domicilio'),
  direccion: z.string().trim().min(3).max(300).optional(),
  distancia_km: z.number().finite().min(0).optional(),
  ubicacion: ubicacion.optional(),
  items: z.array(z.object({
    producto: z.string().trim().min(1).max(150),
    cantidad: z.number().int().positive().max(100),
  })).max(100).optional(),
}).refine((d) => d.tipo_entrega !== 'domicilio' || d.id_barrio !== undefined || d.nombre_barrio !== undefined, {
  message: 'Selecciona un barrio válido',
});

module.exports = { estimar, identificadorBarrio, ubicacion };
