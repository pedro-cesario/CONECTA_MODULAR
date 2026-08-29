import { api } from './api.js';
import { setLoading, getTodayIsoDate, escapeHtml, renderNomeCivilPaciente, getPacienteInitials, debounce } from './utils.js';
import { showToast, showModal, showConfirmModal } from './ui.js';
import { showScreen, hideAllAppSections, activateWorkspace, isCurrentWorkspace, showModeChooser } from './router.js';
import { normalizeDraftKey, getDraftStorageKey, getDraftDirtyKey, readDraftEnvelope, writeDraftEnvelope, getModuleDraft, setModuleDraft, clearModuleDraft, discardModuleWork, hasModuleDraft, cloneDraftValue, captureModuleDraft, flushModuleDraft, flushPendingDrafts, markModuleDraftDirty, updateTopbarDraftIndicators, initializeDraftSession } from './draft.js';
import { checkSession, loadModulosFromBackend, updateProfileLabels, perfilTemAcessoModulo, trocarPerfil, alterarPerfilSeNecessario, getModulosDisponiveis } from './auth.js';


// Extraído de app.js
export const state = {
    livroLoaded: false,
    escalaLoaded: false,

    usuario: null,

    setores: [],

    setoresSelecionados: [],

    pacientes: [],

    turno: null,

    savedTexts: {},
    loteSectors: new Set(),

    mode: null,

    cdModulo: null,

    lastModuleState: {},

    livroSetores: [],

    livroSetorSelecionado: null,

    livroTecnicos: [],

    livroPacientes: [],

    livroTecnicosSelecionados: [],

    livroFaltasFolgas: [],

    livroPacienteVinculo: new Map(),

    livroEnfermeiros: [],

    livroEnfermeiroSelecionado: null,

    livroEctPre: [],

    livroEctSala: [],

    livroEctRecuperacao: [],

    livroAvaliacaoExterna: [],

    livroPatio: [],

    livroCirculante: [],

    livroLoadSeq: 0,

    livroPatioCirculanteLocked: false,

    livroPatioGlobal: [],

    livroCirculanteGlobal: [],

    printHtmlBody: null,

    printEscalasAll: [],

    printEscalasFiltradas: [],

    dashboardSetores: [],

    dashboardSetorSelecionado: null,

    dashboardPacientes: [],

    dashboardFiltroEtiquetas: new Set(),

    dashboardResumo: null,

    dashboardTimer: null,

    dashboardClockTimer: null,

    dashboardPA: {
      particularesAlta: [],
      altaMedica: [],
      salaObservacao: [],
      indicacaoInternacao: [],
      decididos: []
    },

    dashboardPALoaded: false,

    dashboardPAFiltroEtiqueta: null,

    dashboardPATimer: null,

    dashboardPAClockTimer: null,

  }


export const MODULOS_CONFIG = {};

  export const MODULOS_META = {
    passagem: {
      id: 'passagem',
      nome: 'Passagem de Plantão',
      allowedProfiles: [],
      buttonId: 'btn-abrir-passagem',
      topbarButtonId: 'nav-passagem',
      activeModes: ['passagem', 'passagem-submenu', 'passagens-anteriores'],
      entryFnName: 'enterPassagemMode'
    },
    dashboard: {
      id: 'dashboard',
      nome: 'Dashboard de Pacientes',
      allowedProfiles: [],
      buttonId: 'btn-abrir-dashboard',
      topbarButtonId: 'nav-dashboard',
      activeModes: ['dashboard'],
      entryFnName: 'enterDashboardMode'
    },
    livro: {
      id: 'livro',
      nome: 'Livro Administrativo',
      allowedProfiles: [],
      buttonId: 'btn-abrir-livro',
      topbarButtonId: 'nav-livro',
      activeModes: ['livro', 'livro-submenu', 'print'],
      entryFnName: 'showLivroSubMenu'
    },
    escala: {
      id: 'escala',
      nome: 'Gestão de Escalas',
      allowedProfiles: [],
      buttonId: 'btn-abrir-escala',
      topbarButtonId: 'nav-escala',
      activeModes: ['escala'],
      entryFnName: 'enterEscalaMode'
    },
        auditorias: {
      id: 'auditorias',
      nome: 'Auditorias',
      allowedProfiles: [],
      buttonId: 'btn-abrir-auditorias',
      topbarButtonId: 'nav-auditorias',
      activeModes: ['auditorias-submenu', 'auditoria-higiene-submenu', 'auditoria-higiene-form', 'auditoria-historico', 'auditoria-processos-submenu', 'auditoria-processos-paciente', 'auditoria-processos-form', 'auditoria-processos-historico'],
      entryFnName: 'enterAuditoriasMode'
    },
    dashboard_pa: {
      id: 'dashboard_pa',
      nome: 'Dashboard P.A.',
      allowedProfiles: [],
      buttonId: 'btn-abrir-dashboard-internacao',
      topbarButtonId: 'nav-dashboard-pa',
      activeModes: ['dashboard-internacao'],
      entryFnName: 'enterDashboardInternacaoMode'
    },
    registros: {
      id: 'registros',
      nome: 'Registros',
      allowedProfiles: [],
      buttonId: 'btn-abrir-registros',
      topbarButtonId: 'nav-registros',
      activeModes: ['registros-submenu', 'registros-pessoa-busca', 'registros-demanda-form'],
      entryFnName: 'showRegistrosSubMenu'
    }
  };

  
export const MODULOS_DEFAULT = {
  passagem: ['enfermagem', 'psicologia'],
  dashboard: ['enfermagem', 'tecnico_enfermagem'],
  livro: ['enfermagem'],
  escala: ['psicologia'],
  dashboard_pa: ['enfermagem'],
  registros: ['admin', 'servico_social']
};

export const draftHydratingModules = new Set();

export const DRAFT_STORAGE_VERSION = 2;
export const DRAFT_STORAGE_PREFIX = 'conecta_drafts_v2';
export const EDITABLE_DRAFT_MODULES = ['passagem', 'livro', 'escala', 'auditorias', 'registros'];
export const draftDirtyModules = new Set();
export const draftSaveTimers = new Map();
export let modeTransitionSeq = 0;
export function incrementModeTransitionSeq() { modeTransitionSeq++; return modeTransitionSeq; }
export function getModeTransitionSeq() { return modeTransitionSeq; }

