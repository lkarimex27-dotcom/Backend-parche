process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: se simulan los clientes y sus compras
const clientes = {
  1: { id_persona: 1, nombre: 'Ana', documento: '1020304050', id_usuario: 7 },
  2: { id_persona: 2, nombre: 'Luis', documento: '1122334455', id_usuario: null },
  3: { id_persona: 3, nombre: 'Cliente mostrador', documento: '000000000', id_usuario: null },
};
const compras = { 1: 0, 2: 2, 3: 0 };
jest.mock('../src/models/cliente.model', () => ({
  obtenerPorId: jest.fn(async (id) => clientes[id] ?? null),
  compras: jest.fn(async (c) => compras[c.id_persona]),
  eliminar: jest.fn(async () => undefined),
}));
jest.mock('../src/utils/provisional', () => ({}));
const Cliente = require('../src/models/cliente.model');
const service = require('../src/services/cliente.service');

describe('Eliminar un cliente', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin compras se elimina (aunque tenga cuenta)', async () => {
    await service.eliminar(1);
    expect(Cliente.eliminar).toHaveBeenCalledWith(clientes[1]);
  });

  it('con compras no: solo se puede anular', async () => {
    await expect(service.eliminar(2)).rejects.toThrow('tiene 2 compras');
    expect(Cliente.eliminar).not.toHaveBeenCalled();
  });

  it('el cliente mostrador nunca', async () => {
    await expect(service.eliminar(3)).rejects.toThrow('mostrador');
  });
});
