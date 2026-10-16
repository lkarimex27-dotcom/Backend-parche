const crypto = require('crypto');
const { enviarCorreo } = require('./mailer');

// 10 caracteres con mayúscula, minúscula y número (sin 0/O, 1/l/I para que se lea bien en el correo)
const contrasenaProvisional = () => {
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789'];
  const todos = grupos.join('');
  const letras = grupos.map((g) => g[crypto.randomInt(g.length)]);
  while (letras.length < 10) letras.push(todos[crypto.randomInt(todos.length)]);
  for (let i = letras.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join('');
};

const escapar = (t) => String(t).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Correo de bienvenida a una cuenta que creó el administrador
const enviarProvisional = ({ para, nombre, contrasena }) =>
  enviarCorreo({
    para,
    asunto: 'Bienvenido a El Parche: tu contraseña provisional',
    html: `<div style="font-family:Arial,sans-serif;max-width:420px">
      <h2 style="color:#C9962B">¡Hola, ${escapar(nombre)}!</h2>
      <p>El administrador de El Parche Mini Burguer te creó una cuenta. Inicia sesión con este correo y esta contraseña provisional:</p>
      <p style="font-size:26px;font-weight:bold;letter-spacing:3px">${contrasena}</p>
      <p>Al entrar te pediremos que la cambies por una propia.</p>
    </div>`,
  });

module.exports = { contrasenaProvisional, enviarProvisional };
