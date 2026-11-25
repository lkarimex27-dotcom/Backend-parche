// Sin base de datos: la transacción y el stock se simulan
const mockQuery = jest.fn();
jest.mock('../config/db', () => ({ withTransaction: async (fn) => fn({ query: mockQuery }) }));
jest.mock('../src/models/stock.model', () => ({ marcar: jest.fn(async () => undefined) }));
const service = require('../src/services/consumo.service');

describe('Lo preparado de un producto de insumo entra a su stock', () => {
  beforeEach(() => mockQuery.mockReset());

  it('suma la cantidad una sola vez por orden', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 1 });
    expect(await service.ingresar({ numero_orden: 'OP-0001', productos: [{ insumo: 'Salsa de la casa', cantidad: 2 }] }, 1)).toBe(true);
    expect(mockQuery.mock.calls[1][0]).toMatch(/stock = stock \+/);
    expect(mockQuery.mock.calls[1][1]).toEqual(['Salsa de la casa', 2]);

    mockQuery.mockReset().mockResolvedValueOnce({ rowCount: 0 }); // la orden ya había sumado
    expect(await service.ingresar({ numero_orden: 'OP-0001', productos: [{ insumo: 'Salsa de la casa', cantidad: 2 }] }, 1)).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('rechaza lo que no es un producto de insumo', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
    await expect(service.ingresar({ numero_orden: 'OP-0002', productos: [{ insumo: 'Hamburguesa Mini', cantidad: 1 }] }, 1))
      .rejects.toThrow('no es un producto de insumo');
  });
});
