const bcrypt = require('bcryptjs');
const env = require('../config/env');
const Usuario = require('../models/usuario.model');
const { withTransaction } = require('../config/db');
const AppError = require('../errors/AppError');
const { enviarProvisional } = require('../utils/provisional');

const ROUNDS = 10;

const listar = (filtros) => Usuario.listar(filtros);

const obtener = async (id) => {
  const u = await Usuario.obtenerPorId(id);
  if (!u) throw AppError.notFound('Usuario no encontrado');
  return u;
};

const asegurarRoles = (ok) => {
  if (!ok) throw AppError.badRequest('Alguno de los roles indicados no existe');
};

const esSuperAdmin = (correo) => String(correo || '').trim().toLowerCase() === env.superAdminEmail;

const normalizarRol = (rol) =>
  rol.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();

const crear = async (d) => {
  const esCliente = d.roles.every((rol) => normalizarRol(rol) === 'CLIENTE');
  if (!esCliente && normalizarRol(d.tipo_documento || '') === 'TARJETA_DE_IDENTIDAD') {
    throw AppError.badRequest('La tarjeta de identidad solo está permitida para clientes.');
  }
  const rolTemporal = d.roles.find((rol) => normalizarRol(rol) !== 'CLIENTE');
  const contrasenaInicial = esCliente
    ? d.contrasena
    : rolTemporal && env.defaultPasswords[`DEFAULT_PASSWORD_${normalizarRol(rolTemporal)}`];
  if (!contrasenaInicial) {
    throw AppError.badRequest(
      esCliente
        ? 'La contraseña es obligatoria para las cuentas de cliente.'
        : `Configura DEFAULT_PASSWORD_${normalizarRol(rolTemporal || d.roles[0])} en el entorno del servidor.`
    );
  }
  if (!esCliente) {
    const configuredPasswords = Object.values(env.defaultPasswords).filter(Boolean);
    const isStrong =
      contrasenaInicial.length >= 8 &&
      contrasenaInicial.length <= 72 &&
      /[A-Z]/.test(contrasenaInicial) &&
      /[a-z]/.test(contrasenaInicial) &&
      /\d/.test(contrasenaInicial);
    if (!isStrong) {
      throw AppError.badRequest(
        'La contraseña temporal configurada para este rol debe cumplir la política de seguridad.'
      );
    }
    if (new Set(configuredPasswords).size !== configuredPasswords.length) {
      throw AppError.badRequest(
        'Configura una contraseña temporal diferente para cada rol de personal.'
      );
    }
  }
  const requiereCambioContrasena = !esCliente;
  const hash = await bcrypt.hash(contrasenaInicial, ROUNDS);
  const id = await withTransaction(async (c) => {
    const u = await Usuario.crearUsuario(c, {
      correo: d.correo,
      hash,
      estado: d.estado,
      requiereCambioContrasena,
      // Solo admin@minifood.com es superadministrador; cualquier otro administrador es normal
      esAdministradorPrincipal: esSuperAdmin(d.correo),
    });
    // Con rol Cliente es una persona tipo CLIENTE: así aparece también en el módulo Clientes
    await Usuario.crearPersona(c, { id_usuario: u.id_usuario, ...d, ...(esCliente ? { tipo: 'CLIENTE' } : {}) });
    asegurarRoles(await Usuario.reemplazarRoles(c, u.id_usuario, d.roles));
    if (requiereCambioContrasena) {
      await enviarProvisional({ para: d.correo, nombre: d.nombre, contrasena: contrasenaInicial });
    }
    return u.id_usuario;
  });
  return obtener(id);
};

const actualizar = async (id, d, idQuienEdita) => {
  if (id === idQuienEdita && d.estado === 'INACTIVO') throw AppError.badRequest('No puedes desactivar tu propio usuario');
  const usuario = await obtener(id);
  const roles = d.roles || usuario.roles || [];
  if (
    !roles.some((rol) => normalizarRol(rol) === 'CLIENTE') &&
    normalizarRol(d.tipo_documento || usuario.tipo_documento || '') === 'TARJETA_DE_IDENTIDAD'
  ) {
    throw AppError.badRequest('La tarjeta de identidad solo está permitida para clientes.');
  }
  if (usuario.es_administrador_principal) {
    const conservaRolAdministrador = !d.roles ||
      d.roles.some((rol) => normalizarRol(rol) === 'ADMINISTRADOR');
    if (!conservaRolAdministrador || d.estado === 'INACTIVO') {
      throw AppError.badRequest('El superadministrador no se puede desactivar ni quitar del rol Administrador.');
    }
    if (d.correo !== undefined && !esSuperAdmin(d.correo)) {
      throw AppError.badRequest(`El correo del superadministrador siempre es ${env.superAdminEmail}.`);
    }
  }

  await withTransaction(async (c) => {
    await Usuario.actualizarUsuario(c, id, { correo: d.correo, estado: d.estado });
    await Usuario.actualizarPersona(c, id, d);
    if (d.roles) asegurarRoles(await Usuario.reemplazarRoles(c, id, d.roles));
  });
  return obtener(id);
};

const eliminar = async (id, idQuienElimina) => {
  if (id === idQuienElimina) throw AppError.badRequest('No puedes eliminar tu propio usuario activo.');
  await withTransaction(async (c) => {
    const usuario = await Usuario.obtenerPorId(id, c);
    if (!usuario) throw AppError.notFound('Usuario no encontrado');
    if (usuario.es_administrador_principal) {
      throw AppError.badRequest('El superadministrador no se puede eliminar.');
    }
    const principal = await Usuario.obtenerAdministradorPrincipal(c);
    if (!principal) {
      throw AppError.badRequest('No existe el superadministrador para recibir los registros.');
    }
    await Usuario.reasignarRegistros(
      c,
      id,
      principal.id_usuario,
      usuario.nombre || '',
      principal.nombre || ''
    );
    if (!(await Usuario.eliminar(c, id))) throw AppError.notFound('Usuario no encontrado');
  });
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
