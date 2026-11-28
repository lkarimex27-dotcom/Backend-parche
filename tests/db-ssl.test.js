// Auditoría ronda 3 (6): la conexión a Neon verifica el certificado; una base local va sin SSL
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ on: jest.fn() })), types: { setTypeParser: jest.fn() } }));

const opcionesCon = (url) => {
  let opciones;
  jest.isolateModules(() => {
    jest.doMock('../config/env', () => ({ databaseUrl: url }));
    require('../config/db');
    opciones = require('pg').Pool.mock.calls.at(-1)[0];
  });
  return opciones;
};

describe('SSL de la base (R3-6)', () => {
  it('Neon: verifica el certificado', () => {
    expect(opcionesCon('postgresql://u:p@ep-x.us-east-2.aws.neon.tech/db').ssl).toEqual({ rejectUnauthorized: true });
  });
  it('PostgreSQL local: sin SSL', () => {
    expect(opcionesCon('postgresql://u:p@localhost:5432/db').ssl).toBe(false);
  });
});
