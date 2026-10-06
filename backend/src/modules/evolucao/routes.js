const express = require('express');
const router = express.Router();
const evolucaoController = require('./evolucaoController');
const { requireAuth } = require('../../core/middlewares/authMiddleware');

router.get('/validar/:nrAtendimento', requireAuth, evolucaoController.validarAssinatura);
router.post('/criar', requireAuth, evolucaoController.criarEvolucaoTeste);
router.post('/assinar', requireAuth, evolucaoController.assinarEvolucaoTeste);

module.exports = router;
