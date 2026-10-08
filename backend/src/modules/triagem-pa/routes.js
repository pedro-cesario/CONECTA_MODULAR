const express = require('express');
const router = express.Router();
const controller = require('./TriagemPaController');
const { requireAuth } = require('../../core/middlewares/authMiddleware');

// Triagem manipula dados clínicos e deve seguir a mesma política de sessão da API.
router.use(requireAuth);

router.get('/buscar', controller.buscar);
router.post('/pacientes', controller.cadastrarPaciente);
router.post('/pacientes/nao-identificado', controller.naoIdentificado);
router.post('/pacientes/:cdPessoaFisica/sem-documento', controller.semDocumento);
router.post('/iniciar', controller.iniciar);
router.post('/senhas/:id/descartar', controller.descartarSenha);
router.get('/senhas/:id/status', controller.statusSenha);


router.get('/pacientes/:cdPessoaFisica/alergias', controller.obterAlergias);
router.get('/principios-ativos', controller.buscarPrincipiosAtivos);
router.get('/atendimentos/:nrAtendimento/rascunho', controller.obterRascunho);
router.post('/atendimentos/:nrAtendimento/rascunho', controller.salvarRascunho);
router.get('/configuracoes-clinicas', controller.obterConfiguracoesClinicas);


router.post('/atendimentos/:nrAtendimento/finalizar', controller.finalizarTriagem);
module.exports = router;
