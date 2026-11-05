const { query } = require('../config/db');

const SELECT = `
  SELECT p.id_pedido, p.id_cliente, COALESCE(pe.nombre, p.nombre_contacto) AS cliente,
         u.correo, p.nombre_contacto, p.telefono_contacto, p.direccion_entrega,
         p.estado AS estado_pedido, p.creado_en
    FROM pedidos p
    LEFT JOIN usuarios u ON u.id_usuario = p.id_cliente
    LEFT JOIN personas pe ON pe.id_usuario = p.id_cliente`;

const listar = async () =>
  (await query(
    `${SELECT}
      WHERE p.direccion_entrega IS NOT NULL AND btrim(p.direccion_entrega) <> ''
      ORDER BY p.creado_en DESC`
  )).rows;

const obtenerPorPedido = async (id, c, bloquear = false) =>
  (await (c || { query }).query(
    `${SELECT}
      WHERE p.id_pedido = $1
        AND p.direccion_entrega IS NOT NULL AND btrim(p.direccion_entrega) <> ''
      ${bloquear ? 'FOR UPDATE OF p' : ''}`,
    [id]
  )).rows[0] || null;

const obtenerPedidoParaCrear = async (c, id) =>
  (await c.query(
    'SELECT id_pedido, id_cliente, direccion_entrega FROM pedidos WHERE id_pedido = $1 FOR UPDATE',
    [id]
  )).rows[0] || null;

const crear = async (c, id, d) =>
  c.query(
    `UPDATE pedidos SET nombre_contacto = COALESCE($2, nombre_contacto),
                        telefono_contacto = COALESCE($3, telefono_contacto),
                        direccion_entrega = $4
      WHERE id_pedido = $1`,
    [id, d.nombre_contacto ?? null, d.telefono_contacto ?? null, d.direccion_entrega]
  );

const actualizar = async (c, id, d) => {
  const columnas = {
    nombre_contacto: 'nombre_contacto',
    telefono_contacto: 'telefono_contacto',
    direccion_entrega: 'direccion_entrega',
  };
  const campos = Object.keys(columnas).filter((campo) => d[campo] !== undefined);
  return c.query(
    `UPDATE pedidos SET ${campos.map((campo, i) => `${columnas[campo]} = $${i + 2}`).join(', ')}
      WHERE id_pedido = $1`,
    [id, ...campos.map((campo) => d[campo])]
  );
};

const eliminar = (c, id) =>
  c.query(
    `UPDATE pedidos
        SET nombre_contacto = NULL, telefono_contacto = NULL, direccion_entrega = NULL
      WHERE id_pedido = $1`,
    [id]
  );

module.exports = { listar, obtenerPorPedido, obtenerPedidoParaCrear, crear, actualizar, eliminar };
