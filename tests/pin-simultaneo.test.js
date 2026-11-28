// Auditoría ronda 3 (1): el límite de 5 intentos del código no se salta mandando cientos de intentos a la vez.
// La base se simula: cada UPDATE … RETURNING se aplica de forma atómica (como en Postgres), con algo de latencia.
const crypto = require('crypto');
jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../src/models/usuario.model', () => ({ obtenerParaLogin: jest.fn(async () => ({ id_usuario: 1, correo: 'ana@correo.com', estado: 'ACTIVO' })) }));
jest.mock('../src/services/auth.service', () => ({ registrarVerificado: jest.fn(async () => ({ token: 't' })) }));
jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn() }));

const db = require('../config/db');
const recuperacion = require('../src/services/recuperacion.service');
const registro = require('../src/services/registro.service');

const hash = (c) => crypto.createHash('sha256').update(c).digest('hex');
const espera = () => new Promise((r) => setTimeout(r, Math.random() * 5));
let fila;
beforeEach(() => {
  fila = { codigo_hash: hash('424242'), intentos: 0 };
  db.query.mockImplementation(async (sql, [, maximo]) => {
    await espera(); // la red hasta Neon
    if (/UPDATE \w+ SET intentos = intentos \+ 1/.test(sql)) {
      if (fila.intentos >= maximo) return { rows: [] };
      fila.intentos += 1;
      return { rows: [{ codigo_hash: fila.codigo_hash }] };
    }
    if (/^\s*UPDATE recuperaciones_contrasena\s+SET verificacion_hash/.test(sql)) return { rows: [] };
    if (/DELETE FROM codigos_registro/.test(sql)) return { rows: [{ correo: 'ana@correo.com' }] };
    throw new Error(`consulta no simulada: ${sql}`);
  });
});

// 300 códigos distintos a la vez; el correcto va de último
const rafaga = (verificar) =>
  Promise.allSettled([...Array.from({ length: 299 }, (_, i) => String(i).padStart(6, '0')), '424242']
    .map((codigo) => verificar({ correo: 'ana@correo.com', codigo })));

describe('Intentos del código con peticiones simultáneas', () => {
  it('recuperar contraseña: solo 5 intentos se comparan y el código correcto llega tarde', async () => {
    const r = await rafaga(recuperacion.verificar);
    expect(fila.intentos).toBe(5);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(0);
  });

  it('registro: igual, solo 5 intentos', async () => {
    const r = await rafaga(registro.verificar);
    expect(fila.intentos).toBe(5);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(0);
  });

  it('el código correcto en el quinto intento sí entra', async () => {
    fila.intentos = 4;
    await expect(recuperacion.verificar({ correo: 'ana@correo.com', codigo: '424242' })).resolves.toHaveProperty('token');
    fila.intentos = 4;
    await expect(registro.verificar({ correo: 'ana@correo.com', codigo: '424242' })).resolves.toEqual({ token: 't' });
  });
});
