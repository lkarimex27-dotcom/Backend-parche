// B5: si el despliegue no define JWT_EXPIRES_IN, una sesión robada ya no sirve un año sino una semana
jest.mock('dotenv', () => ({ config: () => ({}) }));

describe('Duración de la sesión (B5)', () => {
  const antes = process.env.JWT_EXPIRES_IN;
  afterEach(() => { if (antes === undefined) delete process.env.JWT_EXPIRES_IN; else process.env.JWT_EXPIRES_IN = antes; });

  it('por defecto dura 7 días', () => {
    delete process.env.JWT_EXPIRES_IN;
    jest.isolateModules(() => expect(require('../config/env').jwtExpiresIn).toBe('7d'));
  });

  it('la variable JWT_EXPIRES_IN sigue mandando', () => {
    process.env.JWT_EXPIRES_IN = '1d';
    jest.isolateModules(() => expect(require('../config/env').jwtExpiresIn).toBe('1d'));
  });
});
