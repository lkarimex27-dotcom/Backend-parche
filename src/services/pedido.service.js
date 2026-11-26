const Pedido = require('../models/pedido.model');
const InsumoProducto = require('../models/insumoProducto.model');
const Barrio = require('../models/barrio.model');
const { withTransaction } = require('../../config/db');
const { PEDIDO_MONTO_APROBACION } = require('../../config/constants');
const AppError = require('../errors/AppError');
const Estimador = require('./estimador.service');
const VentaPedido = require('./ventaPedido.service');
const Eventos = require('./pedidoEventos.service');
const Correos = require('./pedidoCorreos.service');
const Soporte = require('../utils/soportePago');

const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const listar = () => Pedido.listar();
// El cliente ve los cambios de su pedido, pero no quién del equipo los hizo
const listarMios = async (idCliente) =>
  (await Pedido.listarDeCliente(idCliente)).map((p) => ({ ...p, historial: p.historial.map(({ estado, fecha }) => ({ estado, fecha })) }));

// Cambios de pago en el historial (la columna admite 30 caracteres)
const PAGO_EN_HISTORIAL = {
  Pagado: 'Pago recibido',
  Rechazado: 'Pago rechazado',
  'Pendiente de verificación': 'Pago por verificar',
  Pendiente: 'Pago pendiente',
};

const obtener = async (id, c) => {
  const p = await Pedido.obtenerPorId(id, c);
  if (!p) throw AppError.notFound('Pedido no encontrado');
  return p;
};

// Calcula precios con el menú de la base (el navegador solo dice qué y cuánto pide).
// Las bebidas llegan como adición "Gaseosa <sabor> (<tamaño>)": cada una es un producto de la categoría
// «Bebidas» y cuesta lo que vale ese producto. `gaseosas` = cuáles están agotadas (por su stock comprado).
const cotizar = (items, catalogo, gaseosas = []) => {
  const buscar = (nombre, categorias, incluir = true) =>
    catalogo.find((p) => normalizar(p.nombre) === normalizar(nombre) && categorias.includes(p.categoria) === incluir);
  const EXTRAS = ['Adiciones', 'Salsas', 'Bebidas'];

  return items.map((it) => {
    // Las hamburguesas antes se llamaban solo "Sencilla", "Doble"...: un carrito viejo aún puede traer ese nombre
    const producto = buscar(it.producto, EXTRAS, false) || buscar(`Hamburguesa ${it.producto}`, ['Hamburguesas']);
    if (!producto) throw AppError.badRequest(`El producto «${it.producto}» no está disponible`);
    for (const s of it.salsas) {
      if (!buscar(s, ['Salsas'])) throw AppError.badRequest(`La salsa «${s}» no está disponible`);
    }
    const adiciones = it.adiciones.map((a) => {
      const esGaseosa = /^Gaseosa .+ \(.+\)$/.test(a.nombre);
      const extra = buscar(a.nombre, [esGaseosa ? 'Bebidas' : 'Adiciones']);
      // `gaseosas` trae también las adiciones: las dos llevan stock comprado
      const agotada = gaseosas.some((g) => g.agotada && normalizar(g.nombre) === normalizar(a.nombre));
      if (!extra || agotada) throw AppError.badRequest(`La adición «${a.nombre}» no está disponible`);
      return { nombre: a.nombre, cantidad: a.cantidad, precio: extra.precio };
    });
    // No more of each soda or addition than its stock (counting it across every line of the order)
    for (const a of adiciones) {
      const g = gaseosas.find((x) => normalizar(x.nombre) === normalizar(a.nombre));
      const pedidas = items.reduce((s, o) => s + o.cantidad * o.adiciones
        .filter((x) => normalizar(x.nombre) === normalizar(a.nombre)).reduce((t, x) => t + x.cantidad, 0), 0);
      if (g && g.stock != null && pedidas > g.stock)
        throw AppError.badRequest(`Solo quedan ${g.stock} de «${a.nombre}». Pediste ${pedidas}.`);
    }
    const unitario = producto.precio + adiciones.reduce((s, a) => s + a.cantidad * a.precio, 0);
    return {
      id_insumo_producto: producto.id_insumo_producto,
      producto: producto.nombre,
      categoria: producto.categoria,
      cantidad: it.cantidad,
      precio_unitario: producto.precio,
      subtotal: unitario * it.cantidad,
      detalle: { salsas: it.salsas, adiciones, ...(it.nota ? { nota: it.nota } : {}) },
    };
  });
};

// Con el inventario (menos lo que apartan los pedidos abiertos) se tienen que poder preparar todos los productos
// con ficha técnica; si no, dice cuántos de ese producto se alcanzan a preparar
const revisarStock = async (c, lineas, excluirPedido = 0) => {
  const receta = await Pedido.insumosParaPreparar(c, [...new Set(lineas.map((l) => l.id_insumo_producto))], excluirPedido);
  if (!receta?.length) return;
  const cuantos = (producto) => lineas.filter((l) => l.id_insumo_producto === producto).reduce((s, l) => s + l.cantidad, 0);
  for (const r of receta) {
    const libre = r.stock - r.apartado;
    const pide = receta.filter((x) => x.insumo === r.insumo).reduce((s, x) => s + x.necesita * cuantos(x.producto), 0);
    if (r.necesita <= 0 || !cuantos(r.producto) || pide <= libre + 1e-9) continue;
    const otros = pide - r.necesita * cuantos(r.producto);
    const max = Math.max(0, Math.floor((libre - otros) / r.necesita + 1e-9));
    const nombre = lineas.find((l) => l.id_insumo_producto === r.producto).producto;
    throw AppError.badRequest(max > 0
      ? `Por ahora solo podemos preparar ${max} de «${nombre}» (no alcanza el insumo «${r.nombre}»). Pide menos o elige otro producto.`
      : `«${nombre}» se agotó por ahora: no alcanza el insumo «${r.nombre}». Quítalo del pedido o elige otro producto.`);
  }
};

const crear = async (d, idCliente) => {
  const lineas = cotizar(d.items, await Pedido.catalogoActivo(), await InsumoProducto.gaseosas());
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const id = await withTransaction(async (c) => {
    await revisarStock(c, lineas);
    const tipoEntrega = d.tipo_entrega ?? 'domicilio';
    const esDomicilio = tipoEntrega === 'domicilio';
    const { idBarrio, estimacion: estimacionInicial } = await Estimador.calcular(
      esDomicilio ? d.id_barrio ?? d.nombre_barrio : undefined,
      c,
      d.distancia_km,
      tipoEntrega,
      d.items,
      d.ubicacion,
    );
    const costoDomicilio = esDomicilio ? estimacionInicial.deliveryCost : 0;
    if (esDomicilio && costoDomicilio === null) {
      throw AppError.conflict('No se pudo calcular el domicilio. Costo de domicilio por confirmar para este barrio.');
    }
    const total = subtotal + costoDomicilio;
    // $150.000 o más: lo confirma El Parche y se abona el 50% por transferencia (con comprobante); el saldo al recibir
    const conAbono = total >= PEDIDO_MONTO_APROBACION;
    // Mixto: lo transferido queda como «abono» (lo revisa el validador) y el resto se cobra en efectivo al recibir
    const mixto = d.pago_mixto?.transferencia;
    if (mixto && mixto >= total) throw AppError.badRequest('En el pago mixto, la transferencia debe ser menor que el total: el resto se paga en efectivo.');
    if (mixto && conAbono && mixto < Math.ceil(total / 2)) {
      throw AppError.badRequest(`En pedidos de $${PEDIDO_MONTO_APROBACION.toLocaleString('es-CO')} o más, la transferencia debe ser al menos la mitad ($${Math.ceil(total / 2).toLocaleString('es-CO')}).`);
    }
    const abono = mixto || (conAbono ? Math.ceil(total / 2) : null);
    if (conAbono && (d.pago === 'Efectivo' || !d.comprobante)) {
      throw AppError.badRequest('Los pedidos de $150.000 o más se confirman con un abono del 50% por transferencia: sube el comprobante.');
    }
    const estado = conAbono ? 'Por confirmar' : 'Recibido';
    // Validador del comprobante: cubre lo que se debe, su referencia y su imagen no se usaron en otro pedido
    let soporte = null;
    if (d.comprobante) {
      soporte = { referencia: d.referencia_pago, valor: d.valor_pago, hash: Soporte.huella(d.comprobante), dudoso: !!d.comprobante_dudoso };
      const error = Soporte.revisar({
        pedido: { total, abono, estado_pago: 'Pendiente de verificación' },
        ...soporte, otros: await Pedido.soportesDeOtros(c, 0),
      });
      if (error) throw AppError.badRequest(error);
    }
    const idPedido = await Pedido.crear(c, {
      ...d,
      tipo_entrega: tipoEntrega,
      id_barrio: esDomicilio ? idBarrio : null,
      id_cliente: idCliente,
      subtotal,
      costo_domicilio_cop: costoDomicilio,
      total,
      estado,
      estimacion_inicial: estimacionInicial,
      estado_pago: d.pago === 'Efectivo' ? 'Pendiente' : 'Pendiente de verificación',
      abono,
      pago_mixto: !!mixto,
      soporte,
    });
    for (const l of lineas) await Pedido.crearDetalle(c, idPedido, l);
    // La orden de producción no nace aquí: el panel la crea cuando el pedido pasa a «Confirmado»
    await Pedido.registrarEstado(c, idPedido, estado, idCliente);
    return idPedido;
  });
  return obtener(id);
};

// Solo el panel: cambia los productos mientras la orden de producción no entra a cocina (Recibido o Confirmado). Recalcula el total y, si el
// cliente ya había pagado, `abono` guarda lo recibido: el pago queda «Abonado» (falta cobrar la diferencia) o
// «Pagado» (si sobra, `diferencia` < 0 = lo que hay que devolverle). La venta del pedido sigue el nuevo total.
const fmtPesos = (n) => `$${Math.abs(n).toLocaleString('es-CO')}`;
const cambiarProductos = async (id, items, idUsuario) => {
  let pagado = 0;
  let diferencia = 0;
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    if (!['Por confirmar', 'Recibido', 'Confirmado'].includes(p.estado) || (p.estado_produccion && !['Recibido', 'Confirmado'].includes(p.estado_produccion)))
      throw AppError.conflict('Los productos solo se cambian antes de que la orden de producción entre a cocina.');
    const lineas = cotizar(items, await Pedido.catalogoActivo(), await InsumoProducto.gaseosas());
    await revisarStock(c, lineas, p.id_pedido);
    const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
    const total = subtotal + (Number(p.costo_domicilio_cop) || 0);
    pagado = p.estado_pago === 'Pagado' ? Math.max(Number(p.total) || 0, Number(p.abono) || 0)
      : p.estado_pago === 'Abonado' ? Number(p.abono) || Math.ceil((Number(p.total) || 0) / 2) : 0;
    diferencia = pagado ? total - pagado : 0;
    const estadoPago = pagado ? (total > pagado ? 'Abonado' : 'Pagado') : p.estado_pago;
    await Pedido.reemplazarDetalle(c, p.id_pedido, lineas);
    await Pedido.actualizar(c, p.id_pedido, { subtotal, total, ...(pagado ? { estado_pago: estadoPago, abono: pagado } : {}) });
    const nota = diferencia > 0 ? `Productos: cobrar ${fmtPesos(diferencia)}` : diferencia < 0 ? `Productos: devolver ${fmtPesos(diferencia)}` : 'Productos cambiados';
    await Pedido.registrarEstado(c, p.id_pedido, nota.slice(0, 30), idUsuario);
    const nuevo = await obtener(id, c);
    if (estadoPago === 'Pagado' && p.estado_pago !== 'Pagado') await VentaPedido.asegurarVenta(c, nuevo, idUsuario);
    else await VentaPedido.actualizarVenta(c, nuevo);
  });
  return { ...(await obtener(id)), pagado, diferencia };
};

// La orden de producción de un pedido cambió de estado (en la misma transacción): el pedido y su venta pasan al mismo
const seguirProduccion = async (c, codigo, estado, idUsuario) => {
  const n = /^PED-0*(\d+)$/i.exec(String(codigo || '').trim());
  if (!n || typeof estado !== 'string') return null;
  const r = await Pedido.actualizarEstadoProduccion(c, Number(n[1]), estado, idUsuario, String(codigo).trim());
  if (r && r.estado !== r.estado_anterior) await VentaPedido.reflejarEstado(c, r.id_pedido, r.estado, r.codigo);
  return r;
};
// Ya guardado: los paneles abiertos recargan pedidos y ventas, y el cliente ve el cambio (y su correo si aplica)
const avisarSeguimiento = async (r) => {
  if (!r) return;
  Eventos.publicarCambioPanel('pedidos');
  if (r.id_cliente == null) return;
  Eventos.publicarEstadoProduccion({ idCliente: r.id_cliente, idPedido: r.id_pedido, estado: r.estado, estado_produccion: r.estado_produccion });
  if (r.estado_anterior && r.estado !== r.estado_anterior) {
    const pedido = await Pedido.obtenerPorId(r.id_pedido).catch(() => null);
    if (pedido) Correos.avisarCambio(r.estado_anterior, pedido);
  }
};

// El cliente envía otro comprobante (puede mandar varios: el abono y el saldo, o uno nuevo si le rechazaron el anterior).
// Se guardan todos; si se lo habían rechazado, vuelve a revisión.
const MAX_COMPROBANTES = 5;
const subirComprobante = async (id, { comprobante, referencia, valor, dudoso }, idCliente) => {
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    if (p.id_cliente !== idCliente) throw AppError.notFound('Pedido no encontrado');
    if (p.estado_pago === 'Pagado' || ['Cancelado', 'Entregado'].includes(p.estado))
      throw AppError.conflict('Este pedido ya no recibe comprobantes.');
    if ((p.comprobantes?.length ?? 0) >= MAX_COMPROBANTES)
      throw AppError.conflict(`Ya enviaste ${MAX_COMPROBANTES} comprobantes; quita uno o escríbenos.`);
    const hash = Soporte.huella(comprobante);
    const error = Soporte.revisar({
      pedido: p, referencia, valor, hash, otros: await Pedido.soportesDeOtros(c, p.id_pedido),
      propios: (p.comprobantes || []).map(Soporte.comoSoporte).map((s) => ({ hash: s.hash || Soporte.huella(s.imagen) })),
    });
    if (error) throw AppError.badRequest(error);
    await Pedido.agregarComprobante(c, id, { imagen: comprobante, referencia, valor, hash, dudoso: !!dudoso });
    if (p.estado_pago === 'Rechazado')
      await Pedido.actualizar(c, id, { estado_pago: 'Pendiente de verificación', motivo_rechazo_pago: null });
  });
  return obtener(id);
};

// Panel: cambia estado, pago y autorización de producción (deja historial si cambia el estado).
// Al quedar «Pagado» se crea su venta (una sola), y la venta sigue el estado del pedido.
const actualizar = async (id, d, idUsuario) => {
  let antes;
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    antes = p.estado;
    // Entregado y Cancelado son finales; el pago sí puede cambiar después (contraentrega)
    if (d.estado && d.estado !== p.estado && ['Entregado', 'Cancelado'].includes(p.estado)) {
      throw AppError.conflict(`El pedido ya está ${p.estado}; no se puede cambiar su estado.`);
    }
    await Pedido.actualizar(c, id, d);
    if (d.estado && d.estado !== p.estado) {
      await Pedido.registrarEstado(c, id, d.estado, idUsuario);
      await VentaPedido.reflejarEstado(c, id, d.estado);
    }
    if (d.estado_pago && d.estado_pago !== p.estado_pago && PAGO_EN_HISTORIAL[d.estado_pago]) {
      await Pedido.registrarEstado(c, id, PAGO_EN_HISTORIAL[d.estado_pago], idUsuario);
    }
    if (d.estado_pago === 'Pagado' && p.estado_pago !== 'Pagado') {
      await VentaPedido.asegurarVenta(c, await obtener(id, c), idUsuario);
    }
  });
  const pedido = await obtener(id);
  // Correo al cliente: «ya está en proceso» y «va en camino» (o «listo para recoger»)
  Correos.avisarCambio(antes, pedido);
  // Avisa al cliente para que su detalle del pedido se actualice sin recargar
  Eventos.publicarEstadoProduccion({
    idCliente: pedido.id_cliente, idPedido: pedido.id_pedido, estado: pedido.estado, estado_produccion: pedido.estado_produccion,
  });
  return pedido;
};

// El cliente quita un comprobante que subió por error, mientras nadie lo haya aprobado
const quitarComprobante = async (id, indice, idCliente) => {
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    if (p.id_cliente !== idCliente) throw AppError.notFound('Pedido no encontrado');
    if (['Abonado', 'Pagado'].includes(p.estado_pago) || ['Cancelado', 'Entregado'].includes(p.estado))
      throw AppError.conflict('Este comprobante ya se revisó; no se puede quitar.');
    if (indice >= (p.comprobantes?.length ?? 0)) throw AppError.notFound('Comprobante no encontrado');
    const quedan = await Pedido.quitarComprobante(c, id, indice);
    if (!quedan && p.estado_pago === 'Pendiente de verificación') await Pedido.actualizar(c, id, { estado_pago: 'Pendiente' });
  });
  return obtener(id);
};

// El cliente pide la devolución de un pedido entregado, hasta 24 h después de hacerlo; el personal la registra en Devoluciones
const PLAZO_DEVOLUCION_MS = 24 * 60 * 60 * 1000;
const solicitarDevolucion = async (id, { motivo }, idCliente, ahora = Date.now()) => {
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    if (p.id_cliente !== idCliente) throw AppError.notFound('Pedido no encontrado');
    if (p.devolucion) throw AppError.conflict('Ya pediste la devolución de este pedido.');
    if (p.estado !== 'Entregado') throw AppError.conflict('Puedes pedir la devolución cuando el pedido esté entregado.');
    if (ahora - new Date(p.creado_en).getTime() > PLAZO_DEVOLUCION_MS)
      throw AppError.conflict('Ya pasaron más de 24 horas desde que hiciste el pedido; no se puede pedir la devolución.');
    await Pedido.solicitarDevolucion(c, id, motivo);
  });
  return obtener(id);
};

module.exports = { listar, listarMios, obtener, crear, cambiarProductos, seguirProduccion, avisarSeguimiento, subirComprobante, quitarComprobante, solicitarDevolucion, actualizar, cotizar };
