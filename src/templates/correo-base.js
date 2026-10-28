const env = require('../config/env');

const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caracter) => `&#${caracter.charCodeAt(0)};`);
const urlImagenCorreo = (nombre) => new URL(`/email/${nombre}`, env.appUrl).toString();

const parrafo = (contenido, lineHeight = '1.55') =>
  `<p style="margin:0 0 18px;color:#24221d;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:${lineHeight};">${contenido}</p>`;

const bloqueDestacado = (etiqueta, valor) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:#ffd34f;border-radius:10px;">
    <tr>
      <td align="center" style="padding:12px 28px;">
        ${etiqueta ? `<span style="display:block;margin:0 0 6px;color:#111111;font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:12px;font-weight:900;line-height:1.2;letter-spacing:2px;">${escapar(etiqueta)}</span>` : ''}
        <span style="display:block;color:#111111;font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:44px;font-weight:900;line-height:1.12;letter-spacing:9px;">${escapar(valor)}</span>
      </td>
    </tr>
  </table>`;

const aviso = (contenido) =>
  `<p style="margin:0;padding:0 0 4px;color:#514d43;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;text-align:center;">${contenido}</p>`;

const boton = (texto, url) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:#ffd34f;border-radius:10px;">
    <tr>
      <td align="center" style="padding:12px 28px;">
        <a href="${escapar(url)}" style="display:inline-block;color:#111111;font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:17px;font-weight:bold;line-height:1.2;text-decoration:none;">${escapar(texto)}</a>
      </td>
    </tr>
  </table>`;

const crearCorreo = ({ preheader, titulo, subtitulo, contenido }) => ({
  html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; }
        .hero-bg { height: 340px !important; background-position: 68% center !important; }
        .hero-content { padding: 26px 24px !important; }
        .hero-logo { width: 116px !important; }
        .hero-title { font-size: 34px !important; line-height: 1.04 !important; }
        .message-section { padding: 26px 24px !important; }
        .email-footer { padding: 14px 18px !important; }
        .footer-logo { width: 96px !important; }
        .footer-tagline { padding-left: 12px !important; font-size: 15px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f1eee7;color:#171613;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;font-size:1px;color:#f1eee7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${escapar(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f1eee7;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table class="email-shell" role="presentation" width="660" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:660px;border-collapse:collapse;background:#fff8e8;">
            <tr>
              <td
                class="hero-bg"
                height="340"
                align="left"
                valign="middle"
                background="${escapar(urlImagenCorreo('recovery-burger.jpg'))}"
                bgcolor="#10100e"
                style="height:340px;background-color:#10100e;background-image:linear-gradient(90deg,rgba(16,16,14,.12) 0%,rgba(16,16,14,.08) 54%,rgba(16,16,14,0) 100%),url('${escapar(urlImagenCorreo('recovery-burger.jpg'))}');background-position:center;background-size:cover;background-repeat:no-repeat;"
              >
                <!--[if gte mso 9]>
                <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:660px;height:340px;">
                  <v:fill type="frame" src="${escapar(urlImagenCorreo('recovery-burger.jpg'))}" color="#10100e" />
                  <v:textbox inset="0,0,0,0">
                <![endif]-->
                <table role="presentation" width="100%" height="340" cellspacing="0" cellpadding="0" border="0" style="width:100%;height:340px;border-collapse:collapse;">
                  <tr>
                    <td class="hero-content" align="left" valign="middle" style="padding:30px 36px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:0 0 18px;">
                            <img class="hero-logo" src="${escapar(urlImagenCorreo('el-parche-logo.png'))}" width="138" alt="El Parche de las Mini Burguer" style="display:block;width:138px;max-width:100%;height:auto;border:0;">
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <h1 class="hero-title" style="max-width:390px;margin:0;color:#fff8e8;font-family:'League Spartan','Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:42px;font-weight:900;line-height:1.04;letter-spacing:0;text-align:left;text-transform:uppercase;">
                              ${titulo.map((linea) => `<span style="display:block;${linea.dorado ? 'color:#d5a017;' : ''}">${escapar(linea.texto)}</span>`).join('\n                              ')}
                            </h1>
                          </td>
                        </tr>
                        ${subtitulo ? `<tr>
                          <td style="padding:10px 0 0;color:#fff8e8;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;">
                            ${escapar(subtitulo)}
                          </td>
                        </tr>` : ''}
                      </table>
                    </td>
                  </tr>
                </table>
                <!--[if gte mso 9]>
                  </v:textbox>
                </v:rect>
                <![endif]-->
              </td>
            </tr>
            <tr>
              <td class="message-section" style="padding:34px 52px 32px;background:#fff8e8;">
                ${contenido}
              </td>
            </tr>
            <tr>
              <td class="email-footer" align="center" style="padding:17px 24px;background:#10100e;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding:0 16px 0 0;">
                      <img class="footer-logo" src="${escapar(urlImagenCorreo('el-parche-logo.png'))}" width="112" alt="El Parche Mini Burguer" style="display:block;width:112px;max-width:100%;height:auto;border:0;">
                    </td>
                    <td width="1" style="width:1px;background:#d5a017;font-size:0;line-height:0;">&nbsp;</td>
                    <td class="footer-tagline" valign="middle" style="padding:0 0 0 16px;color:#d5a017;font-family:'Roboto Condensed','Arial Narrow',Impact,Arial,sans-serif;font-size:18px;font-weight:bold;line-height:1.2;white-space:nowrap;">
                      ¡Tu antojo sigue en pie!
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`,
  });

module.exports = { crearCorreo, escapar, parrafo, bloqueDestacado, aviso, boton };
