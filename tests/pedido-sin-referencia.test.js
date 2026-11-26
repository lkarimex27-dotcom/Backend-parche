const v = require('../src/validators/pedido.validator');

// El cliente ya no escribe la referencia del banco: basta la imagen y el valor transferido
describe('Comprobante sin número de referencia', () => {
  const pedido = {
    nombre: 'Cliente', telefono: '3000000000', direccion: 'Calle 1', tipo_entrega: 'recoger', pago: 'Nequi',
    comprobante: 'data:image/jpeg;base64,AAAA', items: [{ producto: 'Mini', cantidad: 1 }],
  };

  it('el pedido pasa con imagen y valor', () => {
    expect(v.crearPedido.safeParse({ ...pedido, valor_pago: 13000 }).success).toBe(true);
  });

  it('sin el valor pide escribirlo', () => {
    const r = v.crearPedido.safeParse(pedido);
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toBe('Escribe el valor que transferiste');
  });

  it('un comprobante nuevo pasa sin referencia', () => {
    expect(v.subirComprobante.safeParse({ comprobante: pedido.comprobante, valor: 13000 }).success).toBe(true);
  });
});
