process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos ni Gmail: se simulan la cuenta, la persona, los roles y el envío del correo
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn({}) }));
jest.mock('../src/models/usuario.model', () => ({
  crearUsuario: jest.fn(async () => ({ id_usuario: 9 })),
  crearPersona: jest.fn(async () => undefined),
  reemplazarRoles: jest.fn(async () => true),
  obtenerPorId: jest.fn(async (id) => ({ id_usuario: id, correo: 'ana@parche.co', estado: 'ACTIVO', roles: ['CLIENTE'] })),
}));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => undefined) }));
const bcrypt = require('bcryptjs');
const Usuario = require('../src/models/usuario.model');
const { enviarCorreo } = require('../src/utils/mailer');
const service = require('../src/services/usuario.service');
const { crearUsuario } = require('../src/validators/usuario.validator');
const { adjuntos } = jest.requireActual('../src/utils/mailer');

describe('Cliente creado desde el módulo Usuarios sin contraseña', () => {
  it('el formulario sin contraseña es válido', () => {
    expect(crearUsuario.safeParse({ correo: 'ana@parche.co', nombre: 'Ana', roles: ['Cliente'], telefono: '3001234567' }).success).toBe(true);
  });

  it('recibe una contraseña provisional por correo, sirve para entrar y debe cambiarla', async () => {
    await service.crear({ nombre: 'Ana', correo: 'ana@parche.co', roles: ['CLIENTE'], telefono: '3001234567', barrio: 'Niquía' });

    const { para, html } = enviarCorreo.mock.calls[0][0];
    expect(para).toBe('ana@parche.co');
    const provisional = /letter-spacing:3px;[^>]*>([^<]+)</.exec(html)[1];
    const cuenta = Usuario.crearUsuario.mock.calls[0][1];
    expect(cuenta.requiereCambioContrasena).toBe(true);
    expect(await bcrypt.compare(provisional, cuenta.hash)).toBe(true);
    // Sus datos de contacto se guardan como los de cualquier usuario
    expect(Usuario.crearPersona.mock.calls[0][1]).toMatchObject({ tipo: 'CLIENTE', telefono: '3001234567', barrio: 'Niquía' });
    // Las imágenes del diseño van adjuntas
    expect(adjuntos(html).map((a) => a.cid).sort()).toEqual(['brocha-der', 'brocha-izq', 'hero-provisional', 'pie', 'subrayado']);
  });
});
