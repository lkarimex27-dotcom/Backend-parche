require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  // El front de Vercel y el de desarrollo siempre entran, más lo que agregue CORS_ORIGINS
  corsOrigins: [
    ...new Set([
      'https://mini-burguer-lw8q.vercel.app',
      'http://localhost:8443',
      'http://127.0.0.1:8443',
      'http://localhost:5173',
      ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    ]),
  ],
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminNombre: process.env.ADMIN_NOMBRE || 'Administrador',
  // Superadministrador fijo: nadie lo desactiva, lo elimina, le quita el rol ni le cambia el correo
  superAdminEmail: 'admin@minifood.com',

  // Correo que envía los códigos de recuperación (Gmail + contraseña de aplicación)
  mailUser: process.env.MAIL_USER,
  mailPass: (process.env.MAIL_PASS || '').replace(/\s/g, ''), // Google la muestra con espacios

  defaultPasswords: Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('DEFAULT_PASSWORD_'))
  ),

};

module.exports = env;
