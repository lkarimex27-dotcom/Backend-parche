const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../errors/AppError');
const Permiso = require('../models/permiso.model');

// Exige un token válido:  Authorization: Bearer <token>
const authenticate = (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(AppError.unauthorized('Falta el token de acceso'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: Number(payload.sub), correo: payload.correo };
    return next();
  } catch (_e) {
    return next(AppError.unauthorized('Token inválido o vencido'));
  }
};

// Exige que algún rol del usuario tenga el privilegio en el módulo.
// Se consulta la BD en cada petición: si cambias permisos o desactivas a alguien, aplica de inmediato.
// Uso: router.post('/', authorize('COMPRAS', 'CREAR'), controller)
const authorize = (modulo, privilegio) => async (req, _res, next) => {
  try {
    const ok = await Permiso.tienePermiso(req.user.id, modulo, privilegio);
    if (!ok) throw AppError.forbidden(`No tienes permiso para ${privilegio} en ${modulo}`);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, authorize };
