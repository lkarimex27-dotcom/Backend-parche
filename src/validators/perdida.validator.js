const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const perdida = z.object({
  id_insumo_producto: z.number().int().positive(),
  cantidad: z.number().positive(),
  motivo: z.string().trim().max(150).optional(),
  responsable: z.string().trim().max(150).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD').optional(),
  observacion: z.string().trim().max(1000).optional(),  // ej. "Compra a X del <fecha>"
});

module.exports = { idParam, crearPerdida: perdida, actualizarPerdida: perdida };
