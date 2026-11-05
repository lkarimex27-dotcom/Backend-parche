// Módulos del panel cuya lógica vive en la app: se guarda la fila completa (datos_panel) y, de ella,
// las columnas principales de cada tabla. `columnas(fila, idUsuario)` lee las posiciones de la fila del panel.
const { query } = require('./db');

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // AAAA-MM-DD
const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : hoy());
const num = (v) => Number(v) || 0;
const txt = (v, max = 150) => (v == null || v === '' ? null : String(v).slice(0, max));

const idPorNombre = async (nombre) =>
  nombre
    ? (await query('SELECT id_insumo_producto FROM insumos_productos WHERE lower(nombre) = lower($1) LIMIT 1', [nombre]))
      .rows[0]?.id_insumo_producto ?? null
    : null;

// Usuario del personal (no cliente) por su nombre: el vendedor de una venta
const idPersonal = async (nombre) =>
  nombre
    ? (await query(
      "SELECT p.id_usuario FROM personas p WHERE lower(p.nombre) = lower($1) AND p.id_usuario IS NOT NULL AND p.tipo IS DISTINCT FROM 'CLIENTE' LIMIT 1",
      [String(nombre)]
    )).rows[0]?.id_usuario ?? null
    : null;

const primerItem = (json) => {
  try {
    return JSON.parse(json || '[]')[0]?.name ?? null;
  } catch {
    return null;
  }
};

module.exports = {
  // [0 código, 1 vendedor, 2 cliente, 3 fecha, 4 tipo, 5 método de pago, 6 subtotal, 7 total, 8 estado, 9 pedido, ...]
  ventas: {
    tabla: 'ventas',
    id: 'id_venta',
    modulo: 'VENTAS',
    // Un pedido tiene una sola venta (posición 9 de la fila = pedido asociado)
    unico: { columna: 'pedido_asociado', posicion: 9, ignorar: ['', 'Sin pedido'], mensaje: 'Ese pedido ya tiene su venta registrada.' },
    // id_usuario = el vendedor elegido en el panel (si no es del personal, quien la registra); cambia al editar
    usuarioEditable: true,
    columnas: async (r, idUsuario) => ({
      id_usuario: (await idPersonal(r[1])) ?? idUsuario,
      codigo: txt(r[0], 30),
      cliente: txt(r[2]),
      fecha: fecha(r[3]),
      tipo_venta: txt(r[4], 30),
      metodo_pago: txt(r[5], 30),
      subtotal: num(r[6]),
      total: num(r[7]),
      estado: txt(r[8], 30) ?? 'REGISTRADA',
      pedido_asociado: txt(r[9], 30),
    }),
  },
  // [0 código, 1 productos, 2 cantidad, 3 prioridad, 4 fecha creación, 5 hora, 6-7 fecha/hora estado, 8 estado, ...]
  ordenes_produccion: {
    tabla: 'ordenes_produccion',
    id: 'id_orden_produccion',
    modulo: 'ORDENES_PRODUCCION',
    borrar: true,
    // Solo se elimina mientras no ha empezado (estado Recibida)
    borrarSi: { columna: 'estado', valor: 'Recibida', mensaje: 'Solo se puede eliminar una orden de producción en estado Recibida.' },
    columnas: (r) => ({
      numero_orden: txt(r[0], 50),
      productos: txt(r[1], 2000),
      cantidad: num(r[2]),
      prioridad: Math.trunc(num(r[3])),
      fecha_inicio: fecha(r[4]),
      estado: txt(r[8], 30) ?? 'Recibida',
    }),
  },
  // [0 código, 1 productos, 2 productos (JSON), 3 cantidad, 4 motivo, 5 fecha, 6 observación, 7 unidad, 8 estado]
  productos_no_conformes: {
    tabla: 'producto_no_conforme',
    id: 'id_producto_no_conforme',
    modulo: 'PRODUCTO_NO_CONFORME',
    columnas: async (r, idUsuario, relacionados = {}) => ({
      id_usuario: idUsuario,
      codigo: txt(r[0], 30),
      productos: txt(r[1], 2000),
      id_insumo_producto: await idPorNombre(primerItem(r[2])),
      cantidad: num(r[3]),
      motivo: txt(r[4]),
      fecha: fecha(r[5]),
      observacion: txt(r[6], 2000),
      medida: txt(r[7], 50),
      ...(Object.hasOwn(relacionados, 'id_orden_produccion')
        ? { id_orden_produccion: relacionados.id_orden_produccion }
        : {}),
      estado: txt(r[8], 30) ?? 'PENDIENTE',
    }),
  },
  // Pedidos creados en el panel: [0 código, 1 cliente, 2 productos, 3 tipo, 4 método de pago, 5 modalidad, 6 total,
  // 7 estado, 8 estado de pago, 9 autorización de producción, 10 líneas (JSON), 11 motivo de rechazo]
  // (los de la tienda van por /api/pedidos con su cliente y precios calculados en el servidor)
  pedidos_panel: {
    tabla: 'pedidos',
    id: 'id_pedido',
    modulo: 'PEDIDOS',
    columnas: (r) => ({
      codigo: txt(r[0], 30),
      nombre_contacto: txt(r[1]),
      observacion: txt(r[2], 2000),
      metodo_pago: txt(r[4], 30),
      subtotal: num(r[6]),
      total: num(r[6]),
      estado: txt(r[7], 30) ?? 'Recibido',
      estado_pago: txt(r[8], 40) ?? 'Pendiente',
      motivo_rechazo_pago: txt(r[11], 500),
    }),
  },
  // [0 código, 1 código de la venta, 2 cliente, 3 cliente (texto libre), 4 motivo, 5 fecha]
  devoluciones: {
    tabla: 'devoluciones',
    id: 'id_devolucion',
    modulo: 'DEVOLUCIONES',
    columnas: async (r, idUsuario) => ({
      id_usuario: idUsuario,
      codigo: txt(r[0], 30),
      codigo_venta: txt(r[1], 30),
      id_venta: r[1]
        ? (await query('SELECT id_venta FROM ventas WHERE codigo = $1 LIMIT 1', [String(r[1])])).rows[0]?.id_venta ?? null
        : null,
      // [2] cliente de la venta; [3] es el comentario de por qué se devuelve
      cliente: txt(r[2]),
      motivo: txt(r[4], 50),
      fecha: fecha(r[5]),
    }),
  },
};
