const { z } = require('zod');

const correo = z
  .string()
  .trim()
  .email('El correo debe tener un formato válido')
  .max(255, 'El correo no puede superar 255 caracteres');

module.exports = { correo };
