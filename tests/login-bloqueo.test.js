process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: el modelo de usuario se simula
const bcrypt = require('bcryptjs');
const HASH = bcrypt.hashSync('clave-correcta', 4);
let mockUsuario;
jest.mock('../src/models/usuario.model', () => ({
  obtenerParaLogin: jest.fn(async () => mockUsuario),
  registrarIntentoFallido: jest.fn(async () => ({ intentos_fallidos: 1, bloqueado_hasta: null })),
  reiniciarIntentos: jest.fn(async () => undefined),
  obtenerPorId: jest.fn(async () => ({ id_usuario: 3, estado: 'ACTIVO' })),
}));
jest.mock('../src/models/permiso.model', () => ({ permisosDeUsuario: jest.fn(async () => []) }));
const Usuario = require('../src/models/usuario.model');
const auth = require('../src/services/auth.service');

const base = () => ({ id_usuario: 3, correo: 'ana@x.com', contrasena: HASH, estado: 'ACTIVO', intentos_fallidos: 0, bloqueado_hasta: null });

describe('Bloqueo de login por intentos fallidos', () => {
  beforeEach(() => { jest.clearAllMocks(); mockUsuario = base(); });

  it('una clave incorrecta suma un intento y responde el mensaje genérico', async () => {
    await expect(auth.login({ correo: 'ana@x.com', contrasena: 'mala' })).rejects.toThrow('Correo o contraseña incorrectos');
    expect(Usuario.registrarIntentoFallido).toHaveBeenCalledWith(3, 5, 15);
  });

  it('el quinto intento fallido bloquea y lo dice claro', async () => {
    Usuario.registrarIntentoFallido.mockResolvedValueOnce({ intentos_fallidos: 0, bloqueado_hasta: new Date(Date.now() + 15 * 60000) });
    await expect(auth.login({ correo: 'ana@x.com', contrasena: 'mala' })).rejects.toThrow(/bloqueada.*15 minutos/);
  });

  it('bloqueada, ni la clave correcta entra', async () => {
    mockUsuario.bloqueado_hasta = new Date(Date.now() + 5 * 60000);
    await expect(auth.login({ correo: 'ana@x.com', contrasena: 'clave-correcta' })).rejects.toMatchObject({ statusCode: 403 });
    expect(Usuario.reiniciarIntentos).not.toHaveBeenCalled();
  });

  it('un login exitoso reinicia el contador', async () => {
    mockUsuario.intentos_fallidos = 3;
    const r = await auth.login({ correo: 'ana@x.com', contrasena: 'clave-correcta' });
    expect(r.token).toBeTruthy();
    expect(Usuario.reiniciarIntentos).toHaveBeenCalledWith(3);
  });

  it('un correo que no existe no registra intentos (no revela nada)', async () => {
    mockUsuario = null;
    await expect(auth.login({ correo: 'nadie@x.com', contrasena: 'x' })).rejects.toThrow('Correo o contraseña incorrectos');
    expect(Usuario.registrarIntentoFallido).not.toHaveBeenCalled();
  });
});
