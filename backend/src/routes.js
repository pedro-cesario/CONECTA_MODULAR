const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { requireAuth } = require('./core/middlewares/authMiddleware');
const configCache = require('./core/config/configCache');
const modulosLogic = require('./core/config/modulos');

// Importação dos Roteadores dos Módulos de Domínio
const authRoutes = require('./modules/auth/routes');
const setoresRoutes = require('./modules/setores/routes');
const usuariosRoutes = require('./modules/usuarios/routes');
const pacientesRoutes = require('./modules/pacientes/routes');
const dashboardRoutes = require('./modules/dashboard/routes');
const ocorrenciasRoutes = require('./modules/ocorrencias/routes');
const escalasRoutes = require('./modules/escalas/routes');
const registrosRoutes = require('./modules/registros/routes');
const auditoriasRoutes = require('./modules/auditorias/routes');
const recepcaoRoutes = require('./modules/recepcao/routes');
const adminRoutes = require('./modules/admin/routes');

// Injeção de Controllers necessários para aliases de compatibilidade
const setorController = require('./modules/setores/setorController');
const pacienteController = require('./modules/pacientes/pacienteController');

// Versão da API e status
router.get('/version', (req, res) => {
  let version = '1.0.0';
  let showTestBar = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    version = pkg.version || version;
    showTestBar = !!pkg.showTestBar;
  } catch {}
  res.json({ ok: true, version, showTestBar });
});

// Módulo de Autenticação (Login, Logout, Me, Native SSO)
router.use('/', authRoutes);

// Módulos (protegido) - Retorna módulos e permissões ativas do usuário
router.get('/modulos', requireAuth, (req, res) => {
  const modulos = configCache.getAllModulosWithPermissoes();
  res.json({ success: true, data: modulos });
});

// Checkboxes dinâmicos da Passagem de Plantão
const adminController = require('./modules/admin/adminController');
router.get('/passagem/checkboxes', requireAuth, adminController.listarCheckboxesAtivos);

// Aliases de Compatibilidade Legada
router.get('/setores-internacao', requireAuth, setorController.listarSetoresInternacao);
router.post('/setores-internacao', requireAuth, setorController.listarSetoresInternacao);
router.get('/setores-livro', requireAuth, setorController.listarSetoresLivro);
router.get('/pacientes-setor/:cd_setor', requireAuth, pacienteController.listarPacientesSetor);
router.post('/dashboard/pacientes-setor/:cd_setor', requireAuth, pacienteController.listarPacientesDashboard);

const painelRoutes = require('./modules/painel/routes');

// Roteamento Modular por Domínio
router.use('/admin', requireAuth, adminRoutes);
router.use('/setores', requireAuth, setoresRoutes);
router.use('/', usuariosRoutes); // /tecnicos, /enfermeiros, /profissionais-psicologia
router.use('/pacientes', requireAuth, pacientesRoutes);
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/', ocorrenciasRoutes); // /salvar, /passagens, /livro-administrativo, /escala-*
router.use('/escala-ativa', requireAuth, escalasRoutes);
router.use('/registros', requireAuth, registrosRoutes);
router.use('/auditorias', requireAuth, auditoriasRoutes);
router.use('/recepcao', recepcaoRoutes);
router.use('/painel', painelRoutes);

module.exports = router;
