const { z } = require('zod');

const estimar = z.object({
  id_barrio: z.coerce.number().int().positive(),
  direccion: z.string().trim().min(3).max(300).optional(),
});

module.exports = { estimar };
