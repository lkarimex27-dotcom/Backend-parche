// La lista de pedidos no trae las imágenes de los comprobantes (pesaban 1 MB con 25 pedidos y llenaban el navegador);
// cada imagen se pide aparte y la ve solo el cliente dueño o el personal que puede ver pedidos.
jest.mock('../config/db', () => ({ query: jest.fn(), withTransaction: jest.fn((fn) => fn({})) }));
jest.mock('../src/models/permiso.model', () => ({ tienePermiso: jest.fn(), tieneRol: jest.fn() }));

const { query } = require('../config/db');
const Pedido = require('../src/models/pedido.model');
const Permiso = require('../src/models/permiso.model');
const service = require('../src/services/pedido.service');

beforeEach(() => jest.clearAllMocks());

describe('Lista de pedidos sin imágenes', () => {
  it('el panel y «Mis pedidos» reciben cada comprobante sin la imagen, con su posición', async () => {
    query.mockResolvedValue({ rows: [] });
    await Pedido.listar();
    await Pedido.listarDeCliente(7);
    for (const [sql] of query.mock.calls) {
      expect(sql).toContain("NULL::text AS comprobante");
      expect(sql).toContain("(x.c - 'imagen') || jsonb_build_object('indice', x.i - 1)");
      expect(sql).not.toMatch(/p\.comprobante,/);
    }
  });

  it('un solo pedido (y la lógica del servidor) sí trae las imágenes', async () => {
    query.mockResolvedValue({ rows: [{ id_pedido: 3 }] });
    await Pedido.obtenerPorId(3);
    expect(query.mock.calls[0][0]).toContain('p.comprobante, CASE WHEN jsonb_array_length(p.comprobantes)');
    expect(query.mock.calls[0][0]).not.toContain("- 'imagen'");
  });
});

describe('La imagen de un comprobante (GET /pedidos/:id/comprobantes/:indice)', () => {
  const guardado = (extra = {}) => ({ rows: [{ id_cliente: 7, imagen: 'data:image/jpeg;base64,AAAA', ...extra }] });

  it('el cliente dueño la ve', async () => {
    query.mockResolvedValue(guardado());
    await expect(service.imagenComprobante(3, 0, 7)).resolves.toEqual({ imagen: 'data:image/jpeg;base64,AAAA' });
    expect(query.mock.calls[0][1]).toEqual([3, 0]);
  });

  it('otro cliente no (ni sabe si el pedido existe); el personal que ve pedidos sí', async () => {
    query.mockResolvedValue(guardado());
    Permiso.tienePermiso.mockResolvedValueOnce(false);
    await expect(service.imagenComprobante(3, 0, 99)).rejects.toMatchObject({ statusCode: 404 });
    Permiso.tienePermiso.mockResolvedValueOnce(true);
    await expect(service.imagenComprobante(3, 0, 5)).resolves.toHaveProperty('imagen');
    expect(Permiso.tienePermiso).toHaveBeenLastCalledWith(5, 'PEDIDOS', 'VER');
  });

  it('un comprobante que no existe es 404', async () => {
    query.mockResolvedValue(guardado({ imagen: null }));
    await expect(service.imagenComprobante(3, 4, 7)).rejects.toThrow('Comprobante no encontrado');
    query.mockResolvedValue({ rows: [] });
    await expect(service.imagenComprobante(99, 0, 7)).rejects.toThrow('Pedido no encontrado');
  });
});
