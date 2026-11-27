// A1: quien entra a producción solo por poder editar pedidos (vendedor, domiciliario, empleado) mueve la orden de un
// pedido y nada más; producción (permiso propio) hace todo. La autorización es la real; los permisos y la base se simulan.
process.env.JWT_SECRET = 'secreto_de_pruebas_secreto_de_pruebas_123';
jest.mock('../config/db', () => ({ query: jest.fn(), withTransaction: jest.fn((fn) => fn({})) }));
jest.mock('../src/models/permiso.model', () => ({ tienePermiso: jest.fn(), tieneRol: jest.fn() }));
jest.mock('../src/models/panel.model', () => ({ datos: jest.fn(), actualizarConCliente: jest.fn(async () => true) }));
jest.mock('../src/services/consumo.service', () => ({ descontarCon: jest.fn(), ingresarCon: jest.fn() }));
jest.mock('../src/services/pedido.service', () => ({ seguirProduccion: jest.fn(async () => null), avisarSeguimiento: jest.fn() }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const Permiso = require('../src/models/permiso.model');
const Panel = require('../src/models/panel.model');
const Consumo = require('../src/services/consumo.service');
const panelRoutes = require('../src/routes/panel.routes');

const cfg = {
  modulo: 'ORDENES_PRODUCCION',
  columnas: async (f) => ({ numero_orden: f[0], estado: f[8] }),
  revisar: () => null,
};
const app = express();
app.use(express.json());
app.use('/ordenes-produccion', panelRoutes(cfg));
app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ mensaje: err.message }));

const token = (id) => `Bearer ${jwt.sign({ correo: 'x@x.co' }, process.env.JWT_SECRET, { subject: String(id) })}`;
// 7 = domiciliario (solo PEDIDOS:EDITAR); 3 = cocinero (ORDENES_PRODUCCION:EDITAR)
const permisos = { 7: ['PEDIDOS:EDITAR'], 3: ['ORDENES_PRODUCCION:EDITAR'] };
const fila = (estado, pedido) => { const f = Array(17).fill(''); f[0] = 'OP-0009'; f[8] = estado; f[15] = pedido; return f; };
const avanzar = (quien, pedido, extra = {}) =>
  request(app).post('/ordenes-produccion/12/avanzar').set('Authorization', token(quien))
    .send({ datos_panel: fila('En cocina', pedido), insumos: [{ insumo: 'Pan', cantidad: 1 }], ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  Permiso.tienePermiso.mockImplementation(async (id, modulo, privilegio) => (permisos[id] || []).includes(`${modulo}:${privilegio}`));
});

describe('Producción con el permiso de pedidos (A1)', () => {
  it('el domiciliario mueve la orden de un pedido (y se descuentan sus insumos)', async () => {
    Panel.datos.mockResolvedValue(fila('Confirmado', 'PED-0050'));
    expect((await avanzar(7, 'PED-0050')).status).toBe(200);
    expect(Consumo.descontarCon).toHaveBeenCalled();
  });

  it('no mueve una orden hecha a mano ni registra lo preparado en el inventario', async () => {
    Panel.datos.mockResolvedValue(fila('Confirmado', ''));
    const mano = await avanzar(7, '');
    expect(mano.status).toBe(403);
    Panel.datos.mockResolvedValue(fila('Confirmado', 'PED-0050'));
    const preparado = await avanzar(7, 'PED-0050', { productos: [{ insumo: 'Salsa de la casa', cantidad: 1000 }] });
    expect(preparado.status).toBe(403);
    expect(Consumo.descontarCon).not.toHaveBeenCalled();
    expect(Consumo.ingresarCon).not.toHaveBeenCalled();
  });

  it('tampoco edita por PUT una orden hecha a mano', async () => {
    Panel.datos.mockResolvedValue(fila('Recibido', ''));
    const res = await request(app).put('/ordenes-produccion/12').set('Authorization', token(7)).send({ datos_panel: fila('Confirmado', '') });
    expect(res.status).toBe(403);
    expect(Panel.actualizarConCliente).not.toHaveBeenCalled();
  });

  it('producción (permiso propio) sí hace todo: órdenes a mano y lo preparado', async () => {
    Panel.datos.mockResolvedValue(fila('Confirmado', ''));
    expect((await avanzar(3, '', { productos: [{ insumo: 'Salsa de la casa', cantidad: 2 }] })).status).toBe(200);
    expect(Consumo.ingresarCon).toHaveBeenCalled();
  });

  it('sin ninguno de los dos permisos (un cliente): 403', async () => {
    Panel.datos.mockResolvedValue(fila('Confirmado', 'PED-0050'));
    expect((await avanzar(99, 'PED-0050')).status).toBe(403);
  });
});
