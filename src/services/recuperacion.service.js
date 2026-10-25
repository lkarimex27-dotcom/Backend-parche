const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const Recuperacion = require('../models/recuperacion.model');
const { enviarCorreo } = require('../utils/mailer');
const { plantilla, parrafo, recuadro } = require('../utils/plantillaCorreo');
const AppError = require('../errors/AppError');

const MINUTOS = 15;
const MAX_INTENTOS = 5;
const hash = (codigo) => crypto.createHash('sha256').update(String(codigo)).digest('hex');
const iguales = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Envía un código de 6 dígitos al correo; solo a cuentas registradas en la app y activas.
// Para cualquier otro correo responde igual (sin error): así no se puede averiguar quién tiene cuenta
const solicitar = async ({ correo }) => {
  const u = await Usuario.obtenerParaLogin(correo);
  if (!u || u.estado !== 'ACTIVO') return;
  if ((await Recuperacion.obtener(u.id_usuario))?.reciente) return; // ya se envió uno hace menos de 1 minuto
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await Recuperacion.guardar(u.id_usuario, hash(codigo), MINUTOS);
  try {
    await enviarCorreo({
      para: u.correo,
      asunto: 'Tu código para recuperar la contraseña',
      html: plantilla({
        titulo: 'Recupera tu contraseña',
        contenido:
          parrafo('Recibimos una solicitud para cambiar la contraseña de tu cuenta. Escribe este código en la página:') +
          recuadro('Tu código', codigo, 8),
        nota: `Vence en ${MINUTOS} minutos. Si no fuiste tú, ignora este correo: tu contraseña no cambia.`,
      }),
    });
  } catch (err) {
    await Recuperacion.borrar(u.id_usuario); // un código que no llegó no debe bloquear el reintento
    throw err;
  }
};

// Cambia la contraseña si el código es correcto, está vigente y no superó los intentos
const restablecer = async ({ correo, codigo, nueva }) => {
  const invalido = AppError.badRequest('El código es incorrecto o ya venció. Pide uno nuevo.');
  const u = await Usuario.obtenerParaLogin(correo);
  const r = u && (await Recuperacion.obtener(u.id_usuario));
  if (!r || !r.vigente || r.intentos >= MAX_INTENTOS) throw invalido;
  if (!iguales(hash(codigo), r.codigo_hash)) {
    await Recuperacion.sumarIntento(u.id_usuario);
    throw invalido;
  }
  await Usuario.cambiarContrasena(u.id_usuario, await bcrypt.hash(nueva, 10));
  await Recuperacion.borrar(u.id_usuario);
};

module.exports = { solicitar, restablecer };
