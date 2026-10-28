process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

const crypto = require('crypto');

// Sin base de datos ni correo: se simulan las cuentas
const mockCuentas = {
  'ana@correo.com': { id_usuario: 1, correo: 'ana@correo.com', estado: 'ACTIVO' },
  'inactiva@correo.com': { id_usuario: 2, correo: 'inactiva@correo.com', estado: 'INACTIVO' },
};
jest.mock('../src/models/usuario.model', () => ({ obtenerParaLogin: jest.fn(async (c) => mockCuentas[c] ?? null) }));
jest.mock('../src/models/recuperacion.model', () => ({
  obtener: jest.fn(async () => null),
  guardar: jest.fn(async () => undefined),
  borrar: jest.fn(async () => undefined),
}));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => undefined) }));
const { enviarCorreo } = require('../src/utils/mailer');
const Recuperacion = require('../src/models/recuperacion.model');
const service = require('../src/services/recuperacion.service');

describe('Olvidé mi contraseña no revela qué correos tienen cuenta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a una cuenta activa le envía el código', async () => {
    await service.solicitar({ correo: 'ana@correo.com' });
    expect(enviarCorreo).toHaveBeenCalledTimes(1);

    const correo = enviarCorreo.mock.calls[0][0];
    const codigo = correo.html.match(/letter-spacing:9px;">(\d{6})<\/span>/)[1];
    expect(Recuperacion.guardar).toHaveBeenCalledWith(
      1,
      crypto.createHash('sha256').update(codigo).digest('hex'),
      15,
    );
    expect(correo.asunto).toBe('Tu código para recuperar la contraseña');
    expect(correo.html).toContain('Hemos recibido una solicitud para restablecer la contraseña');
    expect(correo.html).toContain('Este código vence en 15 minutos. Si no fuiste tú, ignora este correo; tu contraseña no cambia.');
    expect(correo.html).toContain('background="https://mini-burguer-lw8q.vercel.app/email/recovery-burger.jpg"');
    expect(correo.html).toContain('<v:fill type="frame" src="https://mini-burguer-lw8q.vercel.app/email/recovery-burger.jpg"');
    expect(correo.html).toContain('src="https://mini-burguer-lw8q.vercel.app/email/el-parche-logo.png"');
    expect(correo.html).toContain('background:#ffd34f');
    expect(correo.html.match(/src="https:\/\/mini-burguer-lw8q\.vercel\.app\/email\/el-parche-logo\.png"/g)).toHaveLength(2);
    expect(correo.html).toContain('height="340"');
    expect(correo.attachments).toBeUndefined();
    expect(correo.html).not.toContain('cid:recovery-burger');
    expect(correo.html).not.toContain('cid:el-parche-logo');
  });

  it.each(['nadie@correo.com', 'inactiva@correo.com'])('con %s responde igual, sin error y sin enviar nada', async (correo) => {
    await expect(service.solicitar({ correo })).resolves.toBeUndefined();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });
});
