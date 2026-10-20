process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

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
const service = require('../src/services/recuperacion.service');

describe('Olvidé mi contraseña no revela qué correos tienen cuenta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a una cuenta activa le envía el código', async () => {
    await service.solicitar({ correo: 'ana@correo.com' });
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
  });

  it.each(['nadie@correo.com', 'inactiva@correo.com'])('con %s responde igual, sin error y sin enviar nada', async (correo) => {
    await expect(service.solicitar({ correo })).resolves.toBeUndefined();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });
});
