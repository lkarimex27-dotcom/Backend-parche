const { z } = require('zod');

const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72);

const login = z.object({
  correo: z.string().trim().email(),
  contrasena: z.string().min(1).max(72),
});

const registro = z.object({
  correo: z.string().trim().email().max(255),
  contrasena,
  nombre: z.string().trim().min(2).max(150),
  tipo_documento: z.string().trim().max(30).optional(),
  documento: z.string().trim().max(50).optional(),
});

module.exports = { login, registro, contrasena };
