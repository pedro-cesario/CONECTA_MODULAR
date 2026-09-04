const express = require('express');
const router = express.Router();
const ocorrenciaController = require('./ocorrenciaController');
const { requireAuth, requirePermission } = require('../../core/middlewares/authMiddleware');

router.post('/lote/draft', requirePermission('passagem'), ocorrenciaController.salvarLoteDraft);
router.get('/lote/draft', requirePermission('passagem'), ocorrenciaController.obterLoteDraft);
router.delete('/lote/draft', requirePermission('passagem'), ocorrenciaController.limparLoteDraft);
router.post('/salvar', requirePermission('passagem', 'lancar_nova_passagem'), ocorrenciaController.salvar);
router.get('/passagens/anteriores', requirePermission('passagem'), ocorrenciaController.listarPassagensAnteriores);
router.get('/passagens/setores-historico', requirePermission('passagem'), ocorrenciaController.listarSetoresHistorico);

router.post('/livro-administrativo', requirePermission('livro'), ocorrenciaController.salvarLivroAdministrativo);
router.get('/livro-administrativo', requirePermission('livro'), ocorrenciaController.obterLivroAdministrativo);

router.post('/escala-psicologia/publicar', requirePermission('escala', 'editar_publicar_escala'), ocorrenciaController.salvarEscalaPsicologia);
router.get('/escala-psicologia/liberadas', requirePermission('escala'), ocorrenciaController.listarEscalasPsicologiaLiberadas);

router.post('/escala-tecnica', requirePermission('escala', 'editar_publicar_escala'), ocorrenciaController.salvarEscalaTecnica);
router.get('/escala-tecnica/todas', requirePermission('escala'), ocorrenciaController.listarTodasEscalasLiberadas);
router.get('/escala-tecnica', requirePermission('escala'), ocorrenciaController.obterEscalaTecnica);

module.exports = router;
