const Rol = require('../models/rol.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');
const { enviarCorreo } = require('../utils/mailer');

const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Avisa a los usuarios del rol que cambió su estado. Un fallo del correo no revierte el cambio.
const avisarCambioEstado = async (rol) => {
  try {
    const usuarios = await Rol.correosDeUsuarios(rol.id_rol);
    const resultados = await Promise.allSettled(usuarios.map((u) => enviarCorreo({
      para: u.correo,
      asunto: `Tu rol ${rol.nombre_rol} ahora está ${rol.estado === 'ACTIVO' ? 'activo' : 'inactivo'}`,
      html: `<p>Hola ${escapar(u.nombre || '')},</p><p>El rol <b>${escapar(rol.nombre_rol)}</b> que tienes asignado quedó <b>${rol.estado === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO'}</b>. ${rol.estado === 'ACTIVO' ? 'Ya puedes usar los módulos de ese rol.' : 'Mientras siga inactivo no tendrás los permisos de ese rol.'}</p>`,
    })));
    const fallidos = resultados.filter((r) => r.status === 'rejected').length;
    if (fallidos) console.error(`Rol ${rol.id_rol}: no se pudo avisar a ${fallidos} usuario(s) del cambio de estado.`);
  } catch (error) {
    console.error(`Rol ${rol.id_rol}: falló el aviso del cambio de estado.`, error.message);
  }
};

const listar = () => Rol.listar();
const catalogo = async () => ({ modulos: await Rol.listarModulos(), privilegios: await Rol.listarPrivilegios() });

const obtener = async (id) => {
  const r = await Rol.obtenerPorId(id);
  if (!r) throw AppError.notFound('Rol no encontrado');
  return { ...r, permisos: await Rol.permisosDeRol(id) };
};

const crear = (d) => Rol.crear(d);

const actualizar = async (id, d) => {
  const antes = await Rol.obtenerPorId(id);
  const r = await Rol.actualizar(id, d);
  if (!r) throw AppError.notFound('Rol no encontrado');
  if (antes && r.estado !== antes.estado) await avisarCambioEstado(r);
  return r;
};

const eliminar = async (id) => {
  const r = await Rol.obtenerPorId(id);
  if (!r) throw AppError.notFound('Rol no encontrado');
  if (r.estado !== 'INACTIVO') throw AppError.conflict('Solo se puede eliminar un rol inactivo. Desactívalo primero.');
  const n = await Rol.contarUsuarios(id);
  if (n) throw AppError.conflict(`El rol tiene usuarios asociados (${n}); quítales el rol antes de eliminarlo.`);
  await withTransaction((c) => Rol.eliminar(c, id));
};

const reemplazarPermisos = async (id, { permisos }) => {
  await obtener(id);
  await withTransaction(async (c) => {
    if (!(await Rol.reemplazarPermisos(c, id, permisos))) {
      throw AppError.badRequest('Algún módulo o privilegio indicado no existe (revisa GET /api/roles/catalogo)');
    }
  });
  return obtener(id);
};

module.exports = { listar, catalogo, obtener, crear, actualizar, eliminar, reemplazarPermisos };
