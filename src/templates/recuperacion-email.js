const { crearCorreo, parrafo, bloqueDestacado, aviso } = require('./correo-base');

const crearCorreoRecuperacion = (codigo, minutos) =>
  crearCorreo({
    preheader: `Tu código para recuperar la contraseña vence en ${minutos} minutos.`,
    titulo: [
      { texto: '¡HOLA!' },
      { texto: 'RECUPERA TU' },
      { texto: 'CONTRASEÑA', dorado: true },
    ],
    contenido: `
      ${parrafo('Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en El Parche Mini Burguer.')}
      ${parrafo('Aquí está tu código para continuar:', '1.5')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:0 0 16px;">
            ${bloqueDestacado('', codigo)}
          </td>
        </tr>
        <tr>
          <td>${aviso(`Este código vence en ${minutos} minutos. Si no fuiste tú, ignora este correo; tu contraseña no cambia.`)}</td>
        </tr>
      </table>`,
  });

module.exports = crearCorreoRecuperacion;
