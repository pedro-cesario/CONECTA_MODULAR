const express = require('express');
const router = express.Router();
const auditoriaController = require('./auditoriaController');

router.get('/higiene-maos/opcoes', auditoriaController.listarOpcoes);
router.post('/higiene-maos', auditoriaController.salvarHigieneMaos);
router.get('/higiene-maos/historico', auditoriaController.listarHistorico);
router.get('/higiene-maos/historico/consolidado', auditoriaController.listarHistoricoConsolidado);
router.get('/higiene-maos/:id/xlsx', auditoriaController.baixarXlsx);
router.get('/higiene-maos/:id/pdf', auditoriaController.baixarPdf);
router.get('/higiene-maos/:id', auditoriaController.obterAuditoria);

router.get('/processos/pacientes-ontem', auditoriaController.listarPacientesOntem);
router.get('/processos/paciente-aleatorio', auditoriaController.pacienteAleatorio);
router.get('/processos/opcoes', auditoriaController.listarOpcoesProcessos);
router.post('/processos', auditoriaController.salvarAuditoriaProcessos);
router.get('/processos/historico', auditoriaController.listarHistoricoProcessos);
router.get('/processos/historico/consolidado', auditoriaController.listarHistoricoProcessosConsolidado);
router.get('/processos/:id/xlsx', auditoriaController.baixarXlsxProcessos);
router.get('/processos/:id/pdf', auditoriaController.baixarPdfProcessos);
router.get('/processos/:id', auditoriaController.obterProcessos);

module.exports = router;
