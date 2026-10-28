const AppError = require('../errors/AppError');
const env = require('../config/env');

const notFound = (req, _res, next) => {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // Errores comunes de PostgreSQL
  if (err.code === '23505') {
    err = AppError.conflict(
      err.constraint === 'personas_documento_key'
        ? 'Ya hay una persona registrada con este número de documento.'
        : err.constraint === 'usuarios_correo_key'
          ? 'Ya existe una cuenta con este correo.'
          : 'Ya existe un registro con esos datos'
    );
  }
  else if (err.code === '23503') err = AppError.conflict('Operación no permitida: el registro depende de otros datos o hay datos que dependen de él');
  else if (err.code === '22P02') err = AppError.badRequest('Formato de dato inválido');

  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    ok: false,
    mensaje: status >= 500 && env.nodeEnv === 'production' ? 'Error interno del servidor' : err.message,
    ...(err.details && { detalles: err.details }),
    ...(env.nodeEnv !== 'production' && status >= 500 && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
