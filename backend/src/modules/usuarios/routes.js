const express = require('express');
const router = express.Router();
const usuarioController = require('./usuarioController');
const { requireAuth } = require('../../core/middlewares/authMiddleware');

router.get('/tecnicos', requireAuth, usuarioController.listarTecnicos);
router.get('/enfermeiros', requireAuth, usuarioController.listarEnfermeiros);
router.get('/profissionais-psicologia', requireAuth, usuarioController.listarProfissionaisSetor4);

module.exports = router;
