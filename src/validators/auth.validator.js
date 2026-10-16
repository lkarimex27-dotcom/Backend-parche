const { z } = require('zod');
const { correo } = require('./common.validator');

const contrasena = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72)
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula')
  .regex(/\d/, 'La contraseña debe incluir un número');

const login = z.object({
  correo,
  contrasena: z.string().min(1).max(72),
});

const registro = z.object({
  correo,
  contrasena,
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  documento: z.string().trim().min(6, 'El documento debe tener entre 6 y 10 caracteres').max(10, 'El documento debe tener entre 6 y 10 caracteres').optional(),
});

// Perfil propio (cliente o personal)
const perfil = z
  .object({
    nombre: z.string().trim().min(2).max(150),
    tipo_documento: z.string().trim().max(30),
    documento: z.string().trim().min(6, 'El documento debe tener entre 6 y 10 caracteres').max(10, 'El documento debe tener entre 6 y 10 caracteres'),
    telefono: z.string().trim().max(30),
    direcciones: z.array(z.string().trim().min(1).max(200)).max(10),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

const cambioContrasena = z.object({ actual: z.string().min(1).max(72), nueva: contrasena });
const cambioContrasenaInicial = z.object({ nueva: contrasena });

module.exports = { login, registro, contrasena, perfil, cambioContrasena, cambioContrasenaInicial };
