const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.get('/perfis', requireAuth, requireAdmin, adminController.listarPerfis);
router.post('/perfis', requireAuth, requireAdmin, adminController.salvarPerfil);
router.delete('/perfis/:id', requireAuth, requireAdmin, adminController.deletarPerfil);

router.get('/modulos', requireAuth, requireAdmin, adminController.listarModulos);
router.post('/modulos', requireAuth, requireAdmin, adminController.salvarModulo);
router.delete('/modulos/:id', requireAuth, requireAdmin, adminController.deletarModulo);

router.post('/permissoes', requireAuth, requireAdmin, adminController.salvarPermissoesModulo);
router.get('/passagem/setores', requireAuth, requireAdmin, adminController.listarSetoresPassagem);

router.get('/cache', requireAuth, requireAdmin, adminController.obterCacheStatus);
router.post('/cache/reload', requireAuth, requireAdmin, adminController.recarregarCache);

router.get('/ldap/grupos', requireAuth, requireAdmin, adminController.listarGruposLdap);
router.get('/tasy/perfis', requireAuth, requireAdmin, adminController.listarPerfisTasy);

router.get('/dashboard-pa/filas', requireAuth, requireAdmin, adminController.listarFilasEsperaTasy);
router.get('/dashboard-pa/config', requireAuth, requireAdmin, adminController.obterConfigDashboardPA);
router.post('/dashboard-pa/config', requireAuth, requireAdmin, adminController.salvarConfigDashboardPA);

router.get('/system/config', requireAuth, requireAdmin, adminController.obterConfigSistema);
router.post('/system/config', requireAuth, requireAdmin, adminController.salvarConfigSistema);

router.get('/ect/agendas', requireAuth, requireAdmin, adminController.listarAgendasEct);
router.get('/ect/procedimentos', requireAuth, requireAdmin, adminController.listarProcedimentosEct);

router.get('/sessoes', requireAuth, requireAdmin, adminController.listarSessoes);

router.get('/studio/pages', requireAuth, requireAdmin, adminController.listarStudioPages);
router.get('/studio/pages/:id', requireAuth, requireAdmin, adminController.obterStudioPage);
router.post('/studio/pages', requireAuth, requireAdmin, adminController.salvarStudioPage);
router.put('/studio/pages/:id', requireAuth, requireAdmin, adminController.salvarStudioPage);
router.delete('/studio/pages/:id', requireAuth, requireAdmin, adminController.deletarStudioPage);

module.exports = router;
