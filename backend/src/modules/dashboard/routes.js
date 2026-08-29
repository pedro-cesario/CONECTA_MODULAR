const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboardController');

router.get('/setores', dashboardController.listarSetores);
router.get('/pacientes', dashboardController.listarPacientes);
router.get('/internacao', dashboardController.listarDashboardPA);
router.get('/internacao/detalhes/:nrAtendimento', dashboardController.obterDetalhesInternacao);
router.post('/internacao/acao', dashboardController.executarAcaoInternacao);

module.exports = router;
