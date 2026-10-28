const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const Recuperacion = require('../models/recuperacion.model');
const { enviarCorreo } = require('../utils/mailer');
const AppError = require('../errors/AppError');
const crearCorreoRecuperacion = require('../templates/recuperacion-email');

const MINUTOS = 15;
const MINUTOS_VERIFICACION = 10;
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
      ...crearCorreoRecuperacion(codigo, MINUTOS),
    });
  } catch (err) {
    await Recuperacion.borrar(u.id_usuario); // un código que no llegó no debe bloquear el reintento
    throw err;
  }
};

// Verifica el PIN por separado y emite un token temporal para el formulario de nueva contraseña.
const verificar = async ({ correo: correoEntrada, codigo }) => {
  const correo = correoEntrada.trim().toLowerCase();
  const u = await Usuario.obtenerParaLogin(correo);
  const r = u && (await Recuperacion.obtener(u.id_usuario));
  const invalido = AppError.badRequest('El código es incorrecto o ya venció. Pide uno nuevo.');
  if (!r || !r.vigente || r.intentos >= MAX_INTENTOS) throw invalido;
  if (!iguales(hash(codigo), r.codigo_hash)) {
    await Recuperacion.sumarIntento(u.id_usuario);
    throw invalido;
  }

  const token = crypto.randomBytes(32).toString('hex');
  await Recuperacion.marcarVerificado(u.id_usuario, hash(token), MINUTOS_VERIFICACION);
  return { token };
};

// Cambia la contraseña solo con el token emitido tras validar el PIN.
const restablecer = async ({ correo: correoEntrada, token, nueva }) => {
  const correo = correoEntrada.trim().toLowerCase();
  const invalido = AppError.badRequest('El código es incorrecto o ya venció. Pide uno nuevo.');
  const u = await Usuario.obtenerParaLogin(correo);
  const r = u && (await Recuperacion.obtener(u.id_usuario));
  if (!r || !r.vigente || r.intentos >= MAX_INTENTOS) throw invalido;
  if (!r.verificacion_vigente || !r.verificacion_hash || !iguales(hash(token), r.verificacion_hash)) throw invalido;
  await Usuario.cambiarContrasena(u.id_usuario, await bcrypt.hash(nueva, 10));
  await Recuperacion.borrar(u.id_usuario);
};

module.exports = { solicitar, verificar, restablecer };
