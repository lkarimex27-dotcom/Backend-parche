const { z } = require('zod');
const { correo } = require('./common.validator');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const crearProveedor = z.object({
  nombre: z.string().trim().min(2).max(150),
  correo: correo.optional(),
  telefono: z.string().trim().max(30).optional(),
  contacto: z.string().trim().max(150).optional(),
  tipo: z.string().trim().max(50).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

const actualizarProveedor = crearProveedor
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

const filtros = z.object({ estado: z.enum(['ACTIVO', 'INACTIVO']).optional() });

module.exports = { idParam, filtros, crearProveedor, actualizarProveedor };
