const crypto = require('crypto');
const { enviarCorreo } = require('./mailer');
const crearCorreoProvisional = require('../templates/provisional-email');
const crearCorreoBienvenida = require('../templates/bienvenida-email');

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

// Correo de bienvenida a una cuenta que creó el administrador (con su contraseña provisional)
const enviarProvisional = ({ para, nombre, contrasena }) =>
  enviarCorreo({
    para,
    asunto: 'Bienvenido a El Parche: tu contraseña provisional',
    ...crearCorreoProvisional({ correo: para, nombre, contrasena }),
  });

// Correo de bienvenida a quien creó su cuenta en la web (no lleva contraseña: la eligió al registrarse)
const enviarBienvenida = ({ para, nombre }) =>
  enviarCorreo({
    para,
    asunto: '¡Bienvenido a El Parche Mini Burguer!',
    ...crearCorreoBienvenida(nombre),
  });

module.exports = { contrasenaProvisional, enviarProvisional, enviarBienvenida };
