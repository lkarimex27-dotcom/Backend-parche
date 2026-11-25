jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/db');
const Pedido = require('../src/models/pedido.model');

describe('destinatario del pedido', () => {
  beforeEach(() => jest.clearAllMocks());

  it('guarda el nombre y teléfono de quien recibe sin reemplazar al comprador', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id_pedido: 42 }] }) };

    await Pedido.crear(client, {
      id_cliente: 7,
      estado: 'Recibido',
      nombre: 'Persona que recibe',
      telefono: '3001234567',
      tipo_entrega: 'domicilio',
      direccion: 'Calle 1',
      pago: 'Efectivo',
      estado_pago: 'Pendiente',
      subtotal: 13000,
      costo_domicilio_cop: 4000,
      total: 17000,
      id_barrio: 1,
      estimacion_inicial: {},
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('nombre_contacto, telefono_contacto');
    expect(params[2]).toBe('Persona que recibe');
    expect(params[3]).toBe('3001234567');
    expect(params[0]).toBe(7);
  });

  it('expone al administrador los datos del destinatario de forma explícita', async () => {
    const recipient = { nombre: 'Persona que recibe', telefono: '3001234567' };
    query.mockResolvedValueOnce({
      rows: [{
        id_pedido: 42,
        cliente: 'Comprador',
        nombre_contacto: recipient.nombre,
        telefono_contacto: recipient.telefono,
        destinatario: recipient,
      }],
    });

    const [order] = await Pedido.listar();
    const [sql] = query.mock.calls[0];

    expect(sql).toContain("'nombre', COALESCE(p.nombre_contacto, pe.nombre)");
    expect(sql).toContain("'telefono', p.telefono_contacto");
    expect(order.cliente).toBe('Comprador');
    expect(order.destinatario).toEqual(recipient);
  });
});
