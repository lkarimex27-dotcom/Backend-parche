// B2: quien solo puede crear/editar usuarios no puede darse (ni dar, ni quitar) el rol Administrador
jest.mock('../config/db', () => ({ withTransaction: (fn) => fn({}) }));
jest.mock('../src/models/usuario.model', () => ({
  obtenerPorId: jest.fn(),
  crearUsuario: jest.fn(async () => ({ id_usuario: 9 })),
  crearPersona: jest.fn(),
  actualizarUsuario: jest.fn(),
  actualizarPersona: jest.fn(),
  reemplazarRoles: jest.fn(async () => true),
}));
jest.mock('../src/models/permiso.model', () => ({ tienePermiso: jest.fn() }));
jest.mock('../src/models/auditoria.model', () => ({ registrar: jest.fn() }));
jest.mock('../src/utils/provisional', () => ({ contrasenaProvisional: () => 'Prov12345', enviarProvisional: jest.fn() }));

const Usuario = require('../src/models/usuario.model');
const Permiso = require('../src/models/permiso.model');
const service = require('../src/services/usuario.service');

const nuevo = (roles) => ({ nombre: 'Pedro', correo: 'pedro@parche.co', roles });

describe('Rol Administrador solo con permiso de editar roles (B2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Usuario.obtenerPorId.mockResolvedValue({ id_usuario: 5, roles: ['CAJERO'], es_administrador_principal: false });
  });

  it('editar usuarios no alcanza para darse el rol Administrador', async () => {
    Permiso.tienePermiso.mockResolvedValue(false);
    await expect(service.actualizar(5, { roles: ['CAJERO', 'ADMINISTRADOR'] }, 5)).rejects.toMatchObject({ statusCode: 403 });
    expect(Permiso.tienePermiso).toHaveBeenCalledWith(5, 'ROLES_PERMISOS', 'EDITAR');
    expect(Usuario.reemplazarRoles).not.toHaveBeenCalled();
  });

  it('tampoco para quitárselo a otro administrador', async () => {
    Permiso.tienePermiso.mockResolvedValue(false);
    Usuario.obtenerPorId.mockResolvedValue({ id_usuario: 6, roles: ['ADMINISTRADOR'], es_administrador_principal: false });
    await expect(service.actualizar(6, { roles: ['CAJERO'] }, 5)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('ni para crear un usuario Administrador', async () => {
    Permiso.tienePermiso.mockResolvedValue(false);
    await expect(service.crear(nuevo(['Administrador']), 5)).rejects.toMatchObject({ statusCode: 403 });
    expect(Usuario.crearUsuario).not.toHaveBeenCalled();
  });

  it('con permiso de editar roles sí se puede', async () => {
    Permiso.tienePermiso.mockResolvedValue(true);
    await service.actualizar(5, { roles: ['ADMINISTRADOR'] }, 1);
    await service.crear(nuevo(['ADMINISTRADOR']), 1);
    expect(Usuario.reemplazarRoles).toHaveBeenCalledTimes(2);
  });

  it('cambios que no tocan el rol Administrador no piden el permiso', async () => {
    await service.actualizar(5, { roles: ['DOMICILIARIO'], nombre: 'Ana' }, 5);
    await service.crear(nuevo(['CAJERO']), 5);
    expect(Permiso.tienePermiso).not.toHaveBeenCalled();
  });
});
