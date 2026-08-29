const express = require('express');
const router = express.Router();
const ocorrenciaController = require('./ocorrenciaController');

router.post('/lote/draft', ocorrenciaController.salvarLoteDraft);
router.get('/lote/draft', ocorrenciaController.obterLoteDraft);
router.delete('/lote/draft', ocorrenciaController.limparLoteDraft);
router.post('/salvar', ocorrenciaController.salvar);
router.get('/passagens/anteriores', ocorrenciaController.listarPassagensAnteriores);
router.get('/passagens/setores-historico', ocorrenciaController.listarSetoresHistorico);

router.post('/livro-administrativo', ocorrenciaController.salvarLivroAdministrativo);
router.get('/livro-administrativo', ocorrenciaController.obterLivroAdministrativo);

router.post('/escala-psicologia/publicar', ocorrenciaController.salvarEscalaPsicologia);
router.get('/escala-psicologia/liberadas', ocorrenciaController.listarEscalasPsicologiaLiberadas);

router.post('/escala-tecnica', ocorrenciaController.salvarEscalaTecnica);
router.get('/escala-tecnica/todas', ocorrenciaController.listarTodasEscalasLiberadas);
router.get('/escala-tecnica', ocorrenciaController.obterEscalaTecnica);

module.exports = router;
