const { z } = require('zod');
const { correo } = require('./common.validator');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const crearCliente = z.object({
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  // Igual que usuarios y registro: el documento del cliente pasa a su cuenta
  documento: z.string().trim().min(6, 'El documento debe tener entre 6 y 10 caracteres').max(10, 'El documento debe tener entre 6 y 10 caracteres').optional(),
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
