process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
const { contrasenaProvisional } = require('../src/utils/provisional');

describe('Contraseña provisional', () => {
  it('siempre trae mayúscula, minúscula y número, 10 caracteres y nada confuso (0/O, 1/l/I)', () => {
    const vistas = new Set();
    for (let i = 0; i < 2000; i++) {
      const p = contrasenaProvisional();
      expect(p).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[^0O1lI]{10}$/);
      vistas.add(p);
    }
    expect(vistas.size).toBe(2000); // no se repiten
  });
});
