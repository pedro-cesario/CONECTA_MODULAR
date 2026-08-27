const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const setorController = require('../controllers/setorController');
const pacienteController = require('../controllers/pacienteController');
const ocorrenciaController = require('../controllers/ocorrenciaController');
const usuarioController = require('../controllers/usuarioController');
const dashboardController = require('../controllers/dashboardController');
const escalaAtivaController = require('../controllers/escalaAtivaController');
const auditoriaController = require('../controllers/auditoriaController');
const registroController = require('../controllers/registroController');
const nativeSsoController = require('../controllers/nativeSsoController');
const adminRoutes = require('./adminRoutes');
const configCache = require('../config/configCache');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/ping', (req, res) => {
  const sysConfig = configCache.getSystemConfig();
  const version = sysConfig.app_version || require('../../package.json').version;
  const showTestBar = sysConfig.show_test_bar === 'true';
  res.json({ ok: true, version, showTestBar });
});

// Auth
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.me);
router.post('/native-sso/login', nativeSsoController.login);

// Módulos (protegido) - retorna módulos com permissões do cache
router.get('/modulos', requireAuth, (req, res) => {
  const modulos = configCache.getAllModulosWithPermissoes();
  res.json({ success: true, data: modulos });
});

// Admin (protegido + requireAdmin)
router.use('/admin', adminRoutes);

// Setores (protegido)
router.get('/setores', requireAuth, setorController.listarSetores);
router.get('/setores-internacao', requireAuth, setorController.listarSetoresInternacao);
router.post('/setores-internacao', requireAuth, setorController.listarSetoresInternacao);
router.get('/setores-livro', requireAuth, setorController.listarSetoresLivro);

// Técnicos (protegido)
router.get('/tecnicos', requireAuth, usuarioController.listarTecnicos);
router.get('/enfermeiros', requireAuth, usuarioController.listarEnfermeiros);
router.get('/profissionais-psicologia', requireAuth, usuarioController.listarProfissionaisSetor4);

router.get('/auditorias/higiene-maos/opcoes', requireAuth, auditoriaController.listarOpcoes);
router.post('/auditorias/higiene-maos', requireAuth, auditoriaController.salvarHigieneMaos);
router.get('/auditorias/higiene-maos/historico', requireAuth, auditoriaController.listarHistorico);
router.get('/auditorias/higiene-maos/historico/consolidado', requireAuth, auditoriaController.listarHistoricoConsolidado);
router.get('/auditorias/higiene-maos/:id/xlsx', requireAuth, auditoriaController.baixarXlsx);
router.get('/auditorias/higiene-maos/:id/pdf', requireAuth, auditoriaController.baixarPdf);
router.get('/auditorias/higiene-maos/:id', requireAuth, auditoriaController.obterAuditoria);

// Auditoria de Processos
router.get('/auditorias/processos/pacientes-ontem', requireAuth, auditoriaController.listarPacientesOntem);
router.get('/auditorias/processos/paciente-aleatorio', requireAuth, auditoriaController.pacienteAleatorio);
router.get('/auditorias/processos/opcoes', requireAuth, auditoriaController.listarOpcoesProcessos);
router.post('/auditorias/processos', requireAuth, auditoriaController.salvarAuditoriaProcessos);
router.get('/auditorias/processos/historico', requireAuth, auditoriaController.listarHistoricoProcessos);
router.get('/auditorias/processos/historico/consolidado', requireAuth, auditoriaController.listarHistoricoProcessosConsolidado);
router.get('/auditorias/processos/:id/xlsx', requireAuth, auditoriaController.baixarXlsxProcessos);
router.get('/auditorias/processos/:id/pdf', requireAuth, auditoriaController.baixarPdfProcessos);
router.get('/auditorias/processos/:id', requireAuth, auditoriaController.obterProcessos);

// Pacientes (protegido)
router.post('/pacientes', requireAuth, pacienteController.listarPacientes);
router.get('/pacientes-setor/:cd_setor', requireAuth, pacienteController.listarPacientesSetor);

// Dashboard (protegido)
router.get('/dashboard/setores', requireAuth, dashboardController.listarSetores);
router.get('/dashboard/pacientes', requireAuth, dashboardController.listarPacientes);
router.post('/dashboard/pacientes-setor/:cd_setor', requireAuth, pacienteController.listarPacientesDashboard);
router.get('/dashboard/internacao', requireAuth, dashboardController.listarDashboardPA);
router.get('/dashboard/internacao/detalhes/:nrAtendimento', requireAuth, dashboardController.obterDetalhesInternacao);
router.post('/dashboard/internacao/acao', requireAuth, dashboardController.executarAcaoInternacao);

router.post('/perfil/alterar', requireAuth, authController.alterarPerfil);

// Rascunho de Lote
router.post('/lote/draft', requireAuth, ocorrenciaController.salvarLoteDraft);
router.get('/lote/draft', requireAuth, ocorrenciaController.obterLoteDraft);
router.delete('/lote/draft', requireAuth, ocorrenciaController.limparLoteDraft);

// Salvar passagem (protegido)
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

router.get('/escala-ativa', requireAuth, escalaAtivaController.loadEscalaAtiva);
router.get('/escala-ativa/periodo', requireAuth, escalaAtivaController.loadEscalasAtivasPorPeriodo);
router.get('/escala-ativa/patio-circulante-global', requireAuth, escalaAtivaController.buscarPatioCirculanteGlobal);
router.put('/escala-ativa', requireAuth, escalaAtivaController.saveEscalaAtiva);
router.get('/escala-ativa/versoes', requireAuth, escalaAtivaController.listarVersoes);
router.get('/escala-ativa/versao', requireAuth, escalaAtivaController.loadVersaoEspecifica);
router.get('/escala-ativa/diff', requireAuth, escalaAtivaController.loadDiff);

// Registros Assistenciais (Demanda Espontânea, etc.)
router.get('/registros/tipos', requireAuth, registroController.listarTipos);
router.get('/registros/pessoas', requireAuth, registroController.buscarPessoas);
router.get('/registros/pessoas/:cdPessoaFisica', requireAuth, registroController.obterPessoa);
router.post('/registros/pessoas', requireAuth, registroController.cadastrarPessoa);
router.put('/registros/pessoas/:cdPessoaFisica', requireAuth, registroController.atualizarPessoa);
router.post('/registros', requireAuth, registroController.salvarRegistro);
router.get('/registros/historico', requireAuth, registroController.listarHistorico);

module.exports = router;
