const { crearCorreo, parrafo, bloqueDestacado, aviso } = require('./correo-base');

const crearCorreoConfirmacion = (codigo, minutos) =>
  crearCorreo({
    preheader: `Confirma tu correo para terminar de crear tu cuenta. El código vence en ${minutos} minutos.`,
    titulo: [
      { texto: 'CONFIRMA' },
      { texto: 'TU CORREO', dorado: true },
    ],
    contenido: `
      ${parrafo(`<strong style="font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:22px;">¡Hola!</strong>`)}
      ${parrafo('Gracias por registrarte en <strong>El Parche Mini Burguer</strong>. Para terminar de crear tu cuenta, confirma tu correo electrónico utilizando el siguiente código.')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:0 0 16px;">
            ${bloqueDestacado('', codigo)}
          </td>
        </tr>
        <tr>
          <td>${aviso(`Este código vence en ${minutos} minutos. Si no solicitaste crear una cuenta, ignora este correo.`)}</td>
        </tr>
      </table>`,
  });

module.exports = crearCorreoConfirmacion;
