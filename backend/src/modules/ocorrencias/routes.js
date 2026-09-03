const express = require('express');
const router = express.Router();
const ocorrenciaController = require('./ocorrenciaController');
const { requireAuth } = require('../../core/middlewares/authMiddleware');

router.post('/lote/draft', requireAuth, ocorrenciaController.salvarLoteDraft);
router.get('/lote/draft', requireAuth, ocorrenciaController.obterLoteDraft);
router.delete('/lote/draft', requireAuth, ocorrenciaController.limparLoteDraft);
router.post('/salvar', requireAuth, ocorrenciaController.salvar);
router.get('/passagens/anteriores', requireAuth, ocorrenciaController.listarPassagensAnteriores);
router.get('/passagens/setores-historico', requireAuth, ocorrenciaController.listarSetoresHistorico);

router.post('/livro-administrativo', requireAuth, ocorrenciaController.salvarLivroAdministrativo);
router.get('/livro-administrativo', requireAuth, ocorrenciaController.obterLivroAdministrativo);

router.post('/escala-psicologia/publicar', requireAuth, ocorrenciaController.salvarEscalaPsicologia);
router.get('/escala-psicologia/liberadas', requireAuth, ocorrenciaController.listarEscalasPsicologiaLiberadas);

router.post('/escala-tecnica', requireAuth, ocorrenciaController.salvarEscalaTecnica);
router.get('/escala-tecnica/todas', requireAuth, ocorrenciaController.listarTodasEscalasLiberadas);
router.get('/escala-tecnica', requireAuth, ocorrenciaController.obterEscalaTecnica);

module.exports = router;
