process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

jest.mock('../src/models/usuario.model', () => ({
  obtenerParaLogin: jest.fn(async () => null),
  documentoEnUso: jest.fn(async (documento) => documento === '1054864910'),
}));
jest.mock('../src/models/registro.model', () => ({
  obtener: jest.fn(),
  guardar: jest.fn(),
  sumarIntento: jest.fn(),
  consumir: jest.fn(),
  borrar: jest.fn(),
}));
jest.mock('../src/services/auth.service', () => ({
  registrarVerificado: jest.fn(),
}));
jest.mock('../src/utils/mailer', () => ({
  enviarCorreo: jest.fn(),
}));

const Registro = require('../src/models/registro.model');
const Auth = require('../src/services/auth.service');
const { enviarCorreo } = require('../src/utils/mailer');
const service = require('../src/services/registro.service');
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

describe('Registro con verificación de correo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Registro.obtener.mockResolvedValue(null);
    Registro.guardar.mockResolvedValue(undefined);
    Registro.sumarIntento.mockResolvedValue(undefined);
    Registro.consumir.mockResolvedValue(null);
    Registro.borrar.mockResolvedValue(undefined);
    enviarCorreo.mockResolvedValue(undefined);
  });

  it('no envía el código si el documento ya es de otra persona (la cuenta no se podría crear)', async () => {
    await expect(service.solicitar({
      correo: 'nueva@correo.com', contrasena: 'ClaveSegura1', nombre: 'Luz', documento: '1054864910',
    })).rejects.toThrow('Ya hay una persona registrada con este número de documento');
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(Registro.guardar).not.toHaveBeenCalled();
  });

  it('envía un PIN de seis dígitos y guarda solo los hashes', async () => {
    await service.solicitar({
      correo: 'ana@correo.com',
      contrasena: 'ClaveSegura1',
      nombre: 'Ana',
    });

    const [, codigoHash, contrasenaHash] = Registro.guardar.mock.calls[0];
    const correo = enviarCorreo.mock.calls[0][0];
    const html = correo.html;
    const codigo = html.match(/letter-spacing:8px;[^>]*>(\d{6})</)[1];

    expect(codigoHash).toBe(hash(codigo));
    expect(codigoHash).not.toBe(codigo);
    await expect(bcrypt.compare('ClaveSegura1', contrasenaHash)).resolves.toBe(true);
    expect(correo.asunto).toBe('Confirma tu correo de El Parche Mini Burguer');
    // Encabezado «¡Hola! CONFIRMA TU CORREO» (imagen adjunta) y el aviso de vencimiento
    expect(html).toContain('src="cid:hero-confirmacion"');
    expect(html).toContain('Vence en 15 minutos. Si no solicitaste una cuenta, ignora este correo.');
    expect(html).not.toContain('recuperar la contraseña');
  });

  it('rechaza un PIN incorrecto y registra el intento', async () => {
    Registro.obtener.mockResolvedValue({
      vigente: true,
      intentos: 0,
      codigo_hash: hash('123456'),
    });

    await expect(service.verificar({ correo: 'ana@correo.com', codigo: '000000' }))
      .rejects.toThrow(/incorrecto|venció/i);

    expect(Registro.sumarIntento).toHaveBeenCalledWith('ana@correo.com');
    expect(Registro.consumir).not.toHaveBeenCalled();
  });

  it('crea la cuenta únicamente después de consumir el PIN correcto', async () => {
    Registro.obtener.mockResolvedValue({
      vigente: true,
      intentos: 0,
      codigo_hash: hash('123456'),
    });
    Registro.consumir.mockResolvedValue({
      correo: 'ana@correo.com',
      contrasena_hash: 'bcrypt-hash',
      nombre: 'Ana',
    });
    Auth.registrarVerificado.mockResolvedValue({ token: 'token' });

    await expect(service.verificar({ correo: 'ANA@CORREO.COM', codigo: '123456' }))
      .resolves.toEqual({ token: 'token' });

    expect(Registro.consumir).toHaveBeenCalledWith('ana@correo.com', hash('123456'));
    expect(Auth.registrarVerificado).toHaveBeenCalledWith(expect.objectContaining({
      correo: 'ana@correo.com',
      contrasena_hash: 'bcrypt-hash',
    }));
  });
});
