const { query } = require('../config/db');

// Consultas genéricas para los módulos de config/panel.modulos.js (tabla e id vienen de esa config, no del usuario)
const listar = async (cfg) =>
  (await query(
    `SELECT ${cfg.id} AS id, datos_panel FROM ${cfg.tabla} WHERE datos_panel IS NOT NULL ORDER BY ${cfg.id} DESC`
  )).rows;

const crear = async (cfg, columnas, fila) => {
  const keys = Object.keys(columnas);
  return (await query(
    `INSERT INTO ${cfg.tabla} (${keys.join(', ')}, datos_panel)
     VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}, $${keys.length + 1}) RETURNING ${cfg.id} AS id`,
    [...keys.map((k) => columnas[k]), JSON.stringify(fila)]
  )).rows[0].id;
};

const actualizar = async (cfg, id, columnas, fila) => {
  const keys = Object.keys(columnas);
  return (await query(
    `UPDATE ${cfg.tabla} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, datos_panel = $${keys.length + 2}
      WHERE ${cfg.id} = $1`,
    [id, ...keys.map((k) => columnas[k]), JSON.stringify(fila)]
  )).rowCount > 0;
};

const eliminar = async (cfg, id) =>
  (await query(`DELETE FROM ${cfg.tabla} WHERE ${cfg.id} = $1`, [id])).rowCount > 0;

module.exports = { listar, crear, actualizar, eliminar };
