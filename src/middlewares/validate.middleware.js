const AppError = require('../errors/AppError');

// Uso: router.post('/', validate(schema, 'body'), controller)
module.exports = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }));
    return next(AppError.badRequest('Datos inválidos', details));
  }
  req[source] = result.data;
  next();
};
