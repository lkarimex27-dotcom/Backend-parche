const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../errors/AppError');

// Gmail exige una "contraseña de aplicación" (no la contraseña normal de la cuenta) en MAIL_PASS
const transporte = () =>
  nodemailer.createTransport({ service: 'gmail', auth: { user: env.mailUser, pass: env.mailPass } });

const enviarCorreo = async ({ para, asunto, html, attachments = [] }) => {
  if (!env.mailUser || !env.mailPass) throw new AppError('El envío de correos no está configurado (MAIL_USER / MAIL_PASS)', 503);
  const correo = { from: `"El Parche Mini Burguer" <${env.mailUser}>`, to: para, subject: asunto, html };
  if (attachments.length) correo.attachments = attachments;
  const resultado = await transporte().sendMail(correo);
  if (!resultado.accepted?.length) {
    throw new AppError('El proveedor de correo no aceptó al destinatario.', 502);
  }
  return resultado;
};

module.exports = { enviarCorreo };
