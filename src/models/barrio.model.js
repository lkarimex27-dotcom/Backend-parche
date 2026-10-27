const { query } = require('../config/db');
const { ESTIMADOR } = require('../config/constants');

const listarDisponibles = async (busqueda) =>
  (await query(
    `SELECT id_barrio, nombre, municipio, departamento, es_cercano, tiempo_desplazamiento_minutos,
            costo_domicilio_cop::float AS costo_domicilio_cop
       FROM barrios
      WHERE activo = TRUE
        AND lower(municipio) = lower($1)
        AND lower(departamento) = lower($2)
        AND ($3::text IS NULL OR nombre ILIKE '%' || $3 || '%')
      ORDER BY lower(nombre), id_barrio`,
    [ESTIMADOR.MUNICIPIO, ESTIMADOR.DEPARTAMENTO, busqueda || null]
  )).rows;

const listarTodos = async () =>
  (await query(
    `SELECT id_barrio, nombre, municipio, departamento, activo, es_cercano, tiempo_desplazamiento_minutos,
            costo_domicilio_cop::float AS costo_domicilio_cop
       FROM barrios
      WHERE lower(municipio) = lower($1) AND lower(departamento) = lower($2)
      ORDER BY lower(nombre), id_barrio`,
    [ESTIMADOR.MUNICIPIO, ESTIMADOR.DEPARTAMENTO]
  )).rows;

const obtenerActivo = async (id, c, bloquear = false) =>
  (await (c || { query }).query(
    `SELECT id_barrio, nombre, municipio, departamento, activo, es_cercano, tiempo_desplazamiento_minutos,
            costo_domicilio_cop::float AS costo_domicilio_cop
       FROM barrios
      WHERE id_barrio = $1 AND activo = TRUE
        AND lower(municipio) = lower($2) AND lower(departamento) = lower($3)
      ${bloquear ? 'FOR SHARE' : ''}`,
    [id, ESTIMADOR.MUNICIPIO, ESTIMADOR.DEPARTAMENTO]
  )).rows[0] || null;

const crear = async (d) =>
  (await query(
    `INSERT INTO barrios (nombre, activo, es_cercano, tiempo_desplazamiento_minutos, costo_domicilio_cop)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_barrio, nombre, municipio, departamento, activo, es_cercano,
               tiempo_desplazamiento_minutos, costo_domicilio_cop::float AS costo_domicilio_cop`,
    [d.nombre, d.activo, d.es_cercano, d.tiempo_desplazamiento_minutos, d.costo_domicilio_cop]
  )).rows[0];

const actualizar = async (id, d) => {
  const campos = ['nombre', 'activo', 'es_cercano', 'tiempo_desplazamiento_minutos', 'costo_domicilio_cop']
    .filter((campo) => d[campo] !== undefined);
  const valores = campos.map((campo) => d[campo]);
  return (await query(
    `UPDATE barrios SET ${campos.map((campo, i) => `${campo} = $${i + 2}`).join(', ')}
      WHERE id_barrio = $1
        AND lower(municipio) = lower($${campos.length + 2})
        AND lower(departamento) = lower($${campos.length + 3})
      RETURNING id_barrio, nombre, municipio, departamento, activo, es_cercano,
                tiempo_desplazamiento_minutos, costo_domicilio_cop::float AS costo_domicilio_cop`,
    [id, ...valores, ESTIMADOR.MUNICIPIO, ESTIMADOR.DEPARTAMENTO]
  )).rows[0] || null;
};

const desactivar = async (id) =>
  (await query(
    `UPDATE barrios SET activo = FALSE
      WHERE id_barrio = $1
        AND lower(municipio) = lower($2)
        AND lower(departamento) = lower($3)
      RETURNING id_barrio`,
    [id, ESTIMADOR.MUNICIPIO, ESTIMADOR.DEPARTAMENTO]
  )).rows[0] || null;

module.exports = { listarDisponibles, listarTodos, obtenerActivo, crear, actualizar, desactivar };
