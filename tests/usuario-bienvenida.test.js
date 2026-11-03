process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
process.env.DEFAULT_PASSWORD_CAJERO = 'CajeroTemporal2026';

// Sin base de datos ni Gmail: se simulan la cuenta, la persona, los roles y el envío del correo
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn({}) }));
jest.mock('../src/models/usuario.model', () => ({
  crearUsuario: jest.fn(async () => ({ id_usuario: 9 })),
  crearPersona: jest.fn(async () => undefined),
  reemplazarRoles: jest.fn(async () => true),
  obtenerPorId: jest.fn(async (id) => ({ id_usuario: id, correo: 'cajero@parche.co', estado: 'ACTIVO', roles: ['CAJERO'] })),
}));
jest.mock('../src/models/permiso.model', () => ({ permisosDeUsuario: jest.fn(async () => []) }));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => undefined) }));
const bcrypt = require('bcryptjs');
const Usuario = require('../src/models/usuario.model');
const { enviarCorreo } = require('../src/utils/mailer');
const service = require('../src/services/usuario.service');

describe('Usuario creado desde el admin (módulo Usuarios)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('le llega la bienvenida con una contraseña provisional que sirve para entrar y debe cambiar', async () => {
    // Aunque el formulario mande una contraseña, se ignora: la cuenta usa la provisional del correo
    await service.crear({ nombre: 'Pedro', correo: 'cajero@parche.co', roles: ['CAJERO'], contrasena: 'Otra12345' });

    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    const { para, asunto, html } = enviarCorreo.mock.calls[0][0];
    expect(para).toBe('cajero@parche.co');
    expect(asunto).toMatch(/Bienvenido/);
    const provisional = /letter-spacing:9px;">([^<]+)<\/span>/.exec(html)[1];
    expect(provisional).toBe(process.env.DEFAULT_PASSWORD_CAJERO);
    expect(html).toContain('¡Hola, Pedro!');
    expect(html).toContain('Entra con <strong>cajero@parche.co</strong>.');

    const cuenta = Usuario.crearUsuario.mock.calls[0][1];
    expect(cuenta.requiereCambioContrasena).toBe(true);
    expect(await bcrypt.compare(provisional, cuenta.hash)).toBe(true);
    expect(await bcrypt.compare('Otra12345', cuenta.hash)).toBe(false);
  });

  it('si el correo no sale, el usuario no queda creado (el error corta la transacción)', async () => {
    enviarCorreo.mockRejectedValueOnce(new Error('Gmail no responde'));
    await expect(service.crear({ nombre: 'Ana', correo: 'ana@parche.co', roles: ['CAJERO'] })).rejects.toThrow('Gmail no responde');
  });
});

describe('Usuario con rol Cliente creado desde Usuarios', () => {
  it('queda como persona tipo CLIENTE (aparece también en el módulo Clientes)', async () => {
    await service.crear({ nombre: 'Luz Loaiza', correo: 'luz@correo.co', roles: ['CLIENTE'], contrasena: 'ClienteTemporal2026' });
    expect(Usuario.crearPersona.mock.calls.at(-1)[1].tipo).toBe('CLIENTE');
  });
});
