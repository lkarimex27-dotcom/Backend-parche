const { crearCorreo, parrafo, boton, escapar } = require('./correo-base');
const { appUrl } = require('../config/env');

const crearCorreoBienvenida = (nombre) =>
  crearCorreo({
    preheader: '¡Qué bueno tenerte en el parche! Ya puedes descubrir nuestros sabores y preparar tu próximo pedido.',
    titulo: [
      { texto: '¡HOLA!' },
      { texto: 'BIENVENIDO A' },
      { texto: 'EL PARCHE', dorado: true },
    ],
    subtitulo: '¡Qué bueno tenerte en el parche! Ya puedes descubrir nuestros sabores y preparar tu próximo pedido.',
    contenido: `
      ${parrafo(`<strong style="font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:22px;">¡Hola, ${escapar(nombre)}!</strong>`)}
      ${parrafo('Tu cuenta en <strong>El Parche Mini Burguer</strong> está lista. Nos alegra que hagas parte de nuestra comunidad.')}
      ${parrafo('Prepárate para disfrutar hamburguesas, perros calientes y salchipapas preparados al momento.')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr><td align="center" style="padding:0 0 4px;">${boton('Explorar menú', new URL('#menu', appUrl).toString())}</td></tr>
      </table>`,
  });

module.exports = crearCorreoBienvenida;
