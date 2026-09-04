const express = require('express');
const router = express.Router();
const adminController = require('.//adminController');
const { requireAuth, requireAdmin } = require('../../core/middlewares/authMiddleware');

router.get('/perfis', requireAuth, requireAdmin, adminController.listarPerfis);
router.post('/perfis', requireAuth, requireAdmin, adminController.salvarPerfil);
router.delete('/perfis/:id', requireAuth, requireAdmin, adminController.deletarPerfil);

router.get('/modulos', requireAuth, requireAdmin, adminController.listarModulos);
router.post('/modulos', requireAuth, requireAdmin, adminController.salvarModulo);
router.delete('/modulos/:id', requireAuth, requireAdmin, adminController.deletarModulo);

router.post('/permissoes', requireAuth, requireAdmin, adminController.salvarPermissoesModulo);
router.get('/passagem/setores', requireAuth, requireAdmin, adminController.listarSetoresPassagem);
router.get('/passagem/checkboxes', requireAuth, requireAdmin, adminController.listarPassagemCheckboxes);
router.post('/passagem/checkboxes', requireAuth, requireAdmin, adminController.salvarPassagemCheckbox);
router.put('/passagem/checkboxes/:id/toggle', requireAuth, requireAdmin, adminController.togglePassagemCheckbox);
router.delete('/passagem/checkboxes/:id', requireAuth, requireAdmin, adminController.deletarPassagemCheckbox);

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
router.delete('/sessoes/:id', requireAuth, requireAdmin, adminController.encerrarSessao);
router.get('/audit-trail', requireAuth, requireAdmin, adminController.listarAuditTrail);

router.get('/studio/pages', requireAuth, requireAdmin, adminController.listarStudioPages);

router.get('/studio/pages/:id', requireAuth, requireAdmin, adminController.obterStudioPage);
router.post('/studio/pages', requireAuth, requireAdmin, adminController.salvarStudioPage);
router.put('/studio/pages/:id', requireAuth, requireAdmin, adminController.salvarStudioPage);
router.delete('/studio/pages/:id', requireAuth, requireAdmin, adminController.deletarStudioPage);

router.get('/oracle/test', requireAuth, requireAdmin, adminController.testarConexaoOracle);
router.post('/ldap/diagnostico', requireAuth, requireAdmin, adminController.diagnosticarUsuarioLdap);

router.get('/infra/oracle', requireAuth, requireAdmin, adminController.obterConfigOracle);
router.post('/infra/oracle', requireAuth, requireAdmin, adminController.salvarConfigOracle);
router.get('/infra/ldap', requireAuth, requireAdmin, adminController.obterConfigLdap);
router.post('/infra/ldap', requireAuth, requireAdmin, adminController.salvarConfigLdap);
router.post('/infra/testar-tasy-reports', requireAuth, requireAdmin, adminController.testarTasyReports);

// Gestão de Painéis de TV e Mapeamento de Guichês
router.get('/paineis', requireAuth, requireAdmin, adminController.listarPaineisTv);
router.post('/paineis', requireAuth, requireAdmin, adminController.salvarPainelTv);
router.put('/paineis/:id', requireAuth, requireAdmin, adminController.salvarPainelTv);
router.delete('/paineis/:id', requireAuth, requireAdmin, adminController.deletarPainelTv);

router.get('/guiches', requireAuth, requireAdmin, adminController.listarMaquinasGuiches);
router.post('/guiches', requireAuth, requireAdmin, adminController.salvarMaquinaGuiche);
router.put('/guiches/:id', requireAuth, requireAdmin, adminController.salvarMaquinaGuiche);
router.delete('/guiches/:id', requireAuth, requireAdmin, adminController.deletarMaquinaGuiche);

// Catálogo Dinâmico de Relatórios do TASY (Recepção)
router.get('/relatorios-tasy', requireAuth, requireAdmin, adminController.listarRelatoriosTasy);
router.post('/relatorios-tasy', requireAuth, requireAdmin, adminController.salvarRelatorioTasy);
router.put('/relatorios-tasy/:id/toggle', requireAuth, requireAdmin, adminController.toggleRelatorioTasy);
router.delete('/relatorios-tasy/:id', requireAuth, requireAdmin, adminController.deletarRelatorioTasy);

// Telemetria & Monitor do Servidor
router.get('/infra/telemetria', requireAuth, requireAdmin, adminController.obterTelemetriaServidor);

module.exports = router;
