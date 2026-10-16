const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
// Comprobante: imagen en data URL (la app la reduce a 1000 px en JPEG)
const comprobante = z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, 'El comprobante debe ser una imagen').max(900_000);
const texto = (max) => z.string().trim().max(max);

const crearPedido = z.object({
  nombre: texto(150).min(2),
  telefono: texto(30).min(7),
  direccion: texto(300).min(3),
  notas: texto(1000).optional(),
  pago: texto(30).min(1),   // Efectivo, Nequi, Daviplata...
  comprobante: comprobante.optional(),
  items: z
    .array(z.object({
      producto: texto(150).min(1),
      cantidad: z.number().int().positive().max(100),
      salsas: z.array(texto(100)).max(20).default([]),
      adiciones: z.array(z.object({ nombre: texto(150).min(1), cantidad: z.number().int().positive().max(50) })).max(30).default([]),
    }))
    .min(1, 'El pedido no tiene productos'),
});

const subirComprobante = z.object({ comprobante });

const actualizarPedido = z
  .object({
    estado: texto(30).min(1),
    estado_pago: z.enum(['Pendiente', 'Pendiente de verificación', 'Pagado', 'Rechazado']),
    motivo_rechazo_pago: texto(500).nullable(),
    produccion_autorizada: z.boolean(),
    registros_produccion: z.array(z.array(z.union([z.string(), z.number()]))).max(200),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, crearPedido, subirComprobante, actualizarPedido };
