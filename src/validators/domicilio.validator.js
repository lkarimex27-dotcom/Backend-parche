const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const crearDomicilio = z.object({
  id_pedido: z.coerce.number().int().positive(),
  nombre_contacto: z.string().trim().min(2).max(150).optional(),
  telefono_contacto: z.string().trim().min(7).max(30).optional(),
  direccion_entrega: z.string().trim().min(3).max(300),
});
const actualizarDomicilio = z
  .object({
    nombre_contacto: z.string().trim().min(2).max(150).nullable().optional(),
    telefono_contacto: z.string().trim().min(7).max(30).nullable().optional(),
    direccion_entrega: z.string().trim().min(3).max(300),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, crearDomicilio, actualizarDomicilio };
