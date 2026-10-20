const { z } = require('zod');
const { correo } = require('./common.validator');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const crearCliente = z.object({
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  documento: z.string().trim().max(50).optional(),
  telefono: z.string().trim().max(30).optional(),
  correo: correo.optional(),
  direccion: z.string().trim().max(200).optional(),
  de_local: z.boolean().optional(),   // cliente que compra en el local (sin domicilio)
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

const actualizarCliente = crearCliente
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, crearCliente, actualizarCliente };
