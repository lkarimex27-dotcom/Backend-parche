// Validador de comprobantes de transferencia (sin pasarela de pago): lo que sí se puede comprobar es que
// el valor cubra lo que se debe, que la referencia del banco no se haya usado en otro pedido y que la misma
// imagen no se reutilice. El administrador confirma el ingreso en el banco.
const crypto = require('crypto');

// Huella de la imagen: el mismo archivo da siempre la misma (detecta un comprobante reenviado)
const huella = (imagen) => crypto.createHash('sha256').update(String(imagen)).digest('hex');

// La referencia como la escribe cada quien ("M 123-456" = "m123456")
const normalizarReferencia = (r) => String(r ?? '').replace(/[\s.\-_]/g, '').toUpperCase();

// Lo que el cliente debe transferir ahora: el abono (50%) si aún no se validó, el saldo si ya se abonó, o el total
const valorEsperado = (p) => {
  const total = Number(p.total) || 0;
  const abono = Number(p.abono) || 0;
  if (!abono) return total;
  return p.estado_pago === 'Abonado' ? total - abono : abono;
};

// Un comprobante guardado: los viejos son solo la imagen (texto)
const comoSoporte = (x) => (typeof x === 'string' ? { imagen: x } : x || {});

// Mensaje de error, o null si pasa el validador. `otros`: comprobantes de los demás pedidos ({ id_pedido, referencia, hash })
const revisar = ({ pedido, referencia, valor, hash, otros, propios = [] }) => {
  const codigo = (id) => `PED-${String(id).padStart(4, '0')}`;
  if (propios.some((s) => s.hash === hash)) return 'Ya enviaste este mismo comprobante en este pedido.';
  const repetida = otros.find((o) => o.hash === hash);
  if (repetida) return `Este comprobante ya se usó en el pedido ${codigo(repetida.id_pedido)}.`;
  const ref = normalizarReferencia(referencia);
  if (ref) {
    const misma = otros.find((o) => o.referencia && normalizarReferencia(o.referencia) === ref);
    if (misma) return `La referencia ${referencia} ya se usó en el pedido ${codigo(misma.id_pedido)}.`;
  }
  const esperado = valorEsperado(pedido);
  if (valor != null && esperado > 0 && Number(valor) < esperado) {
    return `El valor transferido ($${Number(valor).toLocaleString('es-CO')}) no cubre lo que debes pagar ($${esperado.toLocaleString('es-CO')}).`;
  }
  return null;
};

module.exports = { huella, normalizarReferencia, valorEsperado, comoSoporte, revisar };
