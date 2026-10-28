const modulos = require('../config/panel.modulos');
const Panel = require('../models/panel.model');

// La venta de un pedido de la tienda la crea el servidor cuando el pedido queda «Pagado» (una sola por pedido).
// Antes la creaba el panel en el navegador: si el pago se marcaba desde otro lugar o se repetía, quedaban pedidos
// pagados sin venta o con dos ventas.

// El mismo código que muestra la app (PED-0005): un solo formato para pedidos de la tienda y del panel
const codigoPedido = (id) => `PED-${String(id).padStart(4, '0')}`;
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const tipoVenta = (direccion) =>
  /^consumo en el local$/i.test(direccion || '') ? 'Local' : /^recoger en el local$/i.test(direccion || '') ? 'Para recoger' : 'Domicilio';
const anulada = "upper(coalesce(estado, '')) IN ('ANULADA', 'ANULADO')";

// Líneas como las guarda el panel: cada producto y, debajo, sus adiciones y gaseosas (parentId = su producto)
const lineas = async (c, pedido) => {
  const categorias = new Map(
    (await c.query(
      `SELECT lower(i.nombre) AS nombre, ca.nombre_categoria AS categoria
         FROM insumos_productos i LEFT JOIN categorias ca ON ca.id_categoria = i.id_categoria
        WHERE i.tipo = 'PRODUCTO'`
    )).rows.map((r) => [r.nombre, r.categoria || ''])
  );
  const categoria = (nombre) => categorias.get(String(nombre).toLowerCase()) ?? '';
  return pedido.items.flatMap((it, i) => {
    const id = `${codigoPedido(pedido.id_pedido)}-line-${i}`;
    const detalle = it.detalle || {};
    return [
      {
        id, product: it.producto, category: categoria(it.producto), quantity: it.cantidad, unitPrice: it.precio_unitario,
        ...(detalle.salsas?.length ? { sauces: detalle.salsas } : {}),
      },
      ...(detalle.adiciones || []).map((a, j) => ({
        id: `${id}-addition-${j}`, product: a.nombre, category: categoria(a.nombre),
        quantity: a.cantidad * it.cantidad, unitPrice: a.precio, parentId: id,
      })),
    ];
  });
};

// Crea la venta del pedido si no tiene una vigente. Devuelve su id, o null si ya existía.
const asegurarVenta = async (c, pedido, idUsuario) => {
  const pedidoCodigo = codigoPedido(pedido.id_pedido);
  // Dos pagos marcados a la vez esperan uno al otro: así nunca salen dos ventas
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`venta:${pedidoCodigo}`]);
  const yaTiene = await c.query(`SELECT 1 FROM ventas WHERE pedido_asociado = $1 AND NOT (${anulada}) LIMIT 1`, [pedidoCodigo]);
  if (yaTiene.rowCount) return null;

  const numeros = (await c.query("SELECT codigo FROM ventas WHERE codigo ~ '^VTA-AUTO-[0-9]+$'")).rows
    .map((r) => Number(r.codigo.slice('VTA-AUTO-'.length)));
  const codigo = `VTA-AUTO-${String(Math.max(0, ...numeros) + 1).padStart(2, '0')}`;
  const vendedor = (await c.query('SELECT nombre FROM personas WHERE id_usuario = $1 LIMIT 1', [idUsuario])).rows[0]?.nombre || 'Administrador';
  const total = Number(pedido.total) || 0;

  // [0 código, 1 vendedor, 2 cliente, 3 fecha, 4 tipo, 5 método, 6 subtotal, 7 total, 8 estado, 9 pedido,
  //  10 estado del pedido, 11 productos (JSON)] — las mismas columnas de una venta hecha en el panel
  const fila = [
    codigo, vendedor, pedido.cliente || pedido.nombre_contacto || '', hoy(), tipoVenta(pedido.direccion_entrega),
    pedido.metodo_pago === 'Efectivo' ? 'Efectivo' : 'Transferencia', total, total, '', pedidoCodigo, pedido.estado,
    JSON.stringify(await lineas(c, pedido)),
  ];
  const cfg = modulos.ventas;
  return Panel.crearConCliente(c, cfg, await cfg.columnas(fila, idUsuario), fila);
};

// La venta muestra el estado del pedido: cuando el pedido avanza, su venta también
const reflejarEstado = (c, idPedido, estado) =>
  c.query(
    `UPDATE ventas SET datos_panel = jsonb_set(datos_panel, '{10}', to_jsonb($2::text), true)
      WHERE pedido_asociado = $1 AND datos_panel IS NOT NULL AND NOT (${anulada})`,
    [codigoPedido(idPedido), estado]
  );

module.exports = { asegurarVenta, reflejarEstado, codigoPedido };
