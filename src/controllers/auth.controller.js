const service = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

const registro = asyncHandler(async (req, res) => res.status(201).json({ ok: true, data: await service.registrar(req.body) }));
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

module.exports = { registro, login, me, actualizarPerfil, cambiarContrasena, cambiarContrasenaInicial };
