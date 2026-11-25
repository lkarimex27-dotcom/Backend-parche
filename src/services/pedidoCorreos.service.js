const { enviarCorreo } = require('../utils/mailer');
const { plantilla, parrafo, lista, escapar, urlApp } = require('../utils/plantillaCorreo');

const EN_PROCESO = ['Confirmado', 'En cocina'];
const AVANZADOS = [...EN_PROCESO, 'En camino', 'Entregado'];

// Qué correo le toca al cliente cuando su pedido pasa de `antes` a `ahora` (null = ninguno).
// «En proceso» se avisa una sola vez (al confirmarlo o al entrar a cocina, lo que pase primero).
const avisoDe = (antes, ahora) => {
  if (antes === ahora) return null;
  if (EN_PROCESO.includes(ahora) && !AVANZADOS.includes(antes)) return 'proceso';
  if (ahora === 'En camino') return 'camino';
  return null;
};

const codigo = (p) => `PED-${String(p.id_pedido).padStart(4, '0')}`;

const correoDe = (tipo, p) => {
  const recoger = p.tipo_entrega === 'recoger';
  const productos = (p.items || []).map((i) => `${escapar(i.cantidad)} × ${escapar(i.producto)}`);
  if (tipo === 'proceso')
    return {
      asunto: `Tu pedido ${codigo(p)} ya está en proceso`,
      titulo: 'Tu pedido ya está en proceso',
      contenido:
        parrafo(`¡Hola${p.cliente ? ` ${escapar(p.cliente)}` : ''}! Confirmamos tu pedido <strong>${codigo(p)}</strong> y ya lo estamos preparando en la cocina.`) +
        (productos.length ? lista(productos) : '') +
        parrafo(recoger ? 'Te avisaremos cuando esté listo para recoger.' : 'Te avisaremos cuando salga para tu dirección.'),
    };
  return {
    asunto: recoger ? `Tu pedido ${codigo(p)} está listo para recoger` : `Tu pedido ${codigo(p)} va en camino`,
    titulo: recoger ? 'Tu pedido está listo' : 'Tu pedido va en camino',
    contenido: recoger
      ? parrafo(`Tu pedido <strong>${codigo(p)}</strong> está listo. Puedes pasar a recogerlo cuando quieras.`)
      : parrafo(`Tu pedido <strong>${codigo(p)}</strong> acaba de salir hacia ${p.direccion_entrega ? `<strong>${escapar(p.direccion_entrega)}</strong>` : 'tu dirección'}. ¡Ya casi llega!`) +
        (p.estado_pago !== 'Pagado' && p.total ? parrafo(`Ten a mano el pago pendiente${p.abono ? ` (saldo de $${Math.round(p.total - p.abono).toLocaleString('es-CO')})` : ''}.`) : ''),
  };
};

// Se envía sin frenar el cambio de estado: si el correo falla, el pedido igual queda actualizado
const avisarCambio = (antes, pedido) => {
  const tipo = avisoDe(antes, pedido.estado);
  if (!tipo || !pedido.correo) return Promise.resolve(false);
  const m = correoDe(tipo, pedido);
  return enviarCorreo({
    para: pedido.correo,
    asunto: m.asunto,
    html: plantilla({ titulo: m.titulo, hero: 'confirmacion', contenido: m.contenido, boton: { texto: 'Ver mi pedido', url: urlApp() } }),
  })
    .then(() => true)
    .catch((e) => {
      console.warn(`No se pudo enviar el correo del pedido ${codigo(pedido)}:`, e.message);
      return false;
    });
};

module.exports = { avisoDe, avisarCambio, correoDe };
