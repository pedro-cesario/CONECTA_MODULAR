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

const { versionHandler } = require('./core/utils/versionHandler');

// Versão da API e status (suporta /version e alias /ping)
router.get(['/version', '/ping'], versionHandler);

// Módulo de Autenticação (Login, Logout, Me, Native SSO)
router.use('/', authRoutes);

// Módulos (protegido) - Retorna módulos e permissões ativas do usuário
router.get('/modulos', requireAuth, (req, res) => {
  const modulos = configCache.getAllModulosWithPermissoes();
  const usuario = req.session?.usuario;
  const perfisDisponiveis = new Set((usuario?.perfisDisponiveis || []).map(p => String(p.id)));

  const projecao = modulos.map(mod => ({
    ...mod,
    perfisPermitidos: (mod.perfisPermitidos || []).filter(pId => perfisDisponiveis.has(String(pId)))
  }));

  res.json({ success: true, data: projecao });
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

const evolucaoRoutes = require('./modules/evolucao/routes');
router.use('/evolucao', evolucaoRoutes);

const ehrRoutes = require('./modules/ehr/ehrRoutes');
router.use('/ehr', ehrRoutes);

const triagemPaRoutes = require('./modules/triagem-pa/routes');
router.use('/triagem-pa', triagemPaRoutes);

module.exports = router;
