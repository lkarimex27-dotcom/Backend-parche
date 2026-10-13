const router = require('express').Router();
const c = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const v = require('../validators/auth.validator');

router.post('/registro', validate(v.registro), c.registro);   // público: crea un CLIENTE
router.post('/login', validate(v.login), c.login);            // público
router.get('/me', authenticate, c.me);                        // perfil + permisos del usuario del token
router.patch('/me', authenticate, validate(v.perfil), c.actualizarPerfil);                    // nombre, documento, teléfono, direcciones
router.patch('/me/contrasena', authenticate, validate(v.cambioContrasena), c.cambiarContrasena); // pide la actual

module.exports = router;
