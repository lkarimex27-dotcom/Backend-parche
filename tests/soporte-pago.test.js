const { huella, valorEsperado, revisar, normalizarReferencia } = require('../src/utils/soportePago');

describe('Validador de comprobantes de transferencia', () => {
  const pedido = { total: 160000, abono: 80000, estado_pago: 'Pendiente de verificación' };

  it('lo que se debe: el abono, luego el saldo; sin abono, el total', () => {
    expect(valorEsperado(pedido)).toBe(80000);
    expect(valorEsperado({ ...pedido, estado_pago: 'Abonado' })).toBe(80000);
    expect(valorEsperado({ total: 39000, abono: null })).toBe(39000);
  });

  it('rechaza un valor que no cubre lo que se debe', () => {
    expect(revisar({ pedido, referencia: 'M1', valor: 50000, hash: 'a', otros: [] })).toMatch(/no cubre/);
    expect(revisar({ pedido, referencia: 'M1', valor: 80000, hash: 'a', otros: [] })).toBeNull();
  });

  it('rechaza la misma imagen o la misma referencia usada en otro pedido', () => {
    const otros = [{ id_pedido: 12, hash: huella('img-vieja'), referencia: 'M 123-456' }];
    expect(revisar({ pedido, referencia: 'X9', valor: 80000, hash: huella('img-vieja'), otros })).toMatch(/PED-0012/);
    expect(revisar({ pedido, referencia: 'm123456', valor: 80000, hash: 'nueva', otros })).toMatch(/referencia/);
  });

  it('rechaza reenviar el mismo comprobante en el mismo pedido', () => {
    expect(revisar({ pedido, referencia: 'R', valor: 80000, hash: 'h', otros: [], propios: [{ hash: 'h' }] })).toMatch(/mismo comprobante/);
  });

  it('la referencia ignora espacios, puntos y guiones', () => {
    expect(normalizarReferencia(' m 12.34-5 ')).toBe('M12345');
  });
});
