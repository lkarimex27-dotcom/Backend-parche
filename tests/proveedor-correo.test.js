// Auditoría ronda 3 (2): el correo (y el del contacto) de un proveedor se puede borrar.
// Antes el panel no lo enviaba al quedar vacío y el UPDATE (COALESCE) conservaba el anterior.
jest.mock('../config/db', () => ({ query: jest.fn(async () => ({ rows: [{ id_proveedor: 3 }] })) }));
const db = require('../config/db');
const v = require('../src/validators/proveedor.validator');
const Proveedor = require('../src/models/proveedor.model');

describe('Borrar el correo de un proveedor', () => {
  it('el validador acepta "" y sigue rechazando un correo mal escrito', () => {
    expect(v.actualizarProveedor.safeParse({ correo: '', contacto_correo: '' }).success).toBe(true);
    expect(v.crearProveedor.safeParse({ nombre: 'Distri', contacto_correo: '' }).success).toBe(true);
    expect(v.actualizarProveedor.safeParse({ contacto_correo: 'no-es-correo' }).success).toBe(false);
  });

  it('"" llega al UPDATE como valor (no como null, que COALESCE ignoraría)', async () => {
    await Proveedor.actualizar(3, { contacto_correo: '' });
    const [sql, params] = db.query.mock.calls[0];
    const posicion = Number(/contacto_correo = COALESCE\(\$(\d+)/.exec(sql)[1]);
    expect(params[posicion - 1]).toBe('');
  });
});
