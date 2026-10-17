process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: el modelo se simula
const clientes = {
  1: { id_persona: 1, nombre: 'Cliente mostrador', documento: '000000000', id_usuario: null },
  2: { id_persona: 2, nombre: 'Ana', documento: '1234567', id_usuario: null },
};
jest.mock('../src/models/cliente.model', () => ({
  obtenerPorId: jest.fn(async (id) => clientes[id] || null),
  actualizar: jest.fn(async () => ({ id_persona: 2, id_usuario: null })),
  eliminarSinCuenta: jest.fn(async () => true),
}));
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn({ query: jest.fn() }) }));
const service = require('../src/services/cliente.service');

describe('Cliente mostrador (000000000)', () => {
  it('no se puede desactivar ni editar', async () => {
    await expect(service.actualizar(1, { estado: 'INACTIVO' })).rejects.toThrow('mostrador');
  });
  it('no se puede eliminar', async () => {
    await expect(service.eliminar(1)).rejects.toThrow('mostrador');
  });
  it('los demás clientes sí', async () => {
    await expect(service.actualizar(2, { estado: 'INACTIVO' })).resolves.toBeTruthy();
    await expect(service.eliminar(2)).resolves.toBeUndefined();
  });
});
