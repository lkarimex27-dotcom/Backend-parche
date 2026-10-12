const { crearUsuario, actualizarUsuario } = require('../src/validators/usuario.validator');
const { crearProveedor, actualizarProveedor } = require('../src/validators/proveedor.validator');

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

  it('rechaza correos sin arroba al crear o actualizar proveedores', () => {
    expect(crearProveedor.safeParse({
      nombre: 'Proveedor',
      correo: 'proveedor-ejemplo.com',
    }).success).toBe(false);
    expect(actualizarProveedor.safeParse({ correo: 'proveedor-ejemplo.com' }).success).toBe(false);
  });
});
