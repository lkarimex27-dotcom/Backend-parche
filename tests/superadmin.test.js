process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';

// Sin base de datos: el modelo y la transacción se simulan
const usuarios = {
  1: { id_usuario: 1, correo: 'admin@minifood.com', es_administrador_principal: true, roles: ['ADMINISTRADOR'] },
  2: { id_usuario: 2, correo: 'ana@minifood.com', es_administrador_principal: false, roles: ['ADMINISTRADOR'] },
};
jest.mock('../src/models/usuario.model', () => ({
  obtenerPorId: jest.fn(async (id) => usuarios[id] || null),
  actualizarUsuario: jest.fn(async () => {}),
  actualizarPersona: jest.fn(async () => {}),
  reemplazarRoles: jest.fn(async () => true),
}));
jest.mock('../src/config/db', () => ({ withTransaction: (fn) => fn({ query: jest.fn() }) }));
const service = require('../src/services/usuario.service');

describe('Superadministrador (admin@minifood.com)', () => {
  it('ningún administrador lo puede desactivar', async () => {
    await expect(service.actualizar(1, { estado: 'INACTIVO' }, 2)).rejects.toThrow('no se puede desactivar');
  });

  it('no se le puede quitar el rol Administrador', async () => {
    await expect(service.actualizar(1, { roles: ['CAJERO'] }, 2)).rejects.toThrow('no se puede desactivar');
  });

  it('no se le puede cambiar el correo', async () => {
    await expect(service.actualizar(1, { correo: 'otro@minifood.com' }, 2)).rejects.toThrow('admin@minifood.com');
  });

  it('un administrador normal sí puede desactivar a otro administrador o cambiarle el rol', async () => {
    await expect(service.actualizar(2, { estado: 'INACTIVO' }, 1)).resolves.toBeTruthy();
    await expect(service.actualizar(2, { roles: ['CAJERO'] }, 1)).resolves.toBeTruthy();
  });
});
