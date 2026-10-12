const { z } = require('zod');
const { contrasena } = require('./auth.validator');
const { correo } = require('./common.validator');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const filtros = z.object({
  rol: z.string().trim().max(100).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

const crearUsuario = z.object({
  correo,
  contrasena,
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  documento: z.string().trim().max(50).optional(),
  tipo: z.string().trim().max(50).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  roles: z.array(z.string().trim().min(1)).min(1, 'Asigna al menos un rol'),
});

const actualizarUsuario = z
  .object({
    correo,
    contrasena,
    nombre: z.string().trim().min(2).max(150),
    tipo_documento: z.string().trim().max(30),
    documento: z.string().trim().max(50),
    tipo: z.string().trim().max(50),
    estado: z.enum(['ACTIVO', 'INACTIVO']),
    roles: z.array(z.string().trim().min(1)).min(1),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, filtros, crearUsuario, actualizarUsuario };
