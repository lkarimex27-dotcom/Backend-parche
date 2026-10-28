process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos ni Gmail: se simulan la cuenta, el cliente y el envío del correo
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn({}) }));
jest.mock('../src/models/usuario.model', () => ({
  crearUsuario: jest.fn(async () => ({ id_usuario: 7 })),
  reemplazarRoles: jest.fn(async () => true),
}));
jest.mock('../src/models/cliente.model', () => ({
  crear: jest.fn(async () => ({ id_persona: 3 })),
  obtenerPorId: jest.fn(async (id) => ({ id_persona: id, nombre: 'Ana' })),
}));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => undefined) }));
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../src/models/usuario.model');
const { enviarCorreo } = require('../src/utils/mailer');
const service = require('../src/services/cliente.service');
const { authenticate } = require('../src/middlewares/auth.middleware');

describe('Cliente creado desde el admin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('le llega la bienvenida con una contraseña provisional que sirve para entrar y debe cambiar', async () => {
    await service.crear({ nombre: 'Ana', correo: 'ana@correo.co', documento: '1020304050' });

    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    const { para, asunto, html, attachments } = enviarCorreo.mock.calls[0][0];
    expect(para).toBe('ana@correo.co');
    expect(asunto).toMatch(/Bienvenido/);
    const provisional = /letter-spacing:9px;">([^<]+)<\/span>/.exec(html)[1];
    expect(html).toContain('¡BIENVENIDO!');
    expect(html).toContain('YA ERES DEL');
    expect(html).toContain('¡Hola, Ana!');
    expect(html).toContain('CONTRASEÑA PROVISIONAL');
    expect(html).toContain('Te creamos una cuenta en <strong>El Parche Mini Burguer</strong>.');
    expect(html).toContain('Entra con <strong>ana@correo.co</strong>.');
    expect(html).toContain('href="https://mini-burguer-lw8q.vercel.app"');
    expect(html).toContain('¡Tu antojo sigue en pie!');
    expect(html).toContain('Si no esperabas este correo, contacta al administrador de la plataforma');
    expect(html).not.toContain('recuperar la contraseña');
    expect(html).toContain('background="https://mini-burguer-lw8q.vercel.app/email/recovery-burger.jpg"');
    expect(html).toContain('<v:fill type="frame" src="https://mini-burguer-lw8q.vercel.app/email/recovery-burger.jpg"');
    expect(html).toContain('src="https://mini-burguer-lw8q.vercel.app/email/el-parche-logo.png"');
    expect(attachments).toBeUndefined();

    const cuenta = Usuario.crearUsuario.mock.calls[0][1];
    expect(cuenta.requiereCambioContrasena).toBe(true);
    expect(await bcrypt.compare(provisional, cuenta.hash)).toBe(true);
    expect(Usuario.reemplazarRoles).toHaveBeenCalledWith({}, 7, ['CLIENTE']);
  });

  it('sin correo solo queda registrado: no hay cuenta ni correo', async () => {
    await service.crear({ nombre: 'Luis', documento: '1122334455' });
    expect(Usuario.crearUsuario).not.toHaveBeenCalled();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it('con la provisional solo puede cambiar la contraseña', () => {
    const token = jwt.sign({ correo: 'ana@correo.co', requiere_cambio_contrasena: true }, process.env.JWT_SECRET, { subject: '7' });
    const pasa = (baseUrl, path) => {
      let error;
      authenticate({ headers: { authorization: `Bearer ${token}` }, baseUrl, path }, {}, (e) => { error = e; });
      return !error;
    };
    expect(pasa('/api/auth', '/me/contrasena-inicial')).toBe(true);
    expect(pasa('/api/pedidos', '/mios')).toBe(false);
  });
});
