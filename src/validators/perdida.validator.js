const { z } = require('zod');

// Hoy en Colombia (AAAA-MM-DD): una pérdida no puede tener fecha futura
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const idParam = z.object({ id: z.coerce.number().int().positive() });

const perdida = z.object({
  id_insumo_producto: z.number().int().positive(),
  cantidad: z.number().positive(),
  motivo: z.string().trim().max(150).optional(),
  responsable: z.string().trim().max(150).optional(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD')
    .refine((f) => f <= hoy(), 'La fecha de la pérdida no puede ser posterior a hoy')
    .refine((f) => f >= '2013-01-01', 'La fecha no puede ser anterior a 2013: el negocio abrió ese año')
    .optional(),
  observacion: z.string().trim().max(1000).optional(),  // ej. "Compra a X del <fecha>"
  id_compra: z.number().int().positive().optional(),     // la compra de la que se envió (si vino de una)
});

const devolver = z.object({
  cantidad: z.number().positive('La cantidad a devolver debe ser mayor que 0').optional(),
  motivo: z.string().trim().min(3, 'Escribe por qué se devuelve a la compra').max(500),
});

module.exports = { idParam, crearPerdida: perdida, actualizarPerdida: perdida, devolver };
