process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const crearCorreoRecuperacion = require('../src/templates/recuperacion-email');
const crearCorreoBienvenida = require('../src/templates/bienvenida-email');
const crearCorreoProvisional = require('../src/templates/provisional-email');
const crearCorreoConfirmacion = require('../src/templates/confirmacion-email');

const correos = [
  crearCorreoRecuperacion('123456', 15),
  crearCorreoBienvenida('Ana'),
  crearCorreoProvisional({ nombre: 'Ana', correo: 'ana@correo.co', contrasena: 'Temporal123' }),
  crearCorreoConfirmacion('654321', 15),
];

const extraer = (html, expresion) => html.match(expresion)?.[0];
const region = (html, inicio, fin) => {
  const start = html.indexOf(inicio);
  const end = html.indexOf(fin, start);
  return start === -1 || end === -1 ? null : html.slice(start, end);
};

describe('Plantilla visual compartida de correos', () => {
  it('mantiene iguales los estilos responsive, el hero, la imagen y el footer', () => {
    const [referencia, ...resto] = correos.map(({ html }) => html);
    const style = /<style>[\s\S]*?<\/style>/;
    const heroStart = '<td\n                class="hero-bg"';
    const messageStart = '\n            <tr>\n              <td class="message-section"';
    const footer = /<tr>\s*<td class="email-footer"[\s\S]*?<\/tr>/;

    for (const html of resto) {
      expect(extraer(html, style)).toBe(extraer(referencia, style));
      expect(extraer(html, footer)).toBe(extraer(referencia, footer));
    }

    const normalizeTitle = (html) =>
      region(html, heroStart, messageStart)
        ?.replace(/<h1 class="hero-title"[\s\S]*?<\/h1>/, '<h1 class="hero-title"></h1>');
    expect(normalizeTitle(correos[3].html)).toBe(normalizeTitle(referencia));
  });

  it('mantiene en todos los correos las dimensiones maestras del contenedor y encabezado', () => {
    for (const { html } of correos) {
      expect(html).toContain('width="660"');
      expect(html).toContain('max-width:660px');
      expect(html).toContain('height="340"');
      expect(html).toContain('background="https://mini-burguer-lw8q.vercel.app/email/recovery-burger.jpg"');
      expect(html).toContain('src="https://mini-burguer-lw8q.vercel.app/email/el-parche-logo.png"');
      expect(html).toContain('¡Tu antojo sigue en pie!');
    }
  });

  it('mantiene la confirmación con el título y el cuerpo propios, sin subtítulo ni etiqueta en el bloque', () => {
    const { html, attachments } = correos[3];

    expect(html).toContain('<span style="display:block;">CONFIRMA</span>');
    expect(html).toContain('<span style="display:block;color:#d5a017;">TU CORREO</span>');
    expect(html).not.toContain('Un último paso para entrar al parche.');
    expect(html).not.toContain('CÓDIGO DE CONFIRMACIÓN');
    expect(html).toContain('<span style="display:block;color:#111111;font-family:\'Roboto Condensed\',\'Arial Narrow\',Impact,Arial,sans-serif;font-size:44px;font-weight:900;line-height:1.12;letter-spacing:9px;">654321</span>');
    expect(html).toContain('Este código vence en 15 minutos. Si no solicitaste crear una cuenta, ignora este correo.');
    expect(attachments).toBeUndefined();
  });
});
