const service = require('../services/auth.service');
const recuperacion = require('../services/recuperacion.service');
const registroService = require('../services/registro.service');
const asyncHandler = require('../utils/asyncHandler');

const registro = asyncHandler(async (req, res) => {
  await registroService.solicitar(req.body);
  res.status(204).send();
});
const solicitarRegistro = asyncHandler(async (req, res) => {
  await registroService.solicitar(req.body);
  res.status(204).send();
});
const verificarRegistro = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await registroService.verificar(req.body) }));
const login = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.login(req.body) }));
const me = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.me(req.user.id) }));

const actualizarPerfil = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.actualizarPerfil(req.user.id, req.body) }));
const cambiarContrasena = asyncHandler(async (req, res) => {
  await service.cambiarContrasena(req.user.id, req.body);
  res.status(204).send();
});
const cambiarContrasenaInicial = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await service.cambiarContrasenaInicial(req.user.id, req.body) }));

const recuperar = asyncHandler(async (req, res) => {
  await recuperacion.solicitar(req.body);
  res.status(204).send();
});
const verificarRecuperacion = asyncHandler(async (req, res) =>
  res.json({ ok: true, data: await recuperacion.verificar(req.body) }));
const restablecer = asyncHandler(async (req, res) => {
  await recuperacion.restablecer(req.body);
  res.status(204).send();
});

module.exports = {
  registro,
  solicitarRegistro,
  verificarRegistro,
  login,
  me,
  actualizarPerfil,
  cambiarContrasena,
  cambiarContrasenaInicial,
  recuperar,
  verificarRecuperacion,
  restablecer,
};
