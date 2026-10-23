const Pedido = require('../models/pedido.model');
const InsumoProducto = require('../models/insumoProducto.model');
const { withTransaction } = require('../config/db');
const { PEDIDO_MONTO_APROBACION } = require('../config/constants');
const AppError = require('../errors/AppError');

const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const listar = () => Pedido.listar();
const listarMios = (idCliente) => Pedido.listarDeCliente(idCliente);

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
      const agotada = esGaseosa && gaseosas.some((g) => g.agotada && normalizar(g.nombre) === normalizar(a.nombre));
      if (!extra || agotada) throw AppError.badRequest(`La adición «${a.nombre}» no está disponible`);
      return { nombre: a.nombre, cantidad: a.cantidad, precio: extra.precio };
    });
    const unitario = producto.precio + adiciones.reduce((s, a) => s + a.cantidad * a.precio, 0);
    return {
      id_insumo_producto: producto.id_insumo_producto,
      cantidad: it.cantidad,
      precio_unitario: producto.precio,
      subtotal: unitario * it.cantidad,
      detalle: { salsas: it.salsas, adiciones },
    };
  });
};

const crear = async (d, idCliente) => {
  const lineas = cotizar(d.items, await Pedido.catalogoActivo(), await InsumoProducto.gaseosas());
  const total = lineas.reduce((s, l) => s + l.subtotal, 0);
  const estado = total >= PEDIDO_MONTO_APROBACION ? 'Por confirmar' : 'Recibido';
  const id = await withTransaction(async (c) => {
    const idPedido = await Pedido.crear(c, {
      ...d, id_cliente: idCliente, total, estado,
      estado_pago: d.pago === 'Efectivo' ? 'Pendiente' : 'Pendiente de verificación',
    });
    for (const l of lineas) await Pedido.crearDetalle(c, idPedido, l);
    await Pedido.registrarEstado(c, idPedido, estado, idCliente);
    return idPedido;
  });
  return obtener(id);
};

// El cliente sube (o cambia) el comprobante; si se lo habían rechazado, vuelve a revisión
const subirComprobante = async (id, comprobante, idCliente) => {
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    if (p.id_cliente !== idCliente) throw AppError.notFound('Pedido no encontrado');
    await Pedido.actualizar(c, id, {
      comprobante,
      ...(p.estado_pago === 'Rechazado' && { estado_pago: 'Pendiente de verificación', motivo_rechazo_pago: null }),
    });
  });
  return obtener(id);
};

// Panel: cambia estado, pago y autorización de producción (deja historial si cambia el estado)
const actualizar = async (id, d, idUsuario) => {
  await withTransaction(async (c) => {
    const p = await obtener(id, c);
    await Pedido.actualizar(c, id, d);
    if (d.estado && d.estado !== p.estado) await Pedido.registrarEstado(c, id, d.estado, idUsuario);
  });
  return obtener(id);
};

module.exports = { listar, listarMios, obtener, crear, subirComprobante, actualizar, cotizar };
