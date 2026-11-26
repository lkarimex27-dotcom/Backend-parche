jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/db');
const Permiso = require('../src/models/permiso.model');
const { authorize } = require('../src/middlewares/auth.middleware');

describe('permisos efectivos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('concede todos los módulos al administrador aunque falten permisos sembrados', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });

    await expect(Permiso.tienePermiso(5, 'ORDENES_PRODUCCION', 'EDITAR')).resolves.toBe(true);

    expect(query.mock.calls[0][0]).toContain("r.nombre_rol = 'ADMINISTRADOR'");
    expect(query.mock.calls[0][1]).toEqual([5, 'ORDENES_PRODUCCION', 'EDITAR']);
  });

  it('incluye el catálogo completo de permisos del administrador para el cliente', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await Permiso.permisosDeUsuario(5);

    expect(query.mock.calls[0][0]).toContain('CROSS JOIN modulos m');
    expect(query.mock.calls[0][0]).toContain('CROSS JOIN privilegios pr');
    expect(query.mock.calls[0][0]).toContain("r.nombre_rol = 'ADMINISTRADOR'");
    expect(query.mock.calls[0][0]).toContain('u.es_administrador_principal = TRUE');
    expect(query.mock.calls[0][1]).toEqual([5]);
  });

  it('permite el acceso a todo al superadministrador aunque no tenga el rol asignado', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });

    await expect(Permiso.tienePermiso(5, 'ORDENES_PRODUCCION', 'EDITAR')).resolves.toBe(true);

    expect(query.mock.calls[0][0]).toContain('u.es_administrador_principal = TRUE');
  });

  it('un usuario sin permisos (un cliente) no edita órdenes de producción', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    const next = jest.fn();

    await authorize('ORDENES_PRODUCCION', 'EDITAR')({ user: { id: 99 } }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(query.mock.calls.map((c) => c[1])).toEqual([[99, 'ORDENES_PRODUCCION', 'EDITAR'], [99, 'PEDIDOS', 'EDITAR']]);
  });

  it('quien edita pedidos sí mueve su orden de producción (van en el mismo estado)', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 1 });
    const next = jest.fn();

    await authorize('ORDENES_PRODUCCION', 'EDITAR')({ user: { id: 7 } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('editar pedidos no da otros permisos de producción', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    const next = jest.fn();

    await authorize('ORDENES_PRODUCCION', 'ELIMINAR')({ user: { id: 7 } }, {}, next);

    expect(query).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
