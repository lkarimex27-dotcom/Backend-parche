const { z } = require('zod');
const { contrasena } = require('./auth.validator');
const { correo } = require('./common.validator');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const normalizarRol = (rol) =>
  rol.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
const documento = z.string()
  .trim()
  .min(6, 'El documento debe tener entre 6 y 10 caracteres')
  .max(10, 'El documento debe tener entre 6 y 10 caracteres');

const filtros = z.object({
  rol: z.string().trim().max(100).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

const crearUsuario = z.object({
  correo,
  contrasena: contrasena.optional(),
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  documento: documento.optional(),
  tipo: z.string().trim().max(50).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  roles: z.array(z.string().trim().min(1)).min(1, 'Asigna al menos un rol'),
}).superRefine((data, ctx) => {
  const esCliente = data.roles.every((rol) => normalizarRol(rol) === 'CLIENTE');
  if (esCliente && !data.contrasena) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contrasena'], message: 'La contraseña es obligatoria para las cuentas de cliente.' });
  }
  if (
    !esCliente &&
    normalizarRol(data.tipo_documento || '') === 'TARJETA_DE_IDENTIDAD'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tipo_documento'],
      message: 'La tarjeta de identidad solo está permitida para clientes.',
    });
  }
});

const actualizarUsuario = z
  .object({
    correo,
    nombre: z.string().trim().min(2).max(150),
    tipo_documento: z.string().trim().max(30),
    documento,
    tipo: z.string().trim().max(50),
    estado: z.enum(['ACTIVO', 'INACTIVO']),
    roles: z.array(z.string().trim().min(1)).min(1),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

module.exports = { idParam, filtros, crearUsuario, actualizarUsuario };
