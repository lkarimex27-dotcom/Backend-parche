const { z } = require('zod');
const { correo } = require('./common.validator');

const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72);

const login = z.object({
  correo,
  contrasena: z.string().min(1).max(72),
});

const registro = z.object({
  correo,
  contrasena,
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  documento: z.string().trim().max(50).optional(),
});

// Perfil propio (cliente o personal)
const perfil = z
  .object({
    nombre: z.string().trim().min(2).max(150),
    tipo_documento: z.string().trim().max(30),
    documento: z.string().trim().max(50),
    telefono: z.string().trim().max(30),
    direcciones: z.array(z.string().trim().min(1).max(200)).max(10),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envía al menos un campo' });

const cambioContrasena = z.object({ actual: z.string().min(1).max(72), nueva: contrasena });

// Olvidé mi contraseña: pedir el código y usarlo
const recuperar = z.object({ correo });
const restablecer = z.object({ correo, codigo: z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos'), nueva: contrasena });

module.exports = { login, registro, contrasena, perfil, cambioContrasena, recuperar, restablecer };
