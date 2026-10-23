const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
// Hoy en Colombia (AAAA-MM-DD): una compra no puede tener fecha futura
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD')
  .refine((f) => f <= hoy(), 'La fecha de compra no puede ser posterior a hoy')
  .refine((f) => f >= '2013-01-01', 'La fecha no puede ser anterior a 2013: el negocio abrió ese año');

const compra = z.object({
  id_proveedor: z.number().int().positive(),
  fecha,
  iva: z.number().nonnegative().optional(),
  items: z
    .array(z.object({
      id_insumo_producto: z.number().int().positive(),
      cantidad: z.number().positive(),
      costo_unitario: z.number().nonnegative(),
    }))
    .min(1, 'Agrega al menos un insumo'),
});

const estado = z.object({ estado: z.enum(['REGISTRADA', 'ANULADA']) });

module.exports = { idParam, crearCompra: compra, actualizarCompra: compra, estado };
