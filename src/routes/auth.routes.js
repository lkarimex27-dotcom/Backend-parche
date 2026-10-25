const router = require('express').Router();
const c = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const v = require('../validators/auth.validator');

router.post('/registro', validate(v.registro), c.registro);   // compatibilidad: inicia el registro con PIN
router.post('/registro/solicitar', validate(v.solicitarRegistro), c.solicitarRegistro); // público: envía PIN de confirmación
router.post('/registro/verificar', validate(v.verificarCodigo), c.verificarRegistro);   // público: confirma el correo y crea el CLIENTE
router.post('/login', validate(v.login), c.login);            // público
router.post('/recuperar', validate(v.recuperar), c.recuperar);          // público: envía el código al correo
router.post('/recuperar/verificar', validate(v.verificarCodigo), c.verificarRecuperacion); // público: valida PIN antes de cambiar la contraseña
router.post('/restablecer', validate(v.restablecer), c.restablecer);    // público: token validado + nueva contraseña
router.get('/me', authenticate, c.me);                        // perfil + permisos del usuario del token
router.patch('/me', authenticate, validate(v.perfil), c.actualizarPerfil);                    // nombre, documento, teléfono, direcciones
router.patch('/me/contrasena', authenticate, validate(v.cambioContrasena), c.cambiarContrasena); // pide la actual

router.patch('/me/contrasena-inicial', authenticate, validate(v.cambioContrasenaInicial), c.cambiarContrasenaInicial);


module.exports = router;
