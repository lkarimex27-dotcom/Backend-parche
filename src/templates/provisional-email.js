const { crearCorreo, parrafo, bloqueDestacado, aviso, boton, escapar } = require('./correo-base');
const { appUrl } = require('../config/env');

const crearCorreoProvisional = ({ nombre, correo, contrasena }) =>
  crearCorreo({
    preheader: 'Tu cuenta quedó lista. Aquí tienes tu contraseña provisional para iniciar sesión.',
    titulo: [
      { texto: '¡BIENVENIDO!' },
      { texto: 'YA ERES DEL PARCHE', dorado: true },
    ],
    subtitulo: 'Tu cuenta quedó lista para pedir todo el sabor del parche.',
    contenido: `
      ${parrafo(`<strong style="font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:22px;">¡Hola, ${escapar(nombre)}!</strong>`)}
      ${parrafo('Te creamos una cuenta en <strong>El Parche Mini Burguer</strong>. Para entrar, usa este correo y la contraseña provisional que aparece a continuación.')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:0 0 16px;">
            ${bloqueDestacado('CONTRASEÑA PROVISIONAL', contrasena)}
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:4px 10px 4px 0;color:#B68C1C;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">●</td><td style="padding:4px 0;color:#2B2824;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">Entra con <strong>${escapar(correo)}</strong>.</td></tr>
              <tr><td valign="top" style="padding:4px 10px 4px 0;color:#B68C1C;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">●</td><td style="padding:4px 0;color:#2B2824;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">Escribe la contraseña provisional tal como aparece, respetando mayúsculas y minúsculas.</td></tr>
              <tr><td valign="top" style="padding:4px 10px 4px 0;color:#B68C1C;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">●</td><td style="padding:4px 0;color:#2B2824;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">Al iniciar sesión, elige una contraseña propia si el sistema permite cambiarla.</td></tr>
            </table>
          </td>
        </tr>
        <tr><td align="center" style="padding:20px 0 0;">${boton('Iniciar sesión', appUrl)}</td></tr>
        <tr><td style="padding:14px 0 0;">${aviso('Si no esperabas este correo, contacta al administrador de la plataforma para verificar la creación de tu cuenta.')}</td></tr>
      </table>`,
  });

module.exports = crearCorreoProvisional;
