jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));
jest.mock('../src/config/env', () => ({
  mailUser: 'sender@example.test',
  mailPass: 'test-application-password',
}));

const nodemailer = require('nodemailer');
const env = require('../src/config/env');
const { enviarCorreo } = require('../src/utils/mailer');

describe('Servicio de envío por Gmail', () => {
  let sendMail;

  beforeEach(() => {
    jest.clearAllMocks();
    env.mailUser = 'sender@example.test';
    env.mailPass = 'test-application-password';
    sendMail = jest.fn();
    nodemailer.createTransport.mockReturnValue({ sendMail });
  });

  it('configura Gmail y solo confirma la solicitud si el proveedor acepta un destinatario', async () => {
    const resultado = { accepted: ['ana@example.test'], rejected: [], messageId: 'message-id' };
    sendMail.mockResolvedValue(resultado);

    await expect(enviarCorreo({
      para: 'ana@example.test',
      asunto: 'Bienvenida',
      html: '<p>Hola</p>',
    })).resolves.toBe(resultado);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: { user: env.mailUser, pass: env.mailPass },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: '"El Parche Mini Burguer" <sender@example.test>',
      to: 'ana@example.test',
      subject: 'Bienvenida',
      html: '<p>Hola</p>',
    });
  });

  it('no considera enviado un correo que el proveedor rechazó', async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ['ana@example.test'] });

    await expect(enviarCorreo({
      para: 'ana@example.test',
      asunto: 'Bienvenida',
      html: '<p>Hola</p>',
    })).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 502,
      message: 'El proveedor de correo no aceptó al destinatario.',
    });
  });

  it('propaga errores de configuración y transporte sin ocultarlos', async () => {
    sendMail.mockRejectedValue(new Error('EAUTH'));

    await expect(enviarCorreo({
      para: 'ana@example.test',
      asunto: 'Bienvenida',
      html: '<p>Hola</p>',
    })).rejects.toThrow('EAUTH');

    env.mailPass = '';
    await expect(enviarCorreo({
      para: 'ana@example.test',
      asunto: 'Bienvenida',
      html: '<p>Hola</p>',
    })).rejects.toMatchObject({ statusCode: 503 });
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});
