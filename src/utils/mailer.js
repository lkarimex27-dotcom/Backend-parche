const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../errors/AppError');

// Gmail exige una "contraseña de aplicación" (no la contraseña normal de la cuenta) en MAIL_PASS
const transporte = () =>
  nodemailer.createTransport({ service: 'gmail', auth: { user: env.mailUser, pass: env.mailPass } });

// Imágenes de la plantilla: cada una va adjunta solo si el correo la usa (cid:<nombre sin extensión>)
const IMAGENES = path.join(__dirname, '../assets/correo');
const adjuntos = (html) =>
  fs.readdirSync(IMAGENES)
    .filter((f) => html.includes(`cid:${path.parse(f).name}"`))
    .map((f) => ({ filename: f, path: path.join(IMAGENES, f), cid: path.parse(f).name }));

const enviarCorreo = async ({ para, asunto, html }) => {
  if (!env.mailUser || !env.mailPass) throw new AppError('El envío de correos no está configurado (MAIL_USER / MAIL_PASS)', 503);
  await transporte().sendMail({
    from: `"El Parche Mini Burguer" <${env.mailUser}>`, to: para, subject: asunto, html, attachments: adjuntos(html),
  });
};

module.exports = { enviarCorreo, adjuntos };
