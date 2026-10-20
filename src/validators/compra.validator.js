const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD');

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
