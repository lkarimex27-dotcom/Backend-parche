jest.mock('../src/utils/mailer', () => ({ enviarCorreo: jest.fn(async () => ({ accepted: ['x'] })) }));
const { enviarCorreo } = require('../src/utils/mailer');
const { avisoDe, avisarCambio } = require('../src/services/pedidoCorreos.service');

describe('Correos al cliente según el estado del pedido', () => {
  beforeEach(() => jest.clearAllMocks());

  it('«en proceso» una sola vez: al confirmarlo o al entrar a cocina, lo primero', () => {
    expect(avisoDe('Recibido', 'Confirmado')).toBe('proceso');
    expect(avisoDe('Por confirmar', 'En cocina')).toBe('proceso');
    expect(avisoDe('Confirmado', 'En cocina')).toBeNull();
    expect(avisoDe('En cocina', 'En cocina')).toBeNull();
  });

  it('«va en camino» al salir; nada al entregarlo o cancelarlo', () => {
    expect(avisoDe('En cocina', 'En camino')).toBe('camino');
    expect(avisoDe('En camino', 'Entregado')).toBeNull();
    expect(avisoDe('Recibido', 'Cancelado')).toBeNull();
  });

  it('se envía al correo del cliente con el código del pedido', async () => {
    const enviado = await avisarCambio('En cocina', { id_pedido: 7, estado: 'En camino', correo: 'cliente@x.co', tipo_entrega: 'domicilio', direccion_entrega: 'Calle 1', estado_pago: 'Pagado' });
    expect(enviado).toBe(true);
    expect(enviarCorreo).toHaveBeenCalledWith(expect.objectContaining({ para: 'cliente@x.co', asunto: 'Tu pedido PED-0007 va en camino' }));
  });

  it('si el correo falla, no rompe el cambio de estado', async () => {
    enviarCorreo.mockRejectedValueOnce(new Error('sin internet'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(avisarCambio('Recibido', { id_pedido: 8, estado: 'Confirmado', correo: 'c@x.co', items: [] })).resolves.toBe(false);
  });
});
