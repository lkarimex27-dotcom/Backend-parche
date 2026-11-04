process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

jest.mock('../src/models/insumoProducto.model', () => ({
  gaseosas: jest.fn(async () => [{ nombre: 'Gaseosa Cola (400ml)', agotada: false }]),
}));

const Modelo = require('../src/models/insumoProducto.model');
const service = require('../src/services/insumoProducto.service');

describe('Listar gaseosas disponibles', () => {
  it('delega al modelo la consulta de existencias', async () => {
    await expect(service.gaseosas()).resolves.toEqual([
      { nombre: 'Gaseosa Cola (400ml)', agotada: false },
    ]);
    expect(Modelo.gaseosas).toHaveBeenCalledTimes(1);
  });
});
