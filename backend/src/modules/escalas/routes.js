const express = require('express');
const router = express.Router();
const escalaAtivaController = require('./escalaAtivaController');
const { requirePermission } = require('../../core/middlewares/authMiddleware');
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

router.get('/', requirePermission(['escala', 'livro']), escalaAtivaController.loadEscalaAtiva);
router.get('/periodo', requirePermission('escala'), escalaAtivaController.loadEscalasAtivasPorPeriodo);
router.get('/patio-circulante-global', requirePermission(['escala', 'livro']), escalaAtivaController.buscarPatioCirculanteGlobal);
router.put('/', requireEscalaOuLivroEscrita, escalaAtivaController.saveEscalaAtiva);
router.get('/versoes', requirePermission(['escala', 'livro']), escalaAtivaController.listarVersoes);
router.get('/versao', requirePermission('escala'), escalaAtivaController.loadVersaoEspecifica);
router.get('/diff', requirePermission(['escala', 'livro']), escalaAtivaController.loadDiff);

module.exports = router;
