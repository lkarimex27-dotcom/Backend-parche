const { crearUsuario, actualizarUsuario } = require('../src/validators/usuario.validator');
const { crearProveedor, actualizarProveedor } = require('../src/validators/proveedor.validator');
const { estimar } = require('../src/validators/estimador.validator');
const { crearPedido } = require('../src/validators/pedido.validator');

describe('Validaciones de correo en CRUD', () => {
  it('rechaza correos sin arroba al crear o actualizar usuarios', () => {
    expect(crearUsuario.safeParse({
      correo: 'usuario-ejemplo.com',
      contrasena: 'contrasena-valida',
      nombre: 'Ana',
      roles: ['ADMIN'],
    }).success).toBe(false);
    expect(actualizarUsuario.safeParse({ correo: 'usuario-ejemplo.com' }).success).toBe(false);
  });

  describe('Validaciones de barrio en pedidos', () => {
    it('permite identificar el barrio por ID o por el nombre de la lista predeterminada', () => {
      expect(estimar.safeParse({ nombre_barrio: 'Santa Ana' }).success).toBe(true);
      expect(estimar.safeParse({ id_barrio: 1 }).success).toBe(true);
      expect(estimar.safeParse({ id_barrio: 1, distancia_km: 2.5 }).success).toBe(true);
      expect(estimar.safeParse({ id_barrio: 1, distancia_km: 250 }).success).toBe(true);
      expect(estimar.safeParse({
        id_barrio: 1,
        distancia_km: 8.1,
        items: [{ producto: 'Mini', cantidad: 2 }],
      }).success).toBe(true);
      expect(estimar.safeParse({
        nombre_barrio: 'Santa Ana',
        ubicacion: { lat: 6.3, lon: -75.5 },
      }).success).toBe(true);
      expect(estimar.safeParse({
        nombre_barrio: 'Santa Ana',
        ubicacion: { lat: 91, lon: -75.5 },
      }).success).toBe(false);
      expect(estimar.safeParse({ id_barrio: 1, distancia_km: null }).success).toBe(false);
      expect(estimar.safeParse({ id_barrio: 1, distancia_km: '2' }).success).toBe(false);
      expect(estimar.safeParse({
        id_barrio: 1,
        items: [{ producto: 'Mini', cantidad: 0 }],
      }).success).toBe(false);
      expect(estimar.safeParse({}).success).toBe(false);
      expect(estimar.safeParse({ id_barrio: 1, distancia_km: -1 }).success).toBe(false);

      const pedidoBase = {
        nombre: 'Cliente',
        telefono: '3000000000',
        direccion: 'Calle 1',
        pago: 'Efectivo',
        items: [{ producto: 'Mini', cantidad: 1 }],
      };
      expect(crearPedido.safeParse({
        ...pedidoBase, nombre_barrio: 'Santa Ana', distancia_km: 2.5,
      }).success).toBe(true);
      expect(crearPedido.safeParse({
        ...pedidoBase,
        nombre_barrio: 'Santa Ana',
        ubicacion: { lat: 6.3, lon: -75.5 },
      }).success).toBe(true);
      expect(crearPedido.safeParse({
        ...pedidoBase, nombre_barrio: 'Santa Ana', distancia_km: 250,
      }).success).toBe(true);
      expect(crearPedido.safeParse({
        ...pedidoBase, tipo_entrega: 'local',
      }).success).toBe(true);
      expect(crearPedido.safeParse({
        ...pedidoBase, tipo_entrega: 'recoger',
      }).success).toBe(true);
      expect(crearPedido.safeParse({
        ...pedidoBase, tipo_entrega: 'invalido',
      }).success).toBe(false);
      expect(crearPedido.safeParse(pedidoBase).success).toBe(false);
      expect(estimar.safeParse({ tipo_entrega: 'local' }).success).toBe(true);
      expect(estimar.safeParse({ tipo_entrega: 'recoger' }).success).toBe(true);
      expect(estimar.safeParse({ tipo_entrega: 'domicilio' }).success).toBe(false);
    });
  });

  it('rechaza correos sin arroba al crear o actualizar proveedores', () => {
    expect(crearProveedor.safeParse({
      nombre: 'Proveedor',
      correo: 'proveedor-ejemplo.com',
    }).success).toBe(false);
    expect(actualizarProveedor.safeParse({ correo: 'proveedor-ejemplo.com' }).success).toBe(false);
  });
});
