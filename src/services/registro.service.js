const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const Registro = require('../models/registro.model');
const Auth = require('./auth.service');
const { enviarCorreo } = require('../utils/mailer');
const AppError = require('../errors/AppError');
const { plantilla, parrafo, recuadro } = require('../utils/plantillaCorreo');

const MINUTOS = 15;
const MAX_INTENTOS = 5;
const hash = (codigo) => crypto.createHash('sha256').update(String(codigo)).digest('hex');
const iguales = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const solicitar = async (datos) => {
  const correo = datos.correo.trim().toLowerCase();
  if (await Usuario.obtenerParaLogin(correo)) {
    throw AppError.conflict('Ya existe una cuenta con este correo.');
  }
  // Antes de enviar el código: si el documento ya es de otra persona, la cuenta no se podría crear al verificarlo
  if (await Usuario.documentoEnUso(datos.documento)) {
    throw AppError.conflict('Ya hay una persona registrada con este número de documento. Si es tuyo, inicia sesión o recupera tu contraseña.');
  }

  const pendiente = await Registro.obtener(correo);
  if (pendiente?.reciente) {
    throw AppError.badRequest('Ya enviamos un código hace poco. Revisa tu correo e inténtalo de nuevo en un minuto.');
  }

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);
  const registro = {
    correo,
    nombre: datos.nombre.trim(),
    tipo_documento: datos.tipo_documento,
    documento: datos.documento,
    telefono: datos.telefono,
  };
  await Registro.guardar(registro, hash(codigo), contrasenaHash, MINUTOS);
  try {
    await enviarCorreo({
      para: correo,
      asunto: 'Confirma tu correo de El Parche Mini Burguer',
      html: plantilla({
        titulo: 'Confirma tu correo',
        hero: 'confirmacion',
        contenido:
          recuadro('Tu código', codigo, 8) +
          parrafo(`Vence en ${MINUTOS} minutos. Si no solicitaste una cuenta, ignora este correo.`),
      }),
    });
  } catch (error) {
    await Registro.borrar(correo);
    throw error;
  }
};

const verificar = async ({ correo: correoEntrada, codigo }) => {
  const correo = correoEntrada.trim().toLowerCase();
  const pendiente = await Registro.obtener(correo);
  const invalido = AppError.badRequest('El código es incorrecto o ya venció. Solicita uno nuevo.');
  if (!pendiente || !pendiente.vigente || pendiente.intentos >= MAX_INTENTOS) throw invalido;
  if (!iguales(hash(codigo), pendiente.codigo_hash)) {
    await Registro.sumarIntento(correo);
    throw invalido;
  }

  const cuenta = await Registro.consumir(correo, pendiente.codigo_hash);
  if (!cuenta) throw invalido;

  return Auth.registrarVerificado({
    correo: cuenta.correo,
    contrasena_hash: cuenta.contrasena_hash,
    nombre: cuenta.nombre,
    tipo_documento: cuenta.tipo_documento,
    documento: cuenta.documento,
    telefono: cuenta.telefono,
  });
};

module.exports = { solicitar, verificar };
