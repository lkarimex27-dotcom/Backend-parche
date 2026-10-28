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
const Usuario = require('../src/models/usuario.model');
const bcrypt = require('bcryptjs');
const service = require('../src/services/auth.service');

const datos = { nombre: 'Sofía', correo: 'sofi@correo.co', contrasena: 'MiClave2026' };

describe('Cliente que crea su cuenta en la web', () => {
  beforeEach(() => jest.clearAllMocks());

  it('le llega el correo de bienvenida (sin contraseña: la eligió al registrarse)', async () => {
    const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);
    const r = await service.registrarVerificado({ ...datos, contrasena_hash: contrasenaHash });
    expect(r.token).toBeTruthy();
    expect(Usuario.crearUsuario).toHaveBeenCalledWith({}, expect.objectContaining({
      correo: datos.correo,
      hash: contrasenaHash,
    }));
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    const { para, asunto, html, attachments } = enviarCorreo.mock.calls[0][0];
    expect(para).toBe('sofi@correo.co');
    expect(asunto).toMatch(/Bienvenido/);
    expect(html).toContain('¡Hola, Sofía!');
    expect(html).toContain('BIENVENIDO A');
    expect(html).toContain('Tu cuenta en <strong>El Parche Mini Burguer</strong> está lista.');
    expect(html).toContain('Prepárate para disfrutar hamburguesas, perros calientes y salchipapas preparados al momento.');
    expect(html).toContain('Explorar menú');
    expect(html).toContain('href="https://mini-burguer-lw8q.vercel.app/#menu"');
    expect(html).toContain('¡Tu antojo sigue en pie!');
    expect(html).toContain('background="https://mini-burguer-lw8q.vercel.app/email/recovery-burger.jpg"');
    expect(html).toContain('src="https://mini-burguer-lw8q.vercel.app/email/el-parche-logo.png"');
    expect(html).toContain('background:#ffd34f');
    expect(attachments).toBeUndefined();
    expect(html).not.toContain('MiClave2026');
  });

  it('escapa el nombre del usuario antes de insertarlo en el HTML', async () => {
    const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);
    await service.registrarVerificado({ ...datos, nombre: '<Sofía>', contrasena_hash: contrasenaHash });
    const { html } = enviarCorreo.mock.calls[0][0];
    expect(html).toContain('¡Hola, &#60;Sofía&#62;!');
    expect(html).not.toContain('¡Hola, <Sofía>!');
  });

  it('si el correo no sale, la cuenta igual queda creada', async () => {
    enviarCorreo.mockRejectedValueOnce(Object.assign(new Error('error con dato sensible'), { code: 'EAUTH' }));
    const aviso = jest.spyOn(console, 'error').mockImplementation(() => {});
    const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);

    await expect(service.registrarVerificado({ ...datos, contrasena_hash: contrasenaHash }))
      .resolves.toHaveProperty('token');

    expect(aviso).toHaveBeenCalledWith(
      'La cuenta se creó, pero falló el envío del correo de bienvenida.',
      { codigo: 'EAUTH' }
    );
    expect(JSON.stringify(aviso.mock.calls)).not.toContain('error con dato sensible');
    aviso.mockRestore();
  });

  it('espera la respuesta del proveedor antes de completar el registro verificado', async () => {
    let aceptarCorreo;
    enviarCorreo.mockImplementationOnce(() => new Promise((resolve) => { aceptarCorreo = resolve; }));
    const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);
    let registroTerminado = false;
    const registro = service.registrarVerificado({ ...datos, contrasena_hash: contrasenaHash })
      .then((resultado) => {
        registroTerminado = true;
        return resultado;
      });

    await new Promise((resolve) => setImmediate(resolve));
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(registroTerminado).toBe(false);

    aceptarCorreo({ accepted: [datos.correo] });
    await expect(registro).resolves.toHaveProperty('token');
    expect(registroTerminado).toBe(true);
  });
});
