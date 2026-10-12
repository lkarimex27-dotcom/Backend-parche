const service = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

const registro = asyncHandler(async (req, res) => res.status(201).json({ ok: true, data: await service.registrar(req.body) }));
const login = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.login(req.body) }));
const me = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.me(req.user.id) }));

module.exports = { registro, login, me };
