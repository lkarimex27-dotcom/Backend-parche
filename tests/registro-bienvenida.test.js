process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos ni Gmail: registro público desde la web del cliente
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn({}) }));
jest.mock('../src/models/usuario.model', () => ({
  crearUsuario: jest.fn(async () => ({ id_usuario: 30 })),
  crearPersona: jest.fn(async () => undefined),
  reemplazarRoles: jest.fn(async () => true),
  obtenerPorId: jest.fn(async (id) => ({ id_usuario: id, correo: 'sofi@correo.co', estado: 'ACTIVO', roles: ['CLIENTE'] })),
}));
jest.mock('../src/models/permiso.model', () => ({ permisosDeUsuario: jest.fn(async () => []) }));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => undefined) }));
const { enviarCorreo } = require('../src/utils/mailer');
const service = require('../src/services/auth.service');

const datos = { nombre: 'Sofía', correo: 'sofi@correo.co', contrasena: 'MiClave2026' };

describe('Cliente que crea su cuenta en la web', () => {
  beforeEach(() => jest.clearAllMocks());

  it('le llega el correo de bienvenida (sin contraseña: la eligió al registrarse)', async () => {
    const r = await service.registrar(datos);
    expect(r.token).toBeTruthy();
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    const { para, asunto, html } = enviarCorreo.mock.calls[0][0];
    expect(para).toBe('sofi@correo.co');
    expect(asunto).toMatch(/Bienvenido/);
    expect(html).toContain('¡Hola, <strong>Sofía</strong>!');
    expect(html).not.toContain('MiClave2026');
  });

  it('si el correo no sale, la cuenta igual queda creada', async () => {
    enviarCorreo.mockRejectedValueOnce(new Error('Gmail no responde'));
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(service.registrar(datos)).resolves.toHaveProperty('token');
    await new Promise((r) => setImmediate(r));
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});
