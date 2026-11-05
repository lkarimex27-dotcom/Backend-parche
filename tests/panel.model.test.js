const mockClientQuery = jest.fn();
const mockWithTransaction = jest.fn((callback) => callback({ query: mockClientQuery }));

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  withTransaction: (callback) => mockWithTransaction(callback),
}));

const Panel = require('../src/models/panel.model');

describe('Panel.crearPar', () => {
  beforeEach(() => {
    mockClientQuery.mockReset();
    mockWithTransaction.mockClear();
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 21 }] })
      .mockResolvedValueOnce({ rows: [{ id: 34 }] })
      .mockResolvedValueOnce({ rowCount: 1 });
  });

  it('enlaza el PNC con la orden nueva y actualiza la orden afectada dentro de la transacción', async () => {
    const cfgOrden = {
      tabla: 'ordenes_produccion',
      id: 'id_orden_produccion',
      columnas: (row) => ({ numero_orden: row[0], estado: row[8] }),
    };
    const cfgPnc = {
      tabla: 'producto_no_conforme',
      id: 'id_producto_no_conforme',
      columnas: jest.fn((row, userId, relacionados) => ({
        id_usuario: userId,
        id_orden_produccion: relacionados.id_orden_produccion,
      })),
    };

    const result = await Panel.crearPar({
      cfgA: cfgPnc,
      filaA: ['PNC-1'],
      cfgB: cfgOrden,
      filaB: ['OP-2', '', '', 2, '2026-10-22', '', '', '', 'Recibida'],
      idUsuario: 7,
      actualizarExistente: {
        cfg: cfgOrden,
        id: 12,
        fila: ['OP-1', '', '', 1, '2026-10-21', '', '', '', 'Producto no conforme'],
      },
    });

    expect(result).toEqual({ idA: 34, idB: 21 });
    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(cfgPnc.columnas).toHaveBeenCalledWith(['PNC-1'], 7, {
      id_orden_produccion: 21,
    });
    expect(mockClientQuery).toHaveBeenCalledTimes(3);
    expect(mockClientQuery.mock.calls[0][0]).toContain('INSERT INTO ordenes_produccion');
    expect(mockClientQuery.mock.calls[1][0]).toContain('INSERT INTO producto_no_conforme');
    expect(mockClientQuery.mock.calls[1][1]).toContain(21);
    expect(mockClientQuery.mock.calls[2][0]).toContain('UPDATE ordenes_produccion');
    expect(mockClientQuery.mock.calls[2][1][0]).toBe(12);
  });
});
