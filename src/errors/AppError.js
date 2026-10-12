class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Solicitud inválida', details) { return new AppError(msg, 400, details); }
  static unauthorized(msg = 'No autenticado') { return new AppError(msg, 401); }
  static forbidden(msg = 'Sin permisos') { return new AppError(msg, 403); }
  static notFound(msg = 'Recurso no encontrado') { return new AppError(msg, 404); }
  static conflict(msg = 'Conflicto con el estado actual') { return new AppError(msg, 409); }
}

module.exports = AppError;
