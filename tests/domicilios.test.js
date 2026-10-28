const { crearDomicilio, actualizarDomicilio } = require('../src/validators/domicilio.validator');

describe('validación de domicilios de pedidos', () => {
  it('requiere pedido y dirección para crear un domicilio', () => {
    expect(crearDomicilio.safeParse({
      id_pedido: '12',
      direccion_entrega: 'Calle 10 # 20-30',
    }).success).toBe(true);
    expect(crearDomicilio.safeParse({ direccion_entrega: 'Calle 10 # 20-30' }).success).toBe(false);
    expect(crearDomicilio.safeParse({ id_pedido: 12, direccion_entrega: 'x' }).success).toBe(false);
  });

  it('permite editar datos parciales o enviar valores nulos para borrar el contacto', () => {
    expect(actualizarDomicilio.safeParse({ direccion_entrega: 'Carrera 5 # 6-7' }).success).toBe(true);
    expect(actualizarDomicilio.safeParse({ telefono_contacto: null }).success).toBe(true);
    expect(actualizarDomicilio.safeParse({}).success).toBe(false);
  });
});
