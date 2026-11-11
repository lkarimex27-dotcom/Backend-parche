// Sin base de datos: modelo de rol, transacción y correo se simulan
let mockRol;
jest.mock('../src/config/db', () => ({ withTransaction: async (fn) => fn({ query: jest.fn() }) }));
jest.mock('../src/models/rol.model', () => ({
  obtenerPorId: jest.fn(async () => mockRol),
  actualizar: jest.fn(async (id, d) => ({ ...mockRol, ...d })),
  eliminar: jest.fn(async () => true),
  contarUsuarios: jest.fn(async () => 0),
  correosDeUsuarios: jest.fn(async () => [{ correo: 'ana@x.com', nombre: 'Ana' }, { correo: 'luis@x.com', nombre: 'Luis' }]),
}));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => ({})) }));
const Rol = require('../src/models/rol.model');
const { enviarCorreo } = require('../src/utils/mailer');
const service = require('../src/services/rol.service');

describe('Cambio de estado de un rol', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRol = { id_rol: 4, nombre_rol: 'CAJERO', estado: 'ACTIVO' }; });

  it('avisa por correo a cada usuario del rol', async () => {
    await service.actualizar(4, { nombre_rol: 'CAJERO', estado: 'INACTIVO' });
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    expect(enviarCorreo.mock.calls[0][0]).toMatchObject({ para: 'ana@x.com' });
  });

  it('si el correo falla, el cambio igual se guarda', async () => {
    enviarCorreo.mockRejectedValue(new Error('SMTP caído'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(service.actualizar(4, { nombre_rol: 'CAJERO', estado: 'INACTIVO' })).resolves.toMatchObject({ estado: 'INACTIVO' });
    spy.mockRestore();
    enviarCorreo.mockReset();
  });

  it('sin cambio de estado no envía correos', async () => {
    await service.actualizar(4, { nombre_rol: 'CAJERO 2' });
    expect(enviarCorreo).not.toHaveBeenCalled();
  });
});

describe('Eliminar un rol', () => {
  beforeEach(() => jest.clearAllMocks());

  it('un rol activo no se elimina', async () => {
    mockRol = { id_rol: 4, estado: 'ACTIVO' };
    await expect(service.eliminar(4)).rejects.toThrow('Solo se puede eliminar un rol inactivo');
    expect(Rol.eliminar).not.toHaveBeenCalled();
  });

  it('con usuarios asociados lo dice claro', async () => {
    mockRol = { id_rol: 4, estado: 'INACTIVO' };
    Rol.contarUsuarios.mockResolvedValueOnce(3);
    await expect(service.eliminar(4)).rejects.toThrow('el rol tiene usuarios asociados'.replace('el', 'El'));
  });

  it('inactivo y sin usuarios sí se elimina', async () => {
    mockRol = { id_rol: 4, estado: 'INACTIVO' };
    await service.eliminar(4);
    expect(Rol.eliminar).toHaveBeenCalled();
  });
});
