const express = require('express');
const router = express.Router();
const ocorrenciaController = require('./ocorrenciaController');
const { requireAuth, requirePermission } = require('../../core/middlewares/authMiddleware');
const { validarModuloPermissao } = require('../../core/utils/acesso');

function requireEscalaOuLivroEscrita(req, res, next) {
  const usuario = req.session?.usuario;
  if (!usuario) {
    return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
  }
  const temLivro = validarModuloPermissao(usuario, 'livro');
  const temEscalaEdit = validarModuloPermissao(usuario, 'escala', 'editar_publicar_escala');
  if (temLivro || temEscalaEdit) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Acesso negado: seu perfil não possui autorização para a operação exigida.'
  });
}

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

router.post('/escala-tecnica', requireEscalaOuLivroEscrita, ocorrenciaController.salvarEscalaTecnica);
router.get('/escala-tecnica/todas', requirePermission(['escala', 'livro']), ocorrenciaController.listarTodasEscalasLiberadas);
router.get('/escala-tecnica', requirePermission(['escala', 'livro']), ocorrenciaController.obterEscalaTecnica);

module.exports = router;
