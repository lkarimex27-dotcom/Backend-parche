// Sin base de datos: modelos y transacción se simulan
const mockClient = { query: jest.fn(async () => ({ rows: [] })) };
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn(mockClient) }));
jest.mock('../src/models/usuario.model', () => ({
  obtenerPorId: jest.fn(async () => ({ id_usuario: 5, correo: 'ana@x.com', estado: 'ACTIVO', nombre: 'Ana', telefono: '300', roles: ['CAJERO'] })),
  actualizarUsuario: jest.fn(async () => {}),
  actualizarPersona: jest.fn(async () => {}),
  reemplazarRoles: jest.fn(async () => true),
}));
jest.mock('../src/models/auditoria.model', () => ({ registrar: jest.fn(async () => {}), listarDeUsuario: jest.fn(async () => [{ campo: 'estado' }]) }));
const Auditoria = require('../src/models/auditoria.model');
const service = require('../src/services/usuario.service');

describe('Historial de cambios de usuario', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registra solo los campos que cambiaron, con quién los cambió', async () => {
    await service.actualizar(5, { estado: 'INACTIVO', nombre: 'Ana', telefono: '301', roles: ['CAJERO'] }, 1);
    expect(Auditoria.registrar).toHaveBeenCalledWith(mockClient, [
      { id_usuario: 5, campo: 'estado', valor_anterior: 'ACTIVO', valor_nuevo: 'INACTIVO', cambiado_por: 1 },
      { id_usuario: 5, campo: 'telefono', valor_anterior: '300', valor_nuevo: '301', cambiado_por: 1 },
    ]);
  });

  it('devuelve el historial del usuario', async () => {
    await expect(service.historial(5)).resolves.toEqual([{ campo: 'estado' }]);
  });
});
