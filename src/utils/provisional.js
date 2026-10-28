const crypto = require('crypto');
const { enviarCorreo } = require('./mailer');
const { plantilla, parrafo, recuadro, lista, escapar, urlApp } = require('./plantillaCorreo');

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
    html: plantilla({
      titulo: 'Ya tienes tu cuenta en El Parche',
      hero: 'provisional',
      contenido:
        parrafo(`¡Hola, <strong>${escapar(nombre)}</strong>! Te creamos una cuenta en El Parche Mini Burguer.`) +
        recuadro('Contraseña provisional', contrasena, 3) +
        lista([
          `Entra con <strong>${escapar(para)}</strong>.`,
          'Escribe la contraseña tal como aparece (distingue mayúsculas).',
          'Te pediremos que elijas una contraseña propia y listo.',
        ]),
      boton: { texto: 'Iniciar sesión', url: urlApp() },
      nota: 'Si no esperabas este correo, puedes ignorarlo: nadie podrá usar la cuenta sin esta contraseña.',
    }),
  });

// Correo de bienvenida a quien creó su cuenta en la web (no lleva contraseña: la eligió al registrarse)
const enviarBienvenida = ({ para, nombre }) =>
  enviarCorreo({
    para,
    asunto: '¡Bienvenido a El Parche Mini Burguer! 🍔',
    html: plantilla({
      titulo: '¡Bienvenido! Ya eres del parche',
      hero: 'bienvenida',
      contenido:
        parrafo(`¡Hola, <strong>${escapar(nombre)}</strong>! Ya puedes pedir tus favoritas sin volver a escribir tus datos.`) +
        lista([
          'Hamburguesas, perros y salchipapas preparados al momento.',
          'Personaliza tu pedido con salsas gratis, adiciones y bebidas.',
          'Domicilio en Bello o recoge en el local, y sigue el estado de tu pedido.',
        ]),
      boton: { texto: 'Ver el menú y pedir', url: urlApp() },
      nota: `Entras con <strong>${escapar(para)}</strong> y la contraseña que elegiste. Si no creaste esta cuenta, escríbenos.`,
    }),
  });

module.exports = { contrasenaProvisional, enviarProvisional, enviarBienvenida };
