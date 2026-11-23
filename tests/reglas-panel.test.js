const R = require('../src/utils/reglasPanel');

const fila = (cambios) => { const f = Array(17).fill(''); Object.entries(cambios).forEach(([i, v]) => { f[i] = v; }); return f; };

describe('Órdenes de producción en el servidor', () => {
  it('una nueva empieza en Recibido o Confirmado', () => {
    expect(R.revisarProduccion(null, fila({ 8: 'Confirmado' }))).toBeNull();
    expect(R.revisarProduccion(null, fila({ 8: 'Finalizada' }))).toMatch(/nueva/);
  });
  it('solo avanza; no vuelve atrás ni sale de Finalizada', () => {
    expect(R.revisarProduccion(fila({ 8: 'En cocina' }), fila({ 8: 'Confirmado' }), { viaAvanzar: true })).toMatch(/no puede volver/);
    expect(R.revisarProduccion(fila({ 8: 'Finalizada' }), fila({ 8: 'En cocina' }), { viaAvanzar: true })).toMatch(/ya está/);
    expect(R.revisarProduccion(fila({ 8: 'Confirmado' }), fila({ 8: 'En cocina' }), { viaAvanzar: true })).toBeNull();
  });
  it('entrar a cocina o finalizar solo por «avanzar» (con el descuento de insumos)', () => {
    expect(R.revisarProduccion(fila({ 8: 'Confirmado' }), fila({ 8: 'En cocina' }))).toMatch(/cambio de estado/);
    expect(R.revisarProduccion(fila({ 8: 'Recibido' }), fila({ 8: 'Confirmado' }))).toBeNull();
  });
  it('las viejas «Entregado» cuentan como Finalizada; producto no conforme desde una que empezó', () => {
    expect(R.revisarProduccion(fila({ 8: 'Entregado' }), fila({ 8: 'Finalizada' }))).toBeNull();
    expect(R.revisarProduccion(fila({ 8: 'Finalizada' }), fila({ 8: 'Producto no conforme' }))).toBeNull();
    expect(R.revisarProduccion(fila({ 8: 'Recibido' }), fila({ 8: 'Producto no conforme' }))).toMatch(/no ha empezado/);
  });
});

describe('Ventas, devoluciones y pedidos del panel en el servidor', () => {
  it('una venta anulada no se reactiva y anular pide motivo', () => {
    expect(R.revisarVenta(fila({ 8: 'Anulada' }), fila({ 8: 'Activo' }))).toMatch(/no se reactiva/);
    expect(R.revisarVenta(fila({ 8: 'Activo' }), fila({ 8: 'Anulada', 14: '' }))).toMatch(/motivo/);
    expect(R.revisarVenta(fila({ 8: 'Activo' }), fila({ 8: 'Anulada', 14: 'Cliente pidió cancelar' }))).toBeNull();
  });
  it('una devolución no se edita; solo se anula con motivo', () => {
    const dev = fila({ 0: 'DEV-1', 4: 'Reembolso', 9: 'Activa' });
    expect(R.revisarDevolucion(dev, [...dev.slice(0, 4), 'Reposición', ...dev.slice(5)])).toMatch(/no se editan/);
    expect(R.revisarDevolucion(dev, Object.assign([...dev], { 9: 'Anulada', 10: 'Se registró dos veces' }))).toBeNull();
    expect(R.revisarDevolucion(Object.assign([...dev], { 9: 'Anulada' }), dev)).toMatch(/no se reactiva/);
    // una vieja sin total guardado: la app se lo completa al cargarla y anularla igual funciona
    const vieja = ['DEV-2', 'VTA-1', 'Ana', 'x', 'Reembolso', '2026-10-18', '[]', 9];
    expect(R.revisarDevolucion(vieja, [...vieja, 18500, 'Anulada', 'Se registró por error'])).toBeNull();
  });
  it('pedido del panel: abono del 50% desde $150.000, estados y pago solo avanzan', () => {
    expect(R.revisarPedidoPanel(null, fila({ 3: 'Domicilio', 5: 'Contraentrega', 6: 160000 }))).toMatch(/abono del 50%/);
    expect(R.revisarPedidoPanel(null, fila({ 3: 'Local', 5: 'Anticipado', 6: 160000 }))).toBeNull();
    expect(R.revisarPedidoPanel(fila({ 7: 'Entregado' }), fila({ 7: 'En camino' }))).toMatch(/ya está/);
    expect(R.revisarPedidoPanel(fila({ 7: 'En cocina' }), fila({ 7: 'Recibido' }))).toMatch(/no puede volver/);
    expect(R.revisarPedidoPanel(fila({ 8: 'Pagado' }), fila({ 8: 'Pendiente' }))).toMatch(/pago no puede volver/);
    expect(R.revisarPedidoPanel(fila({ 7: 'En cocina' }), fila({ 7: 'Cancelado' }))).toBeNull();
  });
});
