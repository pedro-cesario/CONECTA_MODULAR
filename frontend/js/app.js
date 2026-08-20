(() => {

  'use strict';

  // =============================================================================
  // CONFIGURAÇÃO DE MÓDULOS (dinâmica via backend)
  // =============================================================================
  const MODULOS_CONFIG = {};
  let MODULOS_CONFIG_LOADED = false;

  const MODULOS_META = {
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
      activeModes: ['auditorias-submenu', 'auditoria-higiene-submenu', 'auditoria-higiene-form', 'auditoria-historico'],
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
    }
  };

  const MODULOS_DEFAULT = {
    passagem: ['enfermagem', 'psicologia'],
    dashboard: ['enfermagem', 'tecnico_enfermagem'],
    livro: ['enfermagem'],
    escala: ['psicologia'],
    dashboard_pa: ['enfermagem']
  };

  async function loadModulosFromBackend() {
    try {
      const result = await api.get('/api/modulos');

      Object.keys(MODULOS_META).forEach(key => {
        MODULOS_META[key].allowedProfiles = [];
      });

      if (result.success && Array.isArray(result.data)) {
        result.data.forEach(mod => {
          if (MODULOS_META[mod.id]) {
            MODULOS_META[mod.id].allowedProfiles = (mod.perfisPermitidos || []).map(String);
          } else {
            MODULOS_META[mod.id] = {
              id: mod.id,
              nome: mod.nome,
              allowedProfiles: (mod.perfisPermitidos || []).map(String),
              buttonId: '',
              topbarButtonId: '',
              activeModes: [mod.id],
              entryFnName: ''
            };
          }
        });
      }

      Object.assign(MODULOS_CONFIG, MODULOS_META);
      MODULOS_CONFIG_LOADED = true;
      rebuildModuleGrid();
    } catch (_) {
      Object.keys(MODULOS_DEFAULT).forEach(key => {
        if (MODULOS_META[key]) {
          MODULOS_META[key].allowedProfiles = MODULOS_DEFAULT[key].map(String);
        }
      });
      Object.assign(MODULOS_CONFIG, MODULOS_META);
      MODULOS_CONFIG_LOADED = true;
    }
  }

  function rebuildModuleGrid() {
    const grid = document.querySelector('.mode-grid');
    if (!grid) return;
    const modules = Object.values(MODULOS_CONFIG);
    const existingButtons = grid.querySelectorAll('.mode-option-btn');
    const existingIds = new Set();
    existingButtons.forEach(btn => existingIds.add(btn.id));

    modules.forEach(mod => {
      if (mod.buttonId && !existingIds.has(mod.buttonId)) {
        const btn = document.createElement('button');
        btn.className = 'mode-option-btn d-none';
        btn.id = mod.buttonId;
        btn.type = 'button';
        btn.setAttribute('data-modulo-id', mod.id);
        btn.innerHTML = `<span class="module-icon module-icon-primary"><i class="bi bi-grid"></i></span>
          <span class="module-content"><strong>${escapeHtml(mod.nome)}</strong><small></small></span>
          <i class="bi bi-arrow-up-right module-arrow"></i>`;
        const livrosBtn = grid.querySelector('#btn-abrir-dashboard-internacao');
        if (livrosBtn) {
          livrosBtn.parentNode.insertBefore(btn, livrosBtn.nextSibling);
        } else {
          grid.appendChild(btn);
        }
      }

      const topbarBtn = document.getElementById(mod.topbarButtonId);
      if (!topbarBtn && mod.topbarButtonId) {
        const topbarNav = document.getElementById('topbar-nav');
        if (topbarNav) {
          const newBtn = document.createElement('button');
          newBtn.className = 'topbar-nav-item d-none';
          newBtn.id = mod.topbarButtonId;
          newBtn.type = 'button';
          newBtn.textContent = mod.nome;
          topbarNav.appendChild(newBtn);
        }
      }
    });

    registerAllModuleHandlers();
  }

  function registerAllModuleHandlers() {
    Object.values(MODULOS_CONFIG).forEach(mod => {
      const gridBtn = document.getElementById(mod.buttonId);
      if (gridBtn && !gridBtn.dataset.handlerAttached) {
        gridBtn.dataset.handlerAttached = '1';
        gridBtn.addEventListener('click', () => {
          const handler = moduleHandlers[mod.id];
          if (handler) handler();
        });
      }
      const tbarBtn = document.getElementById(mod.topbarButtonId);
      if (tbarBtn && !tbarBtn.dataset.handlerAttached) {
        tbarBtn.dataset.handlerAttached = '1';
        tbarBtn.addEventListener('click', () => {
          const handler = topbarHandlers[mod.id];
          if (handler) handler();
        });
      }
    });

    const adminBtn = document.getElementById('nav-admin');
    if (adminBtn && !adminBtn.dataset.handlerAttached) {
      adminBtn.dataset.handlerAttached = '1';
      adminBtn.addEventListener('click', () => {
        window.location.href = '/admin';
      });
    }
  }

  function getModulesInGridOrder() {
    const grid = document.querySelector('.mode-grid');
    if (!grid) return Object.values(MODULOS_CONFIG).filter(m => m.allowedProfiles);
    const buttons = grid.querySelectorAll('.mode-option-btn');
    const order = [];
    const seen = new Set();
    buttons.forEach(btn => {
      const btnId = btn.id;
      const modulo = Object.values(MODULOS_CONFIG).find(m => m.buttonId === btnId);
      if (modulo && !seen.has(modulo.id)) {
        order.push(modulo);
        seen.add(modulo.id);
      }
    });
    Object.values(MODULOS_CONFIG).forEach(modulo => {
      if (!seen.has(modulo.id)) {
        order.push(modulo);
        seen.add(modulo.id);
      }
    });
    return order;
  }

  function perfilTemAcessoModulo(perfilId, moduloId) {
    if (!perfilId || !moduloId) return false;
    const modulo = MODULOS_CONFIG[moduloId];
    if (!modulo || !Array.isArray(modulo.allowedProfiles)) return false;
    return modulo.allowedProfiles.map(String).includes(String(perfilId));
  }

  function getModulosDisponiveis(perfilId) {
    if (!perfilId) return [];
    return Object.values(MODULOS_CONFIG).filter(m => perfilTemAcessoModulo(perfilId, m.id));
  }

  // =============================================================================

  const state = {
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

  };

  const DRAFT_STORAGE_VERSION = 2;
  const DRAFT_STORAGE_PREFIX = 'conecta_drafts_v2';
  const EDITABLE_DRAFT_MODULES = ['passagem', 'livro', 'escala', 'auditorias'];
  const draftDirtyModules = new Set();
  const draftSaveTimers = new Map();
  const draftHydratingModules = new Set();

  function normalizeDraftKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  }

  function getDraftStorageKey(profileId = state.usuario?.perfilAtivo) {
    const userId = normalizeDraftKey(state.usuario?.nm_usuario || state.usuario?.usuario || state.usuario?.nome);
    const profile = normalizeDraftKey(profileId);
    if (!userId || !profile) return null;
    return `${DRAFT_STORAGE_PREFIX}:${userId}:${profile}`;
  }

  function getDraftDirtyKey(moduleId, profileId = state.usuario?.perfilAtivo) {
    return `${normalizeDraftKey(profileId)}:${moduleId}`;
  }

  function readDraftEnvelope(profileId = state.usuario?.perfilAtivo) {
    const key = getDraftStorageKey(profileId);
    if (!key) return { version: DRAFT_STORAGE_VERSION, modules: {} };
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (parsed?.version === DRAFT_STORAGE_VERSION && parsed.modules && typeof parsed.modules === 'object') {
        return parsed;
      }
    } catch (err) {
      console.warn('Erro ao ler rascunhos da sessão', err);
    }
    return { version: DRAFT_STORAGE_VERSION, modules: {} };
  }

  function writeDraftEnvelope(envelope, profileId = state.usuario?.perfilAtivo) {
    const key = getDraftStorageKey(profileId);
    if (!key) return;
    try {
      if (!envelope.modules || Object.keys(envelope.modules).length === 0) {
        sessionStorage.removeItem(key);
        return;
      }
      sessionStorage.setItem(key, JSON.stringify(envelope));
    } catch (err) {
      console.warn('Erro ao salvar rascunhos da sessão', err);
    }
  }

  function getModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
    return readDraftEnvelope(profileId).modules[moduleId] || null;
  }

  function setModuleDraft(moduleId, payload, profileId = state.usuario?.perfilAtivo) {
    const envelope = readDraftEnvelope(profileId);
    envelope.modules[moduleId] = {
      ...payload,
      updatedAt: new Date().toISOString()
    };
    writeDraftEnvelope(envelope, profileId);
  }

  function clearModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
    const dirtyKey = getDraftDirtyKey(moduleId, profileId);
    const timer = draftSaveTimers.get(dirtyKey);
    if (timer) clearTimeout(timer);
    draftSaveTimers.delete(dirtyKey);
    draftDirtyModules.delete(dirtyKey);

    const envelope = readDraftEnvelope(profileId);
    if (envelope.modules[moduleId]) {
      delete envelope.modules[moduleId];
      writeDraftEnvelope(envelope, profileId);
    }
    updateTopbarDraftIndicators();
  }

  function discardModuleWork(moduleId) {
    clearModuleDraft(moduleId);
    draftHydratingModules.add(moduleId);
    try {
      if (moduleId === 'passagem') {
        resetForm();
      } else if (moduleId === 'livro') {
        clearLivroForm();
      } else if (moduleId === 'escala') {
        state.escalaEdicao = null;
        state.escalaSemanalCells = Object.fromEntries(
          Object.entries(state.escalaSemanalCells || {}).filter(([, escala]) => !escala?.pendente_publicacao)
        );
        state.escalaPsicologiaItens = [];
        const observacoes = document.getElementById('escala-observacoes');
        if (observacoes) observacoes.value = '';
        renderEscalaSemanal();
        atualizarBotaoPublicarEscala();
      }
    } finally {
      draftHydratingModules.delete(moduleId);
      updateTopbarDraftIndicators();
    }
  }

  function hasModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
    return Boolean(getModuleDraft(moduleId, profileId)) || draftDirtyModules.has(getDraftDirtyKey(moduleId, profileId));
  }

  function cloneDraftValue(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  function capturePassagemDraft() {
    const entries = {};
    let hasActualData = false;

    document.querySelectorAll('.intercorrencia-textarea').forEach(textarea => {
      const key = getTextareaKey(textarea);
      if (!key) return;
      if (editorHasContent(textarea)) {
        entries[key] = entries[key] || { text: '', checks: [] };
        entries[key].text = getEditorValue(textarea) || '';
        hasActualData = true;
      }
    });

    document.querySelectorAll('.intercorrencia-checkbox:checked').forEach(checkbox => {
      const atendimento = checkbox.dataset.atendimento;
      const field = checkbox.dataset.field;
      if (!atendimento || !field) return;
      const key = `atendimento_${atendimento}`;
      entries[key] = entries[key] || { text: '', checks: [] };
      entries[key].checks.push(field);
      hasActualData = true;
    });

    if (!hasActualData && (!state.setoresSelecionados || state.setoresSelecionados.length === 0)) {
      return null;
    }

    return {
      setoresSelecionados: [...state.setoresSelecionados],
      cdModulo: state.cdModulo,
      turno: state.turno,
      entries
    };
  }

  function captureLivroDraft() {
    return {
      dataPlantao: document.getElementById('livro-data-plantao')?.value || '',
      turno: document.querySelector('input[name="livro-turno"]:checked')?.value || 'M',
      setorSelecionado: state.livroSetorSelecionado,
      enfermeiroSelecionado: state.livroEnfermeiroSelecionado,
      observacoes: document.getElementById('livro-observacoes')?.value || '',
      tecnicosSelecionados: cloneDraftValue(state.livroTecnicosSelecionados, []),
      faltasFolgas: cloneDraftValue(state.livroFaltasFolgas, []),
      patio: cloneDraftValue(state.livroPatio, []),
      circulante: cloneDraftValue(state.livroCirculante, []),
      avaliacaoExterna: cloneDraftValue(state.livroAvaliacaoExterna, [])
    };
  }

  function captureEscalaDraft() {
    const pendingCells = {};
    Object.entries(state.escalaSemanalCells || {}).forEach(([key, value]) => {
      if (value?.pendente_publicacao) pendingCells[key] = cloneDraftValue(value, null);
    });
    return {
      month: document.getElementById('escala-mes')?.value || '',
      pendingCells,
      editor: cloneDraftValue(state.escalaEdicao, null)
    };
  }

  function captureModuleDraft(moduleId) {
    if (moduleId === 'passagem') return capturePassagemDraft();
    if (moduleId === 'livro') return captureLivroDraft();
    if (moduleId === 'escala') return captureEscalaDraft();
    if (moduleId === 'auditorias') return typeof window.captureAuditoriaDraft === 'function' ? window.captureAuditoriaDraft() : null;
    return null;
  }

  function flushModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
    const dirtyKey = getDraftDirtyKey(moduleId, profileId);
    const timer = draftSaveTimers.get(dirtyKey);
    if (timer) clearTimeout(timer);
    draftSaveTimers.delete(dirtyKey);
    if (!draftDirtyModules.has(dirtyKey)) return;

    const payload = captureModuleDraft(moduleId);
    if (payload) {
      setModuleDraft(moduleId, payload, profileId);
    } else {
      clearModuleDraft(moduleId, profileId);
    }
    draftDirtyModules.delete(dirtyKey);
    updateTopbarDraftIndicators();
  }

  function flushPendingDrafts(profileId = state.usuario?.perfilAtivo) {
    EDITABLE_DRAFT_MODULES.forEach(moduleId => flushModuleDraft(moduleId, profileId));
  }

  function markModuleDraftDirty(moduleId) {
    if (!EDITABLE_DRAFT_MODULES.includes(moduleId) || draftHydratingModules.has(moduleId)) return;
    const profileId = state.usuario?.perfilAtivo;
    if (!profileId) return;

    const dirtyKey = getDraftDirtyKey(moduleId, profileId);
    draftDirtyModules.add(dirtyKey);
    const previousTimer = draftSaveTimers.get(dirtyKey);
    if (previousTimer) clearTimeout(previousTimer);
    draftSaveTimers.set(dirtyKey, setTimeout(() => {
      if (String(state.usuario?.perfilAtivo) === String(profileId)) {
        flushModuleDraft(moduleId, profileId);
      }
    }, 250));
    updateTopbarDraftIndicators();
  }

  function updateTopbarDraftIndicators() {
    if (!state.usuario?.perfilAtivo) return;
    EDITABLE_DRAFT_MODULES.forEach(moduleId => {
      const modulo = MODULOS_CONFIG[moduleId];
      const button = modulo ? document.getElementById(modulo.topbarButtonId) : null;
      if (!button) return;
      const hasDraft = hasModuleDraft(moduleId);
      button.classList.toggle('has-draft', hasDraft);
      button.classList.toggle('active-has-draft', hasDraft && button.classList.contains('active'));
      button.title = hasDraft ? `${modulo.nome} — rascunho não liberado` : modulo.nome;
      button.setAttribute('aria-label', hasDraft ? `${modulo.nome}. Rascunho não liberado.` : modulo.nome);
    });
  }

  function initializeDraftSession() {
    const profileId = state.usuario?.perfilAtivo;
    if (!profileId) return;

    const existingDraft = getModuleDraft('passagem', profileId);
    if (!existingDraft) {
      try {
        const legacyTexts = JSON.parse(sessionStorage.getItem('conecta_savedTexts') || 'null');
        const legacySetores = JSON.parse(sessionStorage.getItem('conecta_setoresSelecionados') || 'null');
        if ((legacyTexts && Object.keys(legacyTexts).length) || (Array.isArray(legacySetores) && legacySetores.length)) {
          const entries = {};
          Object.entries(legacyTexts || {}).forEach(([key, text]) => {
            entries[key] = { text: String(text || ''), checks: [] };
          });
          setModuleDraft('passagem', {
            setoresSelecionados: Array.isArray(legacySetores) ? legacySetores : [],
            cdModulo: null,
            turno: null,
            entries
          }, profileId);
        }
      } catch (err) {
        console.warn('Erro ao migrar rascunho legado', err);
      }
    }
    sessionStorage.removeItem('conecta_savedTexts');
    sessionStorage.removeItem('conecta_setoresSelecionados');
    updateTopbarDraftIndicators();
  }

  const CHECKBOX_INTERCORRENCIAS = [
    { field: 'acompanhante', label: 'Acompanhante' },
    { field: 'broncoaspiracao', label: 'Broncoaspiração' },
    { field: 'contencao', label: 'Contenção' },
    { field: 'heteroautoagressao', label: 'Heteroagressão/Autoagressão' },
    { field: 'jejum', label: 'Jejum' },
    { field: 'lesao', label: 'Lesão' },
    { field: 'queda', label: 'Queda' },
    { field: 'tae', label: 'TAE' },
    { field: 'riscofuga', label: 'Risco de Fuga' }
  ];

  const CHECKBOX_INTERCORRENCIAS_MAP = new Map(
    CHECKBOX_INTERCORRENCIAS.map(item => [item.field, item.label])
  );

  const DASHBOARD_ETIQUETAS = [
    { key: 'medicacao_agora', label: 'Prescrição de Agora', color: 'red' },
    { key: 'medicacao_suspensa', label: 'Medicação Suspensa', color: 'orange' },
    { key: 'material_agora', label: 'Material de Agora', color: 'orange' },
    { key: 'checagem_pendente', label: 'Checagem Pendente', color: 'yellow' },
    { key: 'contencao_sn', label: 'Contenção SN', color: 'blue' },
    { key: 'alta_medica_programada', label: 'Alta Médica Liberada', color: 'green' },
    { key: 'sem_alertas', label: 'Sem alertas', color: 'neutral' }
  ];

  const DASHBOARD_ETIQUETAS_MAP = new Map(
    DASHBOARD_ETIQUETAS.map(item => [item.key, item])
  );

  const DASHBOARD_PA_ETIQUETAS = [
    { key: 'particulares_alta', label: 'Particulares com Alta', color: 'orange', icon: 'bi-person-badge' },
    { key: 'alta_medica', label: 'Alta Médica', color: 'green', icon: 'bi-file-earmark-medical' },
    { key: 'sala_observacao', label: 'Sala de Observação', color: 'blue', icon: 'bi-eye' },
    { key: 'indicacao_internacao', label: 'Indicação de Internação', color: 'red', icon: 'bi-hospital' },
    { key: 'decididos', label: 'Decididos', color: 'neutral', icon: 'bi-check2-all' }
  ];

  const api = {

    async post(url, data) {

      const res = await fetch(url, {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(data)

      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw { message: json?.message || `HTTP ${res.status}`, status: res.status, data: json };
      }

      return json;

    },

    async get(url) {

      const res = await fetch(url, {

        credentials: 'include'

      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw { message: json?.message || `HTTP ${res.status}`, status: res.status, data: json };
      }

      return json;

    },

    async put(url, data) {

      const res = await fetch(url, {

        method: 'PUT',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(data)

      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw { message: json?.message || `HTTP ${res.status}`, status: res.status, data: json };
      }

      return json;

    }

  };



  function showToast(message, type = 'info') {

    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {

      toast.classList.add('removing');

      setTimeout(() => toast.remove(), 300);

    }, 3500);

  }



  function showModal(type, title, message) {

    return new Promise(resolve => {

      const overlay = document.getElementById('modal-overlay');

      const iconEl = document.getElementById('modal-icon');

      const titleEl = document.getElementById('modal-title');

      const msgEl = document.getElementById('modal-message');



      iconEl.className = 'modal-icon ' + type;

      // Limpar estilos inline residuais
      iconEl.style.color = '';
      iconEl.style.background = '';
      
      if (type === 'success') {
         iconEl.innerHTML = '<i class="bi bi-check-lg"></i>';
      } else if (type === 'warning') {
         iconEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
      } else {
         iconEl.innerHTML = '<i class="bi bi-x-lg"></i>';
      }

      titleEl.textContent = title;

      msgEl.textContent = message;

      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');

      const close = () => {

        overlay.classList.add('d-none');
        document.body.classList.remove('modal-open');
        msgEl.innerHTML = '';

        resolve();

      };

      document.getElementById('modal-close').onclick = close;

      overlay.onclick = e => { if (e.target === overlay) close(); };

    });

  }



  // ── Rich Text Editor Helpers ──────────────────────────────────────────────

  function getEditorValue(el) {
    return el.isContentEditable ? el.innerHTML : el.value;
  }

  function setEditorValue(el, val) {
    if (el.isContentEditable) el.innerHTML = val || '';
    else el.value = val || '';
  }

  function editorHasContent(el) {
    if (!el) return false;
    if (el.isContentEditable) {
      const text = (el.innerText || el.textContent || '')
        .replace(/[\u00a0\u200B\uFEFF\s\r\n]+/g, '')
        .trim();
      if (text.length > 0) return true;
      const hasMedia = el.querySelector('img, table, video, audio');
      return Boolean(hasMedia);
    }
    return (el.value || '').trim() !== '';
  }

  function getEditorHtmlForSave(el) {
    if (!el) return '';
    if (!editorHasContent(el)) return '';
    if (!el.isContentEditable) return el.value.trim();
    const inner = el.innerHTML.trim();
    return `<html tasy="html5"><body>${inner}</body></html>`;
  }

  function buildFormattingToolbar() {
    return `<div class="intercorrencia-toolbar" role="toolbar" aria-label="Opções de formatação">
      <button type="button" class="fmt-btn" data-fmt="bold" title="Negrito"><i class="bi bi-type-bold"></i></button>
      <button type="button" class="fmt-btn" data-fmt="italic" title="Itálico"><i class="bi bi-type-italic"></i></button>
      <button type="button" class="fmt-btn" data-fmt="underline" title="Sublinhado"><i class="bi bi-type-underline"></i></button>
      <span class="fmt-divider"></span>
      <div class="fmt-color-group" data-type="foreColor" title="Cor do texto">
        <button type="button" class="fmt-btn fmt-color-toggle"><i class="bi bi-fonts"></i><span class="fmt-color-swatch" style="background:#dc2626"></span></button>
        <div class="fmt-color-picker d-none">
          <button type="button" class="fmt-color-dot" data-color="#dc2626" style="background:#dc2626" title="Vermelho"></button>
          <button type="button" class="fmt-color-dot" data-color="#2563eb" style="background:#2563eb" title="Azul"></button>
          <button type="button" class="fmt-color-dot" data-color="#16a34a" style="background:#16a34a" title="Verde"></button>
          <button type="button" class="fmt-color-dot" data-color="#d97706" style="background:#d97706" title="Laranja"></button>
          <button type="button" class="fmt-color-dot" data-color="#333333" style="background:#333333" title="Preto"></button>
          <button type="button" class="fmt-color-dot fmt-color-remove" data-color="remove" title="Remover cor"><i class="bi bi-x"></i></button>
        </div>
      </div>
      <div class="fmt-color-group" data-type="backColor" title="Cor de fundo">
        <button type="button" class="fmt-btn fmt-color-toggle"><i class="bi bi-paint-bucket"></i><span class="fmt-color-swatch" style="background:#fef08a"></span></button>
        <div class="fmt-color-picker d-none">
          <button type="button" class="fmt-color-dot" data-color="#fef08a" style="background:#fef08a" title="Amarelo"></button>
          <button type="button" class="fmt-color-dot" data-color="#bbf7d0" style="background:#bbf7d0" title="Verde claro"></button>
          <button type="button" class="fmt-color-dot" data-color="#bfdbfe" style="background:#bfdbfe" title="Azul claro"></button>
          <button type="button" class="fmt-color-dot" data-color="#fecaca" style="background:#fecaca" title="Vermelho claro"></button>
          <button type="button" class="fmt-color-dot fmt-color-remove" data-color="remove" title="Remover destaque"><i class="bi bi-x"></i></button>
        </div>
      </div>
    </div>`;
  }

  function bindFormattingToolbar(toolbar, editor) {
    toolbar.querySelectorAll('.fmt-btn[data-fmt]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        editor.focus();
        document.execCommand(btn.dataset.fmt, false, null);
        updateToolbarActiveState(toolbar);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    toolbar.querySelectorAll('.fmt-color-toggle').forEach(toggle => {
      toggle.addEventListener('mousedown', e => {
        e.preventDefault();
        const group = toggle.closest('.fmt-color-group');
        const picker = group.querySelector('.fmt-color-picker');
        document.querySelectorAll('.fmt-color-picker').forEach(p => {
          if (p !== picker) p.classList.add('d-none');
        });
        picker.classList.toggle('d-none');
      });
    });

    toolbar.querySelectorAll('.fmt-color-dot').forEach(dot => {
      dot.addEventListener('mousedown', e => {
        e.preventDefault();
        const group = dot.closest('.fmt-color-group');
        const type = group.dataset.type;
        const color = dot.dataset.color;
        editor.focus();
        if (color === 'remove') {
          if (type === 'foreColor') document.execCommand('removeFormat', false, null);
          else document.execCommand('backColor', false, 'transparent');
        } else {
          document.execCommand(type, false, color);
          const swatch = group.querySelector('.fmt-color-swatch');
          if (swatch) swatch.style.background = color;
        }
        group.querySelector('.fmt-color-picker').classList.add('d-none');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    editor.addEventListener('keyup', () => updateToolbarActiveState(toolbar));
    editor.addEventListener('mouseup', () => updateToolbarActiveState(toolbar));
    editor.addEventListener('focus', () => updateToolbarActiveState(toolbar));
  }

  function updateToolbarActiveState(toolbar) {
    ['bold', 'italic', 'underline'].forEach(fmt => {
      const btn = toolbar.querySelector(`[data-fmt="${fmt}"]`);
      if (btn) btn.classList.toggle('active', document.queryCommandState(fmt));
    });
  }

  // Fecha color pickers ao clicar fora
  document.addEventListener('click', e => {
    if (!e.target.closest('.fmt-color-group')) {
      document.querySelectorAll('.fmt-color-picker').forEach(p => p.classList.add('d-none'));
    }
  }, true);

  // ─────────────────────────────────────────────────────────────────────────

  function setLoading(btn, loading) {

    const text = btn.querySelector('.btn-text');

    const loader = btn.querySelector('.btn-loader');

    if (loading) {

      btn.disabled = true;

      if (text) text.classList.add('d-none');

      if (loader) loader.classList.remove('d-none');

    } else {

      btn.disabled = false;

      if (text) text.classList.remove('d-none');

      if (loader) loader.classList.add('d-none');

    }

  }



  function getTodayIsoDate() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  function escapeHtml(text) {

    return String(text || '')

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');

  }

  function renderNomeCivilPaciente(paciente) {
    const nomeCivil = String(paciente?.nome_civil || '').trim();
    return nomeCivil ? `<span class="paciente-nome-civil">${escapeHtml(nomeCivil)}</span>` : '';
  }

  function getPacienteInitials(nome) {
    const initials = String(nome || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(item => item[0])
      .join('')
      .toUpperCase();

    return initials || '-';
  }

  let livroRowSequence = 1;

  function nextLivroRowKey(prefix) {
    livroRowSequence += 1;
    return `${prefix}_${livroRowSequence}`;
  }

  function getLivroSetorLabel(cdSetor) {
    const setor = state.livroSetores.find(item => Number(item.cd_setor_atendimento) === Number(cdSetor));
    return setor ? setor.ds_setor_atendimento : `Setor ${cdSetor}`;
  }

  function getTecnicoLabel(tecnico) {
    return tecnico?.nome || tecnico?.nm_usuario || '-';
  }

  function getEnfermeiroLabel(enfermeiro) {
    return enfermeiro?.nome || enfermeiro?.nm_usuario || '-';
  }

  function getEscalaTurnoSelecionado() {
    const selected = document.querySelector('input[name="livro-turno"]:checked');
    if (!selected) return null;
    return selected.value === 'N' ? 'N' : 'M';
  }

  function getLivroDataSelecionada() {
    return document.getElementById('livro-data-plantao').value || getTodayIsoDate();
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }



  function getSelectedSetoresData() {

    return state.setores.filter(s => state.setoresSelecionados.includes(Number(s.cd_setor_atendimento)));

  }

  function updatePassagemContext() {
    const btnSalvar = document.getElementById('btn-salvar');
    if (btnSalvar) {
      if (temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
         btnSalvar.innerHTML = '<i class="bi bi-check-circle"></i> Salvar / Finalizar Passagem';
      } else {
         btnSalvar.innerHTML = '<i class="bi bi-check-circle"></i> Finalizar Passagem';
      }
    }

    const context = document.getElementById('passagem-context');
    if (!context) return;

    const setores = getSelectedSetoresData()
      .map(setor => setor.ds_setor_atendimento)
      .filter(Boolean);

    if (!setores.length) {
      context.textContent = 'Selecione o setor e o turno para carregar os pacientes.';
      return;
    }

    context.textContent = setores.length === 1
      ? `Setor: ${setores[0]}`
      : `${setores.length} setores selecionados`;
  }



  function getTextareaKey(ta) {

    if (ta.dataset.atendimento) return `atendimento_${ta.dataset.atendimento}`;

    if (ta.dataset.setor) return `setor_${ta.dataset.setor}`;

    return null;

  }



  function saveTextsBeforeRender() {
    document.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
      const key = getTextareaKey(ta);
      if (key) {
        if (editorHasContent(ta)) {
          state.savedTexts[key] = getEditorValue(ta);
        } else {
          delete state.savedTexts[key];
        }
      }
    });
  }

  function restoreTextsAfterRender() {
    document.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
      const key = getTextareaKey(ta);
      if (key && state.savedTexts[key]) {
        setEditorValue(ta, state.savedTexts[key]);
        ta.classList.add('has-text');
      }
    });
  }

  function bindTextareaEvents(container) {
    container.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
      ta.addEventListener('input', () => {
        const hasContent = editorHasContent(ta);
        ta.classList.toggle('has-text', hasContent);

        const key = getTextareaKey(ta);
        if (key) {
          if (hasContent) {
            state.savedTexts[key] = getEditorValue(ta);
          } else {
            delete state.savedTexts[key];
          }
        }

        updateFooter();
        markModuleDraftDirty('passagem');
      });

      // Bind the formatting toolbar for contenteditable editors
      if (ta.isContentEditable) {
        const wrap = ta.closest('.intercorrencia-editor-wrap');
        const toolbar = wrap && wrap.querySelector('.intercorrencia-toolbar');
        if (toolbar) bindFormattingToolbar(toolbar, ta);
      }

    });

  }



  function bindCheckboxEvents(container) {

    container.querySelectorAll('.intercorrencia-checkbox').forEach(cb => {

      cb.addEventListener('change', () => {

        updateFooter();
        markModuleDraftDirty('passagem');

      });

    });

  }

  function renderCheckboxesIntercorrencia(atendimento) {
    const itensAutorizados = CHECKBOX_INTERCORRENCIAS.filter(item => {
      return temPermissaoAtiva('passagem', `campo_${item.field}`) || temPermissaoAtiva('passagem', item.field);
    });

    if (itensAutorizados.length === 0) return '';

    return `<div class="checkboxes-grid">${itensAutorizados
      .map(item => `<label class="checkbox-label"><span>${item.label}</span><input type="checkbox" class="intercorrencia-checkbox" data-field="${item.field}" data-atendimento="${atendimento}"></label>`)
      .join('')}</div>`;
  }



  function showScreen(name) {

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const target = document.getElementById(`screen-${name}`);

    if (target) target.classList.add('active');

  }



  function updateProfileLabels() {
    const subtitle = document.getElementById('app-subtitle');
    if (subtitle) subtitle.textContent = 'Integrações Assistenciais';

    const profileLabel = document.getElementById('user-profile-label');
    if (profileLabel) {
      const perfilAtualObj = state.usuario?.perfisDisponiveis?.find(
        p => String(p.id) === String(state.usuario?.perfilAtivo)
      );
      const labels = {
        enfermagem: 'Enfermagem',
        psicologia: 'Psicologia',
        tecnico_enfermagem: 'Técnico de Enfermagem'
      };
      profileLabel.textContent = perfilAtualObj?.nome || labels[state.usuario?.perfilAtivo] || 'Perfil assistencial';
    }
  }


  const modeSelector = document.getElementById('mode-selector');

  const livroSubMenu = document.getElementById('livro-sub-menu');

  const passagemSubMenu = document.getElementById('passagem-sub-menu');

  const workspacePassagensAnteriores = document.getElementById('workspace-passagens-anteriores');

  const workspacePrint = document.getElementById('workspace-print');

  const workspacePassagem = document.getElementById('workspace-passagem');

  const workspaceLivro = document.getElementById('workspace-livro');

  const workspaceDashboard = document.getElementById('workspace-dashboard');

  const workspaceDashboardInternacao = document.getElementById('workspace-dashboard-internacao');

  const setorSelect = document.getElementById('setor-select');

  const dashboardSetorSelect = document.getElementById('dashboard-setor');

  const DASHBOARD_REFRESH_MS = 30000;

  let modeTransitionSeq = 0;
  let profileChangeSeq = 0;
  let activeProfileChangePromise = null;

  function hideAllAppSections() {
    document.querySelectorAll('#screen-app > section, #screen-app > .app-container').forEach(el => el.classList.add('d-none'));
  }

  function activateWorkspace(mode, target) {
    flushPendingDrafts();
    modeTransitionSeq += 1;
    stopDashboardRefresh();
    stopDashboardPARefresh();
    closeSidebarOverlay(false);
    state.mode = mode;
    
    const activeModule = getActiveModuleConfig();
    if (activeModule) {
      state.lastModuleState[activeModule.id] = mode;
    }

    hideAllAppSections();
    target?.classList.remove('d-none');
    configureTopbarByMode();
    return modeTransitionSeq;
  }

  function isCurrentWorkspace(transitionId, mode) {
    return modeTransitionSeq === transitionId && state.mode === mode;
  }



  function temAcessoEnfermagem() {

    return Boolean(state.usuario?.acesso_enfermagem);

  }

  function temAcessoPsicologia() {

    return Boolean(state.usuario?.acesso_psicologia);

  }

  function temAcessoTecnicoEnfermagem() {

    return Boolean(state.usuario?.acesso_tecnico_enfermagem);

  }

  function temMultiplosPerfis() {

    const perfis = Array.isArray(state.usuario?.perfisDisponiveis) ? state.usuario.perfisDisponiveis : [];

    return perfis.length > 1;

  }

  function canAccessLivro() {
    return perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'livro');
  }

  function canAccessDashboard() {
    return perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'dashboard');
  }

  function canAccessDashboardInternacao() {
    return perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'dashboard_pa');
  }

  function canAccessPassagem() {
    return perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'passagem');
  }

  function canAccessEscala() {
    return perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'escala');
  }

  function getActiveModuleConfig() {
    return Object.values(MODULOS_CONFIG).find(modulo => modulo.activeModes.includes(state.mode)) || null;
  }

  function shouldShowModeSelector() {
    const perfilAtivo = state.usuario?.perfilAtivo;
    if (!perfilAtivo) return false;
    return getModulosDisponiveis(perfilAtivo).length > 0;
  }



  function reorderTopbarByGrid() {
    const topbarNav = document.getElementById('topbar-nav');
    if (!topbarNav) return;
    const modules = getModulesInGridOrder();
    modules.forEach(modulo => {
      const btn = document.getElementById(modulo.topbarButtonId);
      if (btn) topbarNav.appendChild(btn);
    });
  }

  function configureTopbarByMode() {
    const topbarNav = document.getElementById('topbar-nav');
    const modules = getModulesInGridOrder();
    const perfilAtivo = state.usuario?.perfilAtivo;

    topbarNav?.classList.toggle('d-none', !perfilAtivo);
    modules.forEach(modulo => {
      const button = document.getElementById(modulo.topbarButtonId);
      if (!button) return;
      const hasAccess = perfilAtivo ? perfilTemAcessoModulo(perfilAtivo, modulo.id) : false;
      button.classList.toggle('d-none', !hasAccess);
      const isActive = modulo.activeModes.includes(state.mode);
      button.classList.toggle('active', isActive);
      if (isActive) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    reorderTopbarByGrid();

    const activeModule = getActiveModuleConfig();
    modules.forEach(modulo => {
      const button = document.getElementById(modulo.topbarButtonId);
      if (!button) return;
      button.classList.toggle('topbar-nav-active', modulo === activeModule && state.mode);
      button.querySelectorAll('.topbar-module-close').forEach(el => el.remove());
      if (modulo === activeModule && state.mode) {
        const close = document.createElement('span');
        close.className = 'topbar-module-close';
        close.setAttribute('role', 'button');
        close.setAttribute('tabindex', '0');
        close.setAttribute('aria-label', `Fechar ${modulo.nome}`);
        close.innerHTML = '<i class="bi bi-x"></i>';
        const closeHandler = event => {
          event.preventDefault();
          event.stopPropagation();
          discardModuleWork(modulo.id);
          showModeChooser();
        };
        close.addEventListener('click', closeHandler);
        close.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') closeHandler(event);
        });
        button.appendChild(close);
      }
    });

    const adminBtn = document.getElementById('nav-admin');
    if (adminBtn) {
      const gruposAd = state.usuario?.grupos_ad || [];
      const isAdmin = gruposAd.some(g => String(g || '').trim().toUpperCase() === 'API_CONECTA_ADMIN');
      adminBtn.classList.toggle('d-none', !isAdmin);
    }

    const modeContext = document.getElementById('mode-context');
    if (modeContext && state.mode === null) {
      const now = new Date();
      const turno = getDashboardLocalTurno(now);
      const data = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      });
      modeContext.textContent = `${turno} • ${data}`;
    }

    updateTopbarDraftIndicators();
  }

  function showModeChooser() {
    activateWorkspace(null, modeSelector);

    const perfilAtivo = state.usuario?.perfilAtivo;

    Object.values(MODULOS_CONFIG).forEach(modulo => {
      const el = document.getElementById(modulo.buttonId);
      if (!el) return;
      const hasAccess = perfilAtivo ? perfilTemAcessoModulo(perfilAtivo, modulo.id) : false;
      el.classList.toggle('d-none', !hasAccess);
    });
  }

  window.conectaApp = {
    activateWorkspace,
    showModeChooser,
    getModuleDraft,
    markModuleDraftDirty
  };



  async function enterPassagemMode() {
    if (activeProfileChangePromise) {
      await activeProfileChangePromise;
    }

    if (!canAccessPassagem()) {
      showToast('Passagem de Plantão indisponível para o perfil ativo', 'warning');
      showModeChooser();
      return;
    }

    renderTurnoOptions();

    const transitionId = activateWorkspace('passagem', workspacePassagem);
    await loadSetores(transitionId);
    if (isCompactSidebarViewport()) {
      openSidebarOverlay();
    }

  }

  function renderTurnoOptions() {
    const labelDinamico = document.getElementById('turno-label-dinamico');
    const optionsDinamico = document.getElementById('turno-options-dinamico');
    if (!labelDinamico || !optionsDinamico) return;

    const isPeriodo = temPermissaoAtiva('passagem', 'modelo_periodo');
    
    if (isPeriodo) {
      labelDinamico.innerHTML = '<i class="bi bi-clock-history"></i> Período: <span class="required-star">*</span>';
      optionsDinamico.innerHTML = `
        <label class="turno-option">
          <input type="radio" name="turno" value="3">
          <span class="turno-btn"><i class="bi bi-brightness-alt-high"></i> Manhã</span>
        </label>
        <label class="turno-option">
          <input type="radio" name="turno" value="4">
          <span class="turno-btn"><i class="bi bi-sun"></i> Tarde</span>
        </label>
        <label class="turno-option">
          <input type="radio" name="turno" value="5">
          <span class="turno-btn"><i class="bi bi-moon"></i> Noite</span>
        </label>
      `;
    } else {
      labelDinamico.innerHTML = '<i class="bi bi-clock-history"></i> Plantão: <span class="required-star">*</span>';
      optionsDinamico.innerHTML = `
        <label class="turno-option">
          <input type="radio" name="turno" value="1">
          <span class="turno-btn"><i class="bi bi-sun"></i> Diurno</span>
        </label>
        <label class="turno-option">
          <input type="radio" name="turno" value="2">
          <span class="turno-btn"><i class="bi bi-moon"></i> Noturno</span>
        </label>
      `;
    }

    // Re-attach listeners to the new radios
    document.querySelectorAll('input[name="turno"]').forEach(radio => {
      radio.addEventListener('change', () => {
        state.turno = parseInt(radio.value, 10);
        updateFooter();
        markModuleDraftDirty('passagem');
      });
      // Restore checked state if a draft was loaded
      if (state.turno && parseInt(radio.value, 10) === state.turno) {
        radio.checked = true;
      }
    });
  }

  function temPermissaoAtiva(moduloId, permissao) {
    return Array.isArray(state.usuario?.permissoesAtivas?.[moduloId])
      && state.usuario.permissoesAtivas[moduloId].includes(permissao);
  }

  function showPassagemSubMenu() {
    if (!canAccessPassagem()) {
      showToast('Passagem de Plantão indisponível para o perfil ativo', 'warning');
      showModeChooser();
      return;
    }
    activateWorkspace('passagem-submenu', passagemSubMenu);
    const btnLancar = document.getElementById('btn-passagem-lancar');
    const podeLancar = temPermissaoAtiva('passagem', 'lancar_nova_passagem');
    btnLancar?.classList.toggle('d-none', !podeLancar);
  }

  function getDashboardLocalTurno(date = new Date()) {

    const hour = date.getHours();

    return hour >= 7 && hour < 19 ? 'Diurno' : 'Noturno';

  }

  function formatDashboardDate(date = new Date()) {

    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace('.', '');

  }

  function updateDashboardClock(turno) {

    const now = new Date();

    const timeEl = document.getElementById('dashboard-clock-time');

    const dateEl = document.getElementById('dashboard-clock-date');

    const turnoEl = document.getElementById('dashboard-turno-label');

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    if (dateEl) {
      dateEl.textContent = formatDashboardDate(now);
    }

    if (turnoEl) {
      turnoEl.textContent = turno?.descricao || getDashboardLocalTurno(now);
    }

  }

  function startDashboardClock(turno) {

    if (state.dashboardClockTimer) {
      clearInterval(state.dashboardClockTimer);
    }

    updateDashboardClock(turno);

    state.dashboardClockTimer = setInterval(() => updateDashboardClock(turno), 1000);

  }

function stopDashboardRefresh() {

    if (state.dashboardTimer) {
      clearInterval(state.dashboardTimer);
      state.dashboardTimer = null;
    }

    if (state.dashboardClockTimer) {
      clearInterval(state.dashboardClockTimer);
      state.dashboardClockTimer = null;
    }

  }

  function stopDashboardPARefresh() {

    if (state.dashboardPATimer) {
      clearInterval(state.dashboardPATimer);
      state.dashboardPATimer = null;
    }

    if (state.dashboardPAClockTimer) {
      clearInterval(state.dashboardPAClockTimer);
      state.dashboardPAClockTimer = null;
    }

  }

  function startDashboardRefresh() {

    if (state.dashboardTimer) {
      clearInterval(state.dashboardTimer);
    }

    if (!state.dashboardSetorSelecionado) {
      state.dashboardTimer = null;
      return;
    }

    state.dashboardTimer = setInterval(() => {
      loadDashboardPacientes(false);
    }, DASHBOARD_REFRESH_MS);

  }

  function setDashboardFeedback(message, icon = 'bi-info-circle', type = 'info') {

    const feedback = document.getElementById('dashboard-feedback');

    if (!feedback) return;

    feedback.className = `dashboard-feedback dashboard-feedback-${type}`;

    feedback.innerHTML = `<i class="bi ${icon}"></i><span>${escapeHtml(message)}</span>`;

    feedback.classList.remove('d-none');

  }

  function hideDashboardFeedback() {

    document.getElementById('dashboard-feedback')?.classList.add('d-none');

  }

  function buildDashboardResumo(pacientes = []) {
    const etiquetasEmUso = getDashboardEtiquetasEmUso(pacientes);
    const etiquetas = DASHBOARD_ETIQUETAS
      .map(item => ({
        ...item,
        total: etiquetasEmUso.get(item.key) || 0
      }))
      .filter(item => item.total > 0);

    return {
      total: pacientes.length,
      etiquetas
    };
  }

  function updateDashboardStats(resumo = {}) {
    const statsContainer = document.getElementById('dashboard-stats-cards');
    if (!statsContainer) return;

    if (!state.dashboardSetorSelecionado) {
      statsContainer.innerHTML = '';
      return;
    }

    const total = Number(resumo.total) || 0;
    const etiquetas = Array.isArray(resumo.etiquetas) ? resumo.etiquetas : [];
    const isSemFiltro = state.dashboardFiltroEtiquetas.size === 0;

    const cards = [
      {
        key: 'all',
        label: 'Total Pacientes',
        total,
        color: 'primary',
        active: isSemFiltro
      },
      ...etiquetas.map(item => ({
        key: item.key,
        label: item.label,
        total: item.total,
        color: item.color,
        active: state.dashboardFiltroEtiquetas.has(item.key)
      }))
    ];

    statsContainer.innerHTML = cards.map(card => `
      <button class="dashboard-stat dashboard-stat-${card.color}${card.active ? ' active' : ''}" type="button" data-tag="${escapeHtml(card.key)}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.total)}</strong>
      </button>
    `).join('');
  }

  function updateDashboardLastUpdate(value) {

    const el = document.getElementById('dashboard-last-update');

    if (!el) return;

    if (!value) {
      el.textContent = 'Aguardando setor...';
      return;
    }

    const date = new Date(value);

    el.textContent = `Atualizado: ${date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;

  }

  function renderDashboardSetorSelect() {

    if (!dashboardSetorSelect) return;

    if (!state.dashboardSetores.length) {
      dashboardSetorSelect.innerHTML = '<option value="">Nenhum setor disponível</option>';
      dashboardSetorSelect.disabled = true;
      return;
    }

    dashboardSetorSelect.innerHTML = '<option value="">Selecione o setor...</option>';

    state.dashboardSetores.forEach(setor => {
      const option = document.createElement('option');
      option.value = String(setor.cd_setor_atendimento);
      option.textContent = setor.ds_setor_atendimento;
      dashboardSetorSelect.appendChild(option);
    });

    dashboardSetorSelect.disabled = false;

    if (state.dashboardSetorSelecionado) {
      dashboardSetorSelect.value = String(state.dashboardSetorSelecionado);
    }

  }

  async function loadDashboardSetores(transitionId = modeTransitionSeq) {

    if (!dashboardSetorSelect) return;

    dashboardSetorSelect.disabled = true;

    setDashboardFeedback('Carregando setores...', 'bi-arrow-repeat spin', 'loading');

    try {
      const result = await api.get('/api/setores-internacao?modulo=dashboard');

      if (!isCurrentWorkspace(transitionId, 'dashboard')) return;

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar setores');
      }

      const previousSetor = Number(state.dashboardSetorSelecionado);
      state.dashboardSetores = Array.isArray(result.data) ? result.data : [];

      const hasPrevious = state.dashboardSetores.some(
        setor => Number(setor.cd_setor_atendimento) === previousSetor
      );

      if (state.dashboardSetores.length === 1) {
        state.dashboardSetorSelecionado = Number(state.dashboardSetores[0].cd_setor_atendimento);
      } else if (!hasPrevious) {
        state.dashboardSetorSelecionado = null;
      }

      renderDashboardSetorSelect();

      if (state.dashboardSetorSelecionado) {
        await loadDashboardPacientes(true, transitionId);
      } else {
        state.dashboardPacientes = [];
        state.dashboardFiltroEtiquetas = new Set();
        state.dashboardResumo = buildDashboardResumo([]);
        document.getElementById('dashboard-pacientes-grid').innerHTML = '';
        updateDashboardStats(state.dashboardResumo);
        updateDashboardLastUpdate(null);
        setDashboardFeedback('Selecione um setor para visualizar os pacientes.', 'bi-building', 'info');
      }
    } catch (err) {
      if (!isCurrentWorkspace(transitionId, 'dashboard')) return;
      state.dashboardSetores = [];
      state.dashboardPacientes = [];
      state.dashboardFiltroEtiquetas = new Set();
      state.dashboardResumo = buildDashboardResumo([]);
      renderDashboardSetorSelect();
      updateDashboardStats(state.dashboardResumo);
      setDashboardFeedback(err.message || 'Erro ao carregar setores', 'bi-exclamation-triangle', 'error');
    }

}

  function getDashboardStatusFlags(paciente = {}) {
    const medicacaoSuspensa = Number(paciente.medicacao_suspensa) > 0;
    const medicacaoAgora = Number(paciente.medicacao_agora) > 0;

    return {
      medicacao_agora: medicacaoAgora,
      medicacao_suspensa: medicacaoSuspensa,
      material_agora: Number(paciente.material_agora) > 0,
      checagem_pendente: Number(paciente.checagem_pendente) > 0,
      contencao_sn: Number(paciente.contencao_sn) > 0,
      alta_medica_programada: Number(paciente.alta_medica_programada) > 0
    };
  }

  function getDashboardTagKeys(status = {}) {
    const tags = [];
    if (status.medicacao_agora) tags.push('medicacao_agora');
    if (status.medicacao_suspensa) tags.push('medicacao_suspensa');
    if (status.material_agora) tags.push('material_agora');
    if (status.checagem_pendente) tags.push('checagem_pendente');
    if (status.contencao_sn) tags.push('contencao_sn');
    if (status.alta_medica_programada) tags.push('alta_medica_programada');
    return tags.length ? tags : ['sem_alertas'];
  }

  function getDashboardEtiquetasEmUso(pacientes = []) {
    const contador = new Map();
    pacientes.forEach(paciente => {
      const tags = getDashboardTagKeys(getDashboardStatusFlags(paciente));
      tags.forEach(tag => {
        contador.set(tag, (contador.get(tag) || 0) + 1);
      });
    });
    return contador;
  }

  function syncDashboardTagFilters() {
    const emUso = getDashboardEtiquetasEmUso(state.dashboardPacientes);
    state.dashboardFiltroEtiquetas.forEach(tag => {
      if (!emUso.has(tag)) {
        state.dashboardFiltroEtiquetas.delete(tag);
      }
    });
  }

  function getDashboardPacientesFiltrados() {
    if (!state.dashboardFiltroEtiquetas.size) {
      return state.dashboardPacientes;
    }

    return state.dashboardPacientes.filter(paciente => {
      const tagsPaciente = getDashboardTagKeys(getDashboardStatusFlags(paciente));
      return tagsPaciente.some(tag => state.dashboardFiltroEtiquetas.has(tag));
    });
  }

  function renderDashboardBadges(paciente = {}, status = {}) {
    const badges = [];
    const prescricoesAgora = Array.isArray(paciente.prescricoes_agora)
      ? paciente.prescricoes_agora.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    
    if (status.medicacao_agora) {
      badges.push({
        color: 'red',
        label: 'Prescrição de Agora',
        tooltip: prescricoesAgora.length
          ? `Prescrições de Agora: ${prescricoesAgora.join(' | ')}`
          : ''
      });
    }
    if (status.medicacao_suspensa) {
      badges.push({ color: 'orange', label: 'Medicação Suspensa' });
    }
    if (status.material_agora) {
      badges.push({ color: 'orange', label: 'Material de Agora' });
    }
    if (status.checagem_pendente) {
      badges.push({ color: 'yellow', label: 'Checagem Pendente' });
    }
    if (status.contencao_sn) {
      badges.push({ color: 'blue', label: 'Contenção SN' });
    }
    if (status.alta_medica_programada) {
      badges.push({ color: 'green', label: 'Alta Médica Liberada' });
    }

    if (!badges.length) {
      return '<span class="dashboard-badge dashboard-badge-neutral">Sem alertas</span>';
    }

    return badges
      .map(b => {
        const titleAttr = b.tooltip ? ` title="${escapeHtml(b.tooltip)}"` : '';
        return `<span class="dashboard-badge dashboard-badge-${b.color}"${titleAttr}>${escapeHtml(b.label)}</span>`;
      })
      .join('');
  }

  function renderDashboardPacientes() {

    const grid = document.getElementById('dashboard-pacientes-grid');

    if (!grid) return;

    const pacientesFiltrados = getDashboardPacientesFiltrados();

    if (!state.dashboardPacientes.length) {
      grid.innerHTML = '';
      setDashboardFeedback('Nenhum paciente encontrado para o setor selecionado.', 'bi-people', 'info');
      return;
    }

    if (!pacientesFiltrados.length) {
      grid.innerHTML = '';
      setDashboardFeedback('Nenhum paciente corresponde ao filtro de etiquetas.', 'bi-funnel', 'info');
      return;
    }

    hideDashboardFeedback();

    grid.innerHTML = pacientesFiltrados.map(paciente => {
      const status = getDashboardStatusFlags(paciente);
      const temMedicacaoAgora = status.medicacao_agora;
      const prioridadeClass = temMedicacaoAgora ? ' dashboard-patient-priority' : '';
      const nrAtendimento = paciente.nr_atendimento || '-';
      const cdUnidadeRaw = paciente.cd_unidade ?? paciente.CD_UNIDADE ?? paciente.unidade;
      const cdUnidade = String(cdUnidadeRaw ?? '').trim() || '-';
      const classificAtendRaw = paciente.classific_atend ?? paciente.CLASSIFIC_ATEND;
      const classificAtend = String(classificAtendRaw ?? '').trim() || '-';
      
      const newsPontuacao = paciente.news_pontuacao;
      const newsResultado = paciente.news_resultado;
      let newsHtml = '';
      if (newsPontuacao !== null && newsPontuacao !== undefined) {
        const resultadoUpper = (newsResultado || '').toUpperCase().trim();
        const newsClass = resultadoUpper === 'ALTO' ? 'news-alto' : (resultadoUpper === 'MÉDIO' || resultadoUpper === 'MEDIO' ? 'news-medio' : 'news-baixo');
        newsHtml = `<span class="dashboard-patient-news ${newsClass}"><i class="bi bi-activity"></i> NEWS: ${escapeHtml(String(newsPontuacao))} - ${escapeHtml(newsResultado || '-')}</span>`;
      }

      return `
        <article class="dashboard-patient-card${prioridadeClass}" data-atendimento="${escapeHtml(String(nrAtendimento))}">
          <div class="dashboard-patient-tags">
            ${renderDashboardBadges(paciente, status)}
          </div>
          <h3>${escapeHtml(paciente.nome || '-')}</h3>
          ${renderNomeCivilPaciente(paciente)}
          <div class="dashboard-patient-meta">
            <span><i class="bi bi-hash"></i> Atendimento: ${escapeHtml(nrAtendimento)}</span>
            <span><i class="bi bi-diagram-3"></i> Unidade: ${escapeHtml(cdUnidade)}</span>
            <span><i class="bi bi-person-vcard"></i> Classificação: ${escapeHtml(classificAtend)}</span>
            ${newsHtml}
          </div>
        </article>`;
    }).join('');

  }

  async function loadDashboardPacientes(showLoading = true, transitionId = modeTransitionSeq) {

    if (!isCurrentWorkspace(transitionId, 'dashboard')) return;

    if (!state.dashboardSetorSelecionado) {
      setDashboardFeedback('Selecione um setor para visualizar os pacientes.', 'bi-building', 'info');
      return;
    }

    const refreshBtn = document.getElementById('btn-dashboard-refresh');

    if (showLoading) {
      setDashboardFeedback('Buscando pacientes...', 'bi-arrow-repeat spin', 'loading');
      document.getElementById('dashboard-pacientes-grid').innerHTML = '';
    }

    refreshBtn?.querySelector('i')?.classList.add('spin');

    try {
      const result = await api.post('/api/dashboard/pacientes-setor/' + encodeURIComponent(String(state.dashboardSetorSelecionado)), {});

      if (!isCurrentWorkspace(transitionId, 'dashboard')) return;

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar pacientes');
      }

      const pacientes = Array.isArray(result.data) ? result.data : [];
      state.dashboardPacientes = pacientes;
      syncDashboardTagFilters();
      state.dashboardResumo = buildDashboardResumo(pacientes);
      updateDashboardStats(state.dashboardResumo);
      updateDashboardLastUpdate(new Date().toISOString());
      startDashboardClock();
      renderDashboardPacientes();
    } catch (err) {
      if (!isCurrentWorkspace(transitionId, 'dashboard')) return;
      setDashboardFeedback(err.message || 'Erro ao carregar pacientes', 'bi-exclamation-triangle', 'error');
    } finally {
      if (isCurrentWorkspace(transitionId, 'dashboard')) {
        refreshBtn?.querySelector('i')?.classList.remove('spin');
      }
    }

  }

  async function onDashboardSetorChange() {
    const transitionId = modeTransitionSeq;

    const cdSetor = Number(dashboardSetorSelect?.value);

    state.dashboardSetorSelecionado = Number.isInteger(cdSetor) && cdSetor > 0 ? cdSetor : null;

    if (!state.dashboardSetorSelecionado) {
      state.dashboardPacientes = [];
      state.dashboardResumo = buildDashboardResumo([]);
      state.dashboardFiltroEtiquetas = new Set();
      document.getElementById('dashboard-pacientes-grid').innerHTML = '';
      updateDashboardStats(state.dashboardResumo);
      updateDashboardLastUpdate(null);
      setDashboardFeedback('Selecione um setor para visualizar os pacientes.', 'bi-building', 'info');
      if (isCurrentWorkspace(transitionId, 'dashboard')) startDashboardRefresh();
      return;
    }

    const showLoading = !state.dashboardPacientes || state.dashboardPacientes.length === 0;
    await loadDashboardPacientes(showLoading, transitionId);
    if (isCurrentWorkspace(transitionId, 'dashboard')) startDashboardRefresh();

  }

  async function enterDashboardMode() {

    if (!canAccessDashboard()) {
      showToast('Dashboard de pacientes disponível apenas para Enfermagem e Técnicos de Enfermagem', 'warning');
      enterPassagemMode();
      return;
    }

    const transitionId = activateWorkspace('dashboard', workspaceDashboard);

    startDashboardClock();
    
    // Only reset if empty
    if (!state.dashboardResumo) {
      state.dashboardResumo = buildDashboardResumo([]);
      updateDashboardStats(state.dashboardResumo);
    }

    await loadDashboardSetores(transitionId);

    if (isCurrentWorkspace(transitionId, 'dashboard')) startDashboardRefresh();

  }

  function stopDashboardPARefresh() {

    if (state.dashboardPATimer) {
      clearInterval(state.dashboardPATimer);
      state.dashboardPATimer = null;
    }

    if (state.dashboardPAClockTimer) {
      clearInterval(state.dashboardPAClockTimer);
      state.dashboardPAClockTimer = null;
    }

  }

  function updateDashboardPAClock(turno) {

    const now = new Date();

    const timeEl = document.getElementById('dashboard-internacao-clock-time');

    const dateEl = document.getElementById('dashboard-internacao-clock-date');

    const turnoEl = document.getElementById('dashboard-internacao-turno-label');

    if (timeEl) {

      timeEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    if (dateEl) {

      dateEl.textContent = formatDashboardDate(now);
    }

    if (turnoEl) {

      turnoEl.textContent = turno || getDashboardLocalTurno(now);
    }

  }

  function startDashboardPAClock(turno) {

    if (state.dashboardPAClockTimer) {
      clearInterval(state.dashboardPAClockTimer);
    }

    updateDashboardPAClock(turno);

    state.dashboardPAClockTimer = setInterval(() => updateDashboardPAClock(turno), 1000);

  }

  function startDashboardPARefresh() {

    if (state.dashboardPATimer) {
      clearInterval(state.dashboardPATimer);
    }

    state.dashboardPATimer = setInterval(() => {
      loadDashboardPA(false);
    }, DASHBOARD_REFRESH_MS);

  }

  function setPAFeedback(message, icon = 'bi-info-circle', type = 'info') {

    const feedback = document.getElementById('dashboard-pa-feedback');

    if (!feedback) return;

    feedback.className = `dashboard-feedback dashboard-feedback-${type}`;

    feedback.innerHTML = `<i class="bi ${icon}"></i><span>${escapeHtml(message)}</span>`;

    feedback.classList.remove('d-none');

  }

  function hidePAFeedback() {

    document.getElementById('dashboard-pa-feedback')?.classList.add('d-none');

  }

  function updateDashboardPALastUpdate(value) {

    const el = document.getElementById('dashboard-internacao-last-update');

    if (!el) return;

    if (!value) {
      el.textContent = 'Aguardando carregamento...';
      return;
    }

    const date = new Date(value);

    el.textContent = `Atualizado: ${date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;

  }

  function updatePAStats() {

    const statsContainer = document.getElementById('dashboard-pa-stats-cards');
    if (!statsContainer) return;

    const data = state.dashboardPA;
    const totalCount = (data.particularesAlta?.length || 0) + (data.altaMedica?.length || 0) + (data.salaObservacao?.length || 0) + (data.indicacaoInternacao?.length || 0) + (data.decididos?.length || 0);

    const counts = {
      particulares_alta: data.particularesAlta?.length || 0,
      alta_medica: data.altaMedica?.length || 0,
      sala_observacao: data.salaObservacao?.length || 0,
      indicacao_internacao: data.indicacaoInternacao?.length || 0,
      decididos: data.decididos?.length || 0
    };

    const isSemFiltro = state.dashboardPAFiltroEtiqueta === null;

    const cards = [
      {
        key: 'all',
        label: 'Total Pacientes',
        total: totalCount,
        color: 'primary',
        active: isSemFiltro
      },
      ...DASHBOARD_PA_ETIQUETAS.map(item => ({
        key: item.key,
        label: item.label,
        total: counts[item.key] || 0,
        color: item.color,
        icon: item.icon,
        active: state.dashboardPAFiltroEtiqueta === item.key
      })).filter(item => item.total > 0 || state.dashboardPAFiltroEtiqueta === item.key)
    ];

    statsContainer.innerHTML = cards.map(card => `
      <button class="dashboard-stat dashboard-stat-${card.color}${card.active ? ' active' : ''}" type="button" data-pa-tag="${escapeHtml(card.key)}">
        <span>${card.icon ? `<i class="bi ${card.icon}"></i> ` : ''}${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(String(card.total))}</strong>
      </button>
    `).join('');
  }

  function getPAFiltroEtiquetaKey(paciente) {
    const data = state.dashboardPA;
    if (data.particularesAlta?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'particulares_alta';
    if (data.altaMedica?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'alta_medica';
    if (data.salaObservacao?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'sala_observacao';
    if (data.indicacaoInternacao?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'indicacao_internacao';
    if (data.decididos?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'decididos';
    return null;
  }

  function renderPAPaciente(paciente, etiquetaKey) {

    const nrAtendimento = paciente.nr_atendimento || '-';
    const cdUnidadeRaw = paciente.cd_unidade ?? paciente.CD_UNIDADE ?? paciente.unidade;
    const cdUnidade = String(cdUnidadeRaw ?? '').trim() || '-';

    let statusClass = '';
    let statusBadge = '';

    const etiqueta = DASHBOARD_PA_ETIQUETAS.find(e => e.key === etiquetaKey);

    if (etiquetaKey === 'decididos') {
      const decisao = paciente.decisao;
      if (decisao === 'aceito' || decisao === 'recusado') {
        statusClass = decisao;
        const badgeClass = decisao === 'aceito' ? 'dashboard-badge-green' : 'dashboard-badge-red';
        const badgeLabel = decisao === 'aceito' ? 'Aceito' : 'Recusado';
        statusBadge = `<span class="dashboard-badge ${badgeClass}"><i class="bi ${decisao === 'aceito' ? 'bi-check-circle' : 'bi-x-circle'}"></i> ${escapeHtml(badgeLabel)}</span>`;
      }
    } else if (etiqueta) {
      statusBadge = `<span class="dashboard-badge dashboard-badge-${etiqueta.color}"><i class="bi ${etiqueta.icon}"></i> ${escapeHtml(etiqueta.label)}</span>`;
    }

    return `
      <article class="dashboard-patient-card ${statusClass}" data-atendimento="${escapeHtml(String(nrAtendimento))}" data-nr-templ="${escapeHtml(String(paciente.nr_seq_templ || ''))}" data-etiqueta="${escapeHtml(etiquetaKey || '')}">
        ${statusBadge ? `<div class="dashboard-patient-tags">${statusBadge}</div>` : ''}
        <h3>${escapeHtml(paciente.nome || '-')}</h3>
        ${renderNomeCivilPaciente(paciente)}
        <div class="dashboard-patient-meta">
          <span><i class="bi bi-hash"></i> ${escapeHtml(nrAtendimento)}</span>
          <span><i class="bi bi-building"></i> ${escapeHtml(paciente.setor || '-')}</span>
          <span><i class="bi bi-diagram-3"></i> ${escapeHtml(cdUnidade)}</span>
          <span><i class="bi bi-credit-card"></i> ${escapeHtml(paciente.convenio || '-')}</span>
        </div>
      </article>`;

  }

  function renderDashboardPAPacientes() {

    const grid = document.getElementById('dashboard-pa-patients-grid');
    if (!grid) return;

    const data = state.dashboardPA;
    const filtro = state.dashboardPAFiltroEtiqueta;

    const allPacientes = [
      ...data.particularesAlta.map(p => ({ ...p, _etiquetaKey: 'particulares_alta' })),
      ...data.altaMedica.map(p => ({ ...p, _etiquetaKey: 'alta_medica' })),
      ...data.salaObservacao.map(p => ({ ...p, _etiquetaKey: 'sala_observacao' })),
      ...data.indicacaoInternacao.map(p => ({ ...p, _etiquetaKey: 'indicacao_internacao' })),
      ...data.decididos.map(p => ({ ...p, _etiquetaKey: 'decididos' }))
    ];

    const totalCount = allPacientes.length;

    if (totalCount === 0) {
      grid.innerHTML = '';
      setPAFeedback('Nenhum paciente encontrado.', 'bi-people', 'info');
      return;
    }

    const filtered = filtro
      ? allPacientes.filter(p => p._etiquetaKey === filtro)
      : allPacientes;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      setPAFeedback('Nenhum paciente corresponde ao filtro selecionado.', 'bi-funnel', 'info');
      return;
    }

    hidePAFeedback();

    grid.innerHTML = filtered.map(paciente => renderPAPaciente(paciente, paciente._etiquetaKey)).join('');

    grid.querySelectorAll('.dashboard-patient-card').forEach(card => {
      const atendimento = card.getAttribute('data-atendimento');
      const etiqueta = card.getAttribute('data-etiqueta');

      if (etiqueta === 'decididos') {
        card.addEventListener('click', () => {
          openDecididoModal(atendimento);
        });
        card.style.cursor = 'pointer';
        return;
      }

      const internacaoList = state.dashboardPA.indicacaoInternacao || [];
      if (internacaoList.some(p => String(p.nr_atendimento) === String(atendimento))) {
        card.addEventListener('click', () => {
          openInternacaoModal(atendimento);
        });
        card.style.cursor = 'pointer';
      }
    });

  }

  function renderDashboardPA() {

    const data = state.dashboardPA;

    updatePAStats();
    renderDashboardPAPacientes();

  }

  async function loadDashboardPA(showLoading = true, transitionId = modeTransitionSeq) {

    if (!isCurrentWorkspace(transitionId, 'dashboard-internacao')) return;

    const refreshBtn = document.getElementById('btn-dashboard-internacao-refresh');

    if (showLoading) {
      setPAFeedback('Carregando...', 'bi-arrow-repeat spin', 'loading');
    }

    refreshBtn?.querySelector('i')?.classList.add('spin');

    try {

      const result = await api.get('/api/dashboard/internacao');

      if (!isCurrentWorkspace(transitionId, 'dashboard-internacao')) return;

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar dados');
      }

      state.dashboardPA = {
        particularesAlta: result.data.particularesAlta || [],
        altaMedica: result.data.altaMedica || [],
        salaObservacao: result.data.salaObservacao || [],
        indicacaoInternacao: result.data.indicacaoInternacao || [],
        decididos: result.data.decididos || []
      };
      state.dashboardPALoaded = true;

      updateDashboardPALastUpdate(new Date().toISOString());
      startDashboardPAClock(result.data.turno?.descricao);
      renderDashboardPA();

    } catch (err) {
      if (!isCurrentWorkspace(transitionId, 'dashboard-internacao')) return;
      setPAFeedback(err.message || 'Erro ao carregar', 'bi-exclamation-triangle', 'error');
    } finally {
      if (isCurrentWorkspace(transitionId, 'dashboard-internacao')) {
        refreshBtn?.querySelector('i')?.classList.remove('spin');
      }
    }

  }

  let currentInternacaoNrAtendimento = null;
  let currentInternacaoCdConvenio = null;
  let alterandoDecisao = false;
  let lastDecididoData = null;

  function openInternacaoModal(nrAtendimento) {

    currentInternacaoNrAtendimento = nrAtendimento;

    const overlay = document.getElementById('modal-internacao-overlay');

    const body = document.getElementById('modal-internacao-body');

    const title = document.getElementById('modal-internacao-title');

    const subtitle = document.getElementById('modal-internacao-subtitle');

    if (overlay) {
      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          closeInternacaoModal();
        }
      };
    }

    if (body) {
      body.innerHTML = `<div class="modal-internacao-loading"><i class="bi bi-arrow-repeat spin"></i><span>Carregando detalhes...</span></div>`;
    }

    if (title) title.textContent = 'Indicação de Internação';

    if (subtitle) subtitle.textContent = `Atendimento ${nrAtendimento}`;

    document.getElementById('btn-aceitar-internacao').classList.remove('d-none');
    document.getElementById('btn-recusar-internacao').classList.remove('d-none');

    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');

    alterandoDecisao = false;
    lastDecididoData = null;

    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');

    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    if (decisaoInfo) {
      decisaoInfo.classList.add('d-none');
      decisaoInfo.innerHTML = '';
    }

    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    if (motivoWrapper) motivoWrapper.classList.remove('d-none');

    loadInternacaoDetalhes(nrAtendimento);
    loadSetorDesejadoOptions();

  }

  function openDecididoModal(nrAtendimento) {

    const overlay = document.getElementById('modal-internacao-overlay');
    const body = document.getElementById('modal-internacao-body');
    const title = document.getElementById('modal-internacao-title');
    const subtitle = document.getElementById('modal-internacao-subtitle');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');

    if (overlay) {
      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          closeInternacaoModal();
        }
      };
    }

    if (body) {
      body.innerHTML = `<div class="modal-internacao-loading"><i class="bi bi-arrow-repeat spin"></i><span>Carregando detalhes...</span></div>`;
    }

    if (title) title.textContent = 'Decisão de Internação';
    if (subtitle) subtitle.textContent = `Atendimento ${nrAtendimento}`;

    document.getElementById('btn-aceitar-internacao')?.classList.add('d-none');
    document.getElementById('btn-recusar-internacao')?.classList.add('d-none');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');
    if (motivoWrapper) motivoWrapper.classList.add('d-none');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
    if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
    if (decisaoInfo) {
      decisaoInfo.classList.remove('d-none');
      decisaoInfo.innerHTML = `<div class="modal-internacao-loading"><i class="bi bi-arrow-repeat spin"></i><span>Carregando decisão...</span></div>`;
    }

    alterandoDecisao = false;
    lastDecididoData = null;

    loadDecididoDetalhes(nrAtendimento);
    loadSetorDesejadoOptions();

  }

  async function loadDecididoDetalhes(nrAtendimento) {

    const body = document.getElementById('modal-internacao-body');
    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');

    try {

      const result = await api.get(`/api/dashboard/internacao/detalhes/${nrAtendimento}`);

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar detalhes');
      }

      const d = result.data;

      currentInternacaoNrAtendimento = d.nr_atendimento || nrAtendimento;
      currentInternacaoCdConvenio = d.cd_convenio || null;
      lastDecididoData = d;

      const labelMap = {
        100082: { 289670: 'Parecer' },
        100083: { 289674: 'Parecer' }
      };

      const labels = labelMap[d.nr_seq_templ] || {};

      let detalhesHtml = `<div class="modal-internacao-detalhes">`;
      detalhesHtml += `
        <div class="detail-row">
          <span class="detail-label">Paciente</span>
          <span class="detail-value">${escapeHtml(d.nome || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Setor</span>
          <span class="detail-value">${escapeHtml(d.setor || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Convênio</span>
          <span class="detail-value">${escapeHtml(d.convenio || '-')}</span>
        </div>`;

      if (d.resultado) {
        for (const [key, value] of Object.entries(d.resultado)) {
          const campoNum = parseInt(key.replace('campo_', ''), 10);
          if (!labels[campoNum]) continue;
          detalhesHtml += `
            <div class="detail-row">
              <span class="detail-label">${escapeHtml(labels[campoNum])}</span>
              <span class="detail-value highlight">${escapeHtml(value || '-')}</span>
            </div>`;
        }
      }
      detalhesHtml += `</div>`;

      if (body) body.innerHTML = detalhesHtml;

      if (decisaoInfo) {
        const decisao = d.decisao;
        const isAceito = decisao === 'aceito';
        const badgeClass = isAceito ? 'dashboard-badge-green' : 'dashboard-badge-red';
        const badgeLabel = isAceito ? 'Aceito' : (decisao === 'recusado' ? 'Recusado' : '-');
        const badgeIcon = isAceito ? 'bi-check-circle' : 'bi-x-circle';

        let dtDecisao = '-';
        if (d.dt_decisao) {
          const raw = String(d.dt_decisao).trim();
          const dt = new Date(raw.replace(' ', 'T'));
          if (!isNaN(dt.getTime())) {
            dtDecisao = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          } else if (raw) {
            dtDecisao = raw;
          }
        }

        let decisaoHtml = `<div class="modal-decisao-block">`;
        decisaoHtml += `
          <div class="modal-decisao-status">
            <span class="dashboard-badge ${badgeClass}"><i class="bi ${badgeIcon}"></i> ${escapeHtml(badgeLabel)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Decidido por</span>
            <span class="detail-value">${escapeHtml(d.decidido_por || '-')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Data</span>
            <span class="detail-value">${escapeHtml(dtDecisao)}</span>
          </div>`;

        if (isAceito && d.setor_desejado) {
          decisaoHtml += `
            <div class="detail-row">
              <span class="detail-label">Setor desejado</span>
              <span class="detail-value">${escapeHtml(d.setor_desejado)}</span>
            </div>`;
        }

        if (d.motivo) {
          decisaoHtml += `
            <div class="detail-row detail-row-block">
              <span class="detail-label">Motivo</span>
              <span class="detail-value">${escapeHtml(d.motivo)}</span>
            </div>`;
        }

        decisaoHtml += `</div>`;
        decisaoInfo.innerHTML = decisaoHtml;
      }

      const btnAlterar = document.getElementById('btn-alterar-decisao');
      if (btnAlterar) btnAlterar.classList.remove('d-none');

    } catch (err) {
      if (body) body.innerHTML = `<div class="pa-quadro-feedback pa-quadro-feedback-error"><i class="bi bi-exclamation-triangle"></i><span>${escapeHtml(err.message || 'Erro ao carregar')}</span></div>`;
      if (decisaoInfo) decisaoInfo.innerHTML = '';
    }

  }

  async function enableDecisaoAlteracao() {

    const d = lastDecididoData;
    if (!d) return;

    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const motivoInput = document.getElementById('modal-internacao-motivo');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');

    if (decisaoInfo) decisaoInfo.classList.add('d-none');
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.remove('d-none');
    if (motivoWrapper) motivoWrapper.classList.remove('d-none');

    if (motivoInput) {
      motivoInput.value = d.motivo || '';
      motivoInput.focus();
    }

    document.getElementById('btn-aceitar-internacao')?.classList.remove('d-none');
    document.getElementById('btn-recusar-internacao')?.classList.remove('d-none');

    const title = document.getElementById('modal-internacao-title');
    if (title) title.textContent = 'Alterar Decisão de Internação';

    alterandoDecisao = true;

    await loadSetorDesejadoOptions();

    const setorSelect = document.getElementById('modal-internacao-setor-desejado');
    if (setorSelect && d.cd_setor_desejado) {
      setorSelect.value = String(d.cd_setor_desejado);
    }

  }

  function disableDecisaoAlteracao() {

    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');
    const motivoInput = document.getElementById('modal-internacao-motivo');

    if (decisaoInfo) decisaoInfo.classList.remove('d-none');
    if (motivoWrapper) motivoWrapper.classList.add('d-none');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
    if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
    if (btnAlterar) btnAlterar.classList.remove('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');

    if (motivoInput) motivoInput.value = lastDecididoData?.motivo || '';

    document.getElementById('btn-aceitar-internacao')?.classList.add('d-none');
    document.getElementById('btn-recusar-internacao')?.classList.add('d-none');

    const title = document.getElementById('modal-internacao-title');
    if (title) title.textContent = 'Decisão de Internação';

    alterandoDecisao = false;

  }

  async function loadSetorDesejadoOptions() {
    const select = document.getElementById('modal-internacao-setor-desejado');
    if (!select) return;

    select.innerHTML = '<option value="">Carregando setores...</option>';
    select.disabled = true;

    try {
      const result = await api.get('/api/setores-internacao?modulo=dashboard');
      if (!result.success) throw new Error(result.message || 'Erro ao carregar setores');

      const setores = result.data || [];
      select.innerHTML = '<option value="">Selecione o setor...</option>';

      setores.forEach(s => {
        const option = document.createElement('option');
        option.value = String(s.cd_setor_atendimento);
        option.textContent = s.ds_setor_atendimento;
        select.appendChild(option);
      });

      select.disabled = false;
    } catch (err) {
      select.innerHTML = '<option value="">Erro ao carregar setores</option>';
    }
  }

  function closeInternacaoModal() {

    const overlay = document.getElementById('modal-internacao-overlay');
    const motivoInput = document.getElementById('modal-internacao-motivo');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');

    if (overlay) overlay.classList.add('d-none');
    document.body.classList.remove('modal-open');

    if (motivoInput) motivoInput.value = '';

    if (motivoWrapper) motivoWrapper.classList.remove('d-none');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
    if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
    if (decisaoInfo) {
      decisaoInfo.classList.add('d-none');
      decisaoInfo.innerHTML = '';
    }
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');

    currentInternacaoNrAtendimento = null;
    currentInternacaoCdConvenio = null;
    alterandoDecisao = false;
    lastDecididoData = null;

  }

  async function loadInternacaoDetalhes(nrAtendimento) {

    const body = document.getElementById('modal-internacao-body');

    try {

      const result = await api.get(`/api/dashboard/internacao/detalhes/${nrAtendimento}`);

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar detalhes');
      }

      const d = result.data;

      currentInternacaoCdConvenio = d.cd_convenio || null;

      const labelMap = {
        100082: { 289670: 'Parecer' },
        100083: { 289674: 'Parecer' }
      };

      const labels = labelMap[d.nr_seq_templ] || {};

      let detalhesHtml = `<div class="modal-internacao-detalhes">`;

      detalhesHtml += `
        <div class="detail-row">
          <span class="detail-label">Paciente</span>
          <span class="detail-value">${escapeHtml(d.nome || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Setor</span>
          <span class="detail-value">${escapeHtml(d.setor || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Convênio</span>
          <span class="detail-value">${escapeHtml(d.convenio || '-')}</span>
        </div>`;

      if (d.resultado) {
        for (const [key, value] of Object.entries(d.resultado)) {
          const campoNum = parseInt(key.replace('campo_', ''), 10);
          if (!labels[campoNum]) continue;
          detalhesHtml += `
            <div class="detail-row">
              <span class="detail-label">${escapeHtml(labels[campoNum])}</span>
              <span class="detail-value highlight">${escapeHtml(value || '-')}</span>
            </div>`;
        }
      }

      detalhesHtml += `</div>`;

      if (body) body.innerHTML = detalhesHtml;

    } catch (err) {
      if (body) body.innerHTML = `<div class="pa-quadro-feedback pa-quadro-feedback-error"><i class="bi bi-exclamation-triangle"></i><span>${escapeHtml(err.message || 'Erro ao carregar')}</span></div>`;
    }

  }

  async function handleInternacaoAcao(acao) {

    if (!currentInternacaoNrAtendimento) return;

    const btnAceitar = document.getElementById('btn-aceitar-internacao');
    const btnRecusar = document.getElementById('btn-recusar-internacao');
    const motivoInput = document.getElementById('modal-internacao-motivo');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');

    if (acao === 'aceitar' && setorDesejadoWrapper && setorDesejadoWrapper.classList.contains('d-none')) {
      setorDesejadoWrapper.classList.remove('d-none');
      const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
      if (rodizioWrapper) rodizioWrapper.classList.remove('d-none');
      return;
    }

    const motivoPreview = motivoInput?.value?.trim() || '';

    if (alterandoDecisao && !motivoPreview) {
      showToast('Justifique o motivo da alteração da decisão', 'warning');
      motivoInput?.focus();
      return;
    }

    btnAceitar.disabled = true;
    btnRecusar.disabled = true;

    btnAceitar.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processando...';
    btnRecusar.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processando...';

    try {

      const motivo = motivoPreview;

      const setorDesejadoSelect = document.getElementById('modal-internacao-setor-desejado');
      const cdSetorDesejado = acao === 'aceitar' && setorDesejadoSelect?.value
        ? parseInt(setorDesejadoSelect.value, 10)
        : null;

      const result = await api.post('/api/dashboard/internacao/acao', {
        nr_atendimento: currentInternacaoNrAtendimento,
        acao: acao,
        motivo: motivo,
        cd_setor_desejado: cdSetorDesejado,
        cd_convenio: currentInternacaoCdConvenio
      });

      if (!result.success) {
        throw new Error(result.message || 'Erro ao processar ação');
      }

      const msgSucesso = alterandoDecisao
        ? (acao === 'aceitar' ? 'Decisão alterada para Aceito' : 'Decisão alterada para Recusado')
        : (acao === 'aceitar' ? 'Internação aceita' : 'Internação recusada');
      showToast(result.message || msgSucesso, 'success');

      if (result.warnings && result.warnings.length > 0) {
        setTimeout(() => {
          showToast(result.warnings[0].message, 'warning');
        }, 1500);
      }

      closeInternacaoModal();

      await loadDashboardPA(false);

    } catch (err) {
      showToast(err.message || 'Erro ao processar ação', 'error');
    } finally {
      btnAceitar.disabled = false;
      btnRecusar.disabled = false;
      btnAceitar.innerHTML = '<i class="bi bi-check-circle"></i> Aceitar';
      btnRecusar.innerHTML = '<i class="bi bi-x-circle"></i> Recusar';
      if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
      const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
      if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
      alterandoDecisao = false;
    }

  }

  async function enterDashboardInternacaoMode() {

    if (!canAccessDashboardInternacao()) {
      showToast('Dashboard P.A. disponível apenas para Enfermagem', 'warning');
      enterPassagemMode();
      return;
    }

    const transitionId = activateWorkspace('dashboard-internacao', workspaceDashboardInternacao);

    startDashboardPAClock();
    state.dashboardPAFiltroEtiqueta = null;
    
    // Render from memory immediately only after a successful load.
    if (state.dashboardPALoaded) {
      renderDashboardPA();
    }

    const showLoading = !state.dashboardPALoaded;
    await loadDashboardPA(showLoading, transitionId);

    if (isCurrentWorkspace(transitionId, 'dashboard-internacao')) startDashboardPARefresh();

  }

  function buildLivroTecnicoRow() {
    return {
      row_key: nextLivroRowKey('tec'),
      cd_pessoa_fisica: null,
      pacientes: []
    };
  }

  function buildLivroFaltaRow() {
    return {
      row_key: nextLivroRowKey('falta'),
      cd_pessoa_fisica: null,
      tipo: 'Falta'
    };
  }

  function buildAvaliacaoRow() {
    return {
      row_key: nextLivroRowKey('avaliacao'),
      cd_pessoa_fisica: null,
      pacientes: [],
      descricao: ''
    };
  }

  function buildPatioRow() {
    return {
      row_key: nextLivroRowKey('patio'),
      cd_pessoa_fisica: null
    };
  }

  function buildCirculanteRow() {
    return {
      row_key: nextLivroRowKey('circulante'),
      cd_pessoa_fisica: null
    };
  }

  function buildEctPreRow() {
    return {
      row_key: nextLivroRowKey('ect_pre'),
      cd_pessoa_fisica: null
    };
  }

  function buildEctSalaRow() {
    return {
      row_key: nextLivroRowKey('ect_sala'),
      cd_pessoa_fisica: null
    };
  }

  function buildEctRecuperacaoRow() {
    return {
      row_key: nextLivroRowKey('ect_rec'),
      cd_pessoa_fisica: null
    };
  }

  function refreshLivroPacienteVinculo() {
    const pacientesValidos = new Set(
      state.livroPacientes.map(item => Number(item.nr_atendimento || item.atendimento)).filter(Number.isInteger)
    );

    const mapa = new Map();
    state.livroTecnicosSelecionados.forEach(row => {
      row.pacientes = (row.pacientes || [])
        .map(Number)
        .filter(atendimento => Number.isInteger(atendimento) && pacientesValidos.has(atendimento));

      if (!Number.isInteger(row.cd_pessoa_fisica)) return;

      row.pacientes.forEach(atendimento => {
        if (!mapa.has(atendimento)) {
          mapa.set(atendimento, row.cd_pessoa_fisica);
        }
      });
    });

    state.livroPacienteVinculo = mapa;
    state.livroAvaliacaoExterna = (state.livroAvaliacaoExterna || []).map(row => ({
      row_key: row?.row_key || nextLivroRowKey('avaliacao'),
      cd_pessoa_fisica: Number.isInteger(Number(row?.cd_pessoa_fisica)) ? Number(row.cd_pessoa_fisica) : null,
      pacientes: Array.isArray(row?.pacientes)
        ? [...new Set(row.pacientes.map(Number).filter(atendimento => Number.isInteger(atendimento) && pacientesValidos.has(atendimento)))]
        : [],
      descricao: typeof row?.descricao === 'string' ? row.descricao : ''
    }));
    state.livroPatio = (state.livroPatio || []).map(row => ({
      row_key: row?.row_key || nextLivroRowKey('patio'),
      cd_pessoa_fisica: Number.isInteger(Number(row?.cd_pessoa_fisica)) ? Number(row.cd_pessoa_fisica) : null
    }));
    state.livroCirculante = (state.livroCirculante || []).map(row => ({
      row_key: row?.row_key || nextLivroRowKey('circulante'),
      cd_pessoa_fisica: Number.isInteger(Number(row?.cd_pessoa_fisica)) ? Number(row.cd_pessoa_fisica) : null
    }));
  }

  function renderLivroPreviewData(data) {

    const preview = document.getElementById('livro-preview');

    if (!data) {
      preview.innerHTML = '<div class="loading-placeholder">Nenhuma escala técnica encontrada para os filtros informados.</div>';

      return;

    }

    const setorDesc = getLivroSetorLabel(data.cd_setor_atendimento);
    const metaText = `Ocorrência #${data.nr_ocorrencia} | Usuário: ${data.nm_usuario || '-'} | Data de registro: ${data.dt_ocorrencia || '-'} | Setor: ${setorDesc}`;
    const metaHtml = `<div class="livro-preview-meta">${escapeHtml(metaText)}</div>`;
    const corpoHtml = data.ds_ocorrencia || '';

    preview.innerHTML = `
      <div class="livro-preview-toolbar">
        ${metaHtml}
        <button class="btn-secondary btn-print-preview" id="btn-imprimir-escala" type="button">
          <i class="bi bi-printer"></i> Imprimir
        </button>
      </div>
      <div id="livro-preview-documento">${corpoHtml}</div>`;

    document.getElementById('btn-imprimir-escala')?.addEventListener('click', () => {
      imprimirEscalaAssistencial(metaHtml, corpoHtml);
    });

  }

  function imprimirEscalaAssistencial(metaHtml, corpoHtml) {
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      showToast('Não foi possível abrir a janela de impressão. Libere pop-ups no navegador.', 'warning');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Escala Assistencial</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 16px; color: #111; }
          .print-wrapper { width: 100%; max-width: 1020px; margin: 0 auto; }
          .livro-preview-meta { font-size: 12px; color: #555; margin: 0 auto 12px; width: 100%; max-width: 980px; }
          .escala-print-item { padding-bottom: 1rem; page-break-inside: avoid; overflow: hidden; }
          @media print {
            body { margin: 0; padding: 0; }
            .print-wrapper { max-width: 1020px; }
            .escala-print-item { page-break-after: always; page-break-inside: avoid; }
            .escala-print-item:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${metaHtml}
          ${corpoHtml}
        </div>
      </body>
      </html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();

    // Fechar popup automaticamente quando janela principal receber foco
    const fecharPopupNoFoco = () => {
      if (popup && !popup.closed) {
        popup.close();
      }
      window.removeEventListener('focus', fecharPopupNoFoco);
    };
    window.addEventListener('focus', fecharPopupNoFoco);
  }

  async function loadLivroAdministrativoByDate(dateValue) {
    const mySeq = ++state.livroLoadSeq;
    const preview = document.getElementById('livro-preview');
    const setorId = Number(state.livroSetorSelecionado);
    const turno = getEscalaTurnoSelecionado();

    if (!Number.isInteger(setorId)) {
      ensureLivroEditable();
      preview.innerHTML = '<div class="loading-placeholder">Não foi possível carregar o perfil.</div>';
      return;
    }

    const isStale = () => mySeq !== state.livroLoadSeq;

    preview.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando escala...</div>';
    setLivroFormLoading(true);

    try {
      const [resultAtiva, resultTecnica] = await Promise.all([
        api.get(`/api/escala-ativa?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dateValue)}&turno=${encodeURIComponent(turno || 'M')}`),
        api.get(`/api/escala-tecnica?data=${encodeURIComponent(dateValue)}&cd_setor=${encodeURIComponent(String(setorId))}&turno=${encodeURIComponent(turno || 'M')}`)
      ]);

      if (isStale()) return;

      const escalaExistente = (resultAtiva.success && resultAtiva.data) || (resultTecnica.success && resultTecnica.data);

      if (resultAtiva.success && resultAtiva.data) {
        hydrateLivroFromPayload(resultAtiva.data);
      } else if (!resultTecnica.success || !resultTecnica.data) {
        clearLivroForm();
      }

      if (escalaExistente) {
        disableLivroForm();
        showLivroEditarBtn();
      } else {
        ensureLivroEditable();
      }

      if (resultTecnica.success && resultTecnica.data) {
        renderLivroPreviewData(resultTecnica.data);
      } else if (resultAtiva.success && resultAtiva.data) {
        renderLivroPreviewFromPayload(resultAtiva.data);
      } else {
        preview.innerHTML = '<div class="loading-placeholder">Nenhuma escala encontrada para esta data.</div>';
      }

      await refreshHistoricoButton();
      if (isStale()) return;
    } catch (err) {
      if (isStale()) return;
      ensureLivroEditable();
      preview.innerHTML = '<div class="loading-placeholder">Erro ao buscar escala</div>';
    } finally {
      if (!isStale()) setLivroFormLoading(false);
    }
  }

  function renderLivroPreviewFromPayload(payload) {
    const preview = document.getElementById('livro-preview');
    if (!payload || (!payload.tecnicos && !payload.ect)) {
      preview.innerHTML = '<div class="loading-placeholder">Dados incompletos para visualização.</div>';
      return;
    }

    const turnoLabel = payload.turno === 'N' ? 'Noturno (19h - 07h)' : 'Diurno (07h - 19h)';
    let html = '<div class="livro-preview-content">';
    html += `<div class="livro-preview-header"><i class="bi bi-clipboard-check"></i> Escala Assistencial — ${payload.data_plantao || ''} | ${turnoLabel}</div>`;

    const enfSelect = document.getElementById('livro-enfermeiro');
    const enfNome = enfSelect && payload.enfermeiro_cd_pessoa_fisica
      ? enfSelect.querySelector(`option[value="${payload.enfermeiro_cd_pessoa_fisica}"]`)?.textContent || ''
      : '';

    if (enfNome) html += `<div class="livro-preview-row"><b>Enfermeiro:</b> ${escapeHtml(enfNome)}</div>`;

    if (payload.ect) {
      if (Array.isArray(payload.ect.pre_procedimento) && payload.ect.pre_procedimento.length) {
        html += '<div class="livro-preview-row"><b>Pré-Procedimento:</b> ' +
          payload.ect.pre_procedimento.map(id => escapeHtml(getTecnicoNome(id))).join(', ') +
          '</div>';
      }
      if (Array.isArray(payload.ect.sala_procedimento) && payload.ect.sala_procedimento.length) {
        html += '<div class="livro-preview-row"><b>Sala de Procedimento:</b> ' +
          payload.ect.sala_procedimento.map(id => escapeHtml(getTecnicoNome(id))).join(', ') +
          '</div>';
      }
      if (Array.isArray(payload.ect.sala_recuperacao) && payload.ect.sala_recuperacao.length) {
        html += '<div class="livro-preview-row"><b>Sala de Recuperação:</b> ' +
          payload.ect.sala_recuperacao.map(id => escapeHtml(getTecnicoNome(id))).join(', ') +
          '</div>';
      }
    }

    if (payload.tecnicos && payload.tecnicos.length) {
      html += '<div class="livro-preview-row"><b>Técnicos do plantão:</b></div>';
      payload.tecnicos.forEach(t => {
        const nomeTec = getTecnicoNome(t.cd_pessoa_fisica);
        const pacientesList = (t.pacientes || []).map(p => getPacienteNome(p)).filter(Boolean).join(', ');
        const extras = (t.patio_circulante || []).join(', ');
        let linha = `&nbsp;&nbsp;${escapeHtml(nomeTec)}`;
        if (pacientesList) linha += ` → Pacientes: ${escapeHtml(pacientesList)}`;
        if (extras) linha += ` [${escapeHtml(extras)}]`;
        html += `<div class="livro-preview-row">${linha}</div>`;
      });
    }

    if (payload.faltas_folgas && payload.faltas_folgas.length) {
      html += '<div class="livro-preview-row"><b>Faltas/Folgas:</b> ' +
        payload.faltas_folgas.map(f => `${escapeHtml(getTecnicoNome(f.cd_pessoa_fisica))} (${f.tipo})`).join(', ') +
        '</div>';
    }

    if (payload.avaliacao_externa && payload.avaliacao_externa.length) {
      html += '<div class="livro-preview-row"><b>Avaliação Externa:</b></div>';
      payload.avaliacao_externa.forEach(a => {
        const pacientesList = (a.pacientes || []).map(p => getPacienteNome(p)).filter(Boolean).join(', ');
        html += `<div class="livro-preview-row">&nbsp;&nbsp;${escapeHtml(getTecnicoNome(a.cd_pessoa_fisica))} → ${escapeHtml(pacientesList)}${a.descricao ? ' — ' + escapeHtml(a.descricao) : ''}</div>`;
      });
    }

    if (payload.observacoes) {
      html += `<div class="livro-preview-row"><b>Observações:</b> ${escapeHtml(payload.observacoes)}</div>`;
    }

    html += '</div>';
    preview.innerHTML = html;
  }

  function isLivroSetorEct() {
    if (!state.livroSetorSelecionado) return false;
    const setor = (state.livroSetores || []).find(s => Number(s.cd_setor_atendimento) === Number(state.livroSetorSelecionado));
    if (!setor) return false;
    const nome = String(setor.ds_setor_atendimento || '').toUpperCase().trim();
    return nome === 'ECT' || nome.includes('ECT');
  }

  function updateLivroSectionsVisibility() {
    const isEct = isLivroSetorEct();
    const workspace = document.getElementById('workspace-livro');
    const ectPreSecao = document.getElementById('livro-secao-ect-pre');
    const ectSalaSecao = document.getElementById('livro-secao-ect-sala');
    const ectRecSecao = document.getElementById('livro-secao-ect-recuperacao');
    const tecSecao = document.getElementById('livro-secao-tecnicos');
    const patioSecao = document.getElementById('livro-secao-patio');
    const circSecao = document.getElementById('livro-secao-circulante');
    const faltasSecao = document.getElementById('livro-secao-faltas');
    const avaliacaoSecao = document.getElementById('livro-secao-avaliacao-externa');

    if (isEct) {
      workspace?.classList.add('mode-ect');
      ectPreSecao?.classList.remove('d-none');
      ectSalaSecao?.classList.remove('d-none');
      ectRecSecao?.classList.remove('d-none');
      tecSecao?.classList.add('d-none');
      patioSecao?.classList.add('d-none');
      circSecao?.classList.add('d-none');
      faltasSecao?.classList.add('d-none');
      avaliacaoSecao?.classList.add('d-none');
    } else {
      workspace?.classList.remove('mode-ect');
      ectPreSecao?.classList.add('d-none');
      ectSalaSecao?.classList.add('d-none');
      ectRecSecao?.classList.add('d-none');
      tecSecao?.classList.remove('d-none');
      patioSecao?.classList.remove('d-none');
      circSecao?.classList.remove('d-none');
      faltasSecao?.classList.remove('d-none');
      avaliacaoSecao?.classList.remove('d-none');
    }
  }

  function getLivroTodosProfissionais() {
    const mapa = new Map();
    (state.livroEnfermeiros || []).forEach(p => {
      const id = Number(p.cd_pessoa_fisica);
      if (Number.isInteger(id) && !mapa.has(id)) {
        mapa.set(id, { cd_pessoa_fisica: id, nome: p.nome || p.nm_usuario || `Enfermeiro ${id}` });
      }
    });
    (state.livroTecnicos || []).forEach(p => {
      const id = Number(p.cd_pessoa_fisica);
      if (Number.isInteger(id) && !mapa.has(id)) {
        mapa.set(id, { cd_pessoa_fisica: id, nome: p.nome || p.nm_usuario || `Técnico ${id}` });
      }
    });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  function buildEctProfissionalOptionsHtml(selectedId, emptyLabel = 'Selecione...') {
    const selected = Number(selectedId);
    const profissionais = getLivroTodosProfissionais();
    const options = [
      `<option value="">${escapeHtml(emptyLabel)}</option>`,
      ...profissionais.map(item => {
        const value = Number(item.cd_pessoa_fisica);
        const mark = Number.isInteger(selected) && selected === value ? 'selected' : '';
        return `<option value="${value}" ${mark}>${escapeHtml(item.nome)}</option>`;
      })
    ];
    return options.join('');
  }

  function renderEctPreList() {
    const container = document.getElementById('livro-ect-pre-list');
    if (!container) return;
    if (!state.livroEctPre.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum profissional adicionado.</div>';
      return;
    }
    container.innerHTML = state.livroEctPre
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Profissional ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="ect-pre-select" data-row-key="${item.row_key}">
                ${buildEctProfissionalOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-ect-pre" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  function renderEctSalaList() {
    const container = document.getElementById('livro-ect-sala-list');
    if (!container) return;
    if (!state.livroEctSala.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum profissional adicionado.</div>';
      return;
    }
    container.innerHTML = state.livroEctSala
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Profissional ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="ect-sala-select" data-row-key="${item.row_key}">
                ${buildEctProfissionalOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-ect-sala" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  function renderEctRecuperacaoList() {
    const container = document.getElementById('livro-ect-recuperacao-list');
    if (!container) return;
    if (!state.livroEctRecuperacao.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum profissional adicionado.</div>';
      return;
    }
    container.innerHTML = state.livroEctRecuperacao
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Profissional ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="ect-recuperacao-select" data-row-key="${item.row_key}">
                ${buildEctProfissionalOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-ect-recuperacao" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  function renderLivroEctSelects() {
    renderEctPreList();
    renderEctSalaList();
    renderEctRecuperacaoList();
  }

  function getTecnicoNome(cdPessoaFisica) {
    const id = Number(cdPessoaFisica);
    const todos = [...(state.livroEnfermeiros || []), ...(state.livroTecnicos || [])];
    const found = todos.find(t => Number(t.cd_pessoa_fisica) === id);
    return found ? (found.nome || found.nm_usuario || '') : '';
  }

  function getPacienteNome(nrAtendimento) {
    const id = Number(nrAtendimento);
    const found = (state.livroPacientes || []).find(p => Number(p.atendimento || p.nr_atendimento) === id);
    if (found) return found.nm_pessoa_fisica || found.nome || '';
    return '';
  }

  async function refreshHistoricoButton() {
    const btn = document.getElementById('btn-livro-historico');
    const countSpan = document.getElementById('livro-historico-count');
    if (!btn || !countSpan) return;

    const setorId = Number(state.livroSetorSelecionado);
    const dtPlantao = document.getElementById('livro-data-plantao').value || getTodayIsoDate();
    const turno = getEscalaTurnoSelecionado() || 'M';

    if (!Number.isInteger(setorId)) {
      btn.classList.add('d-none');
      return;
    }

    try {
      const result = await api.get(
        `/api/escala-ativa/versoes?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}`
      );
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        countSpan.textContent = `(${result.data.length})`;
        btn.classList.remove('d-none');
        btn._versoesData = result.data;
      } else {
        btn.classList.add('d-none');
      }
    } catch (err) {
      btn.classList.add('d-none');
    }
  }

  async function showHistoricoModal() {
    const btn = document.getElementById('btn-livro-historico');
    const versoes = btn._versoesData;
    if (!versoes || !versoes.length) return;

    const setorId = Number(state.livroSetorSelecionado);
    const dtPlantao = document.getElementById('livro-data-plantao').value || getTodayIsoDate();
    const turno = getEscalaTurnoSelecionado() || 'M';

    let listHtml = '';
    versoes.forEach(v => {
      listHtml += `
        <div class="historico-item" data-versao="${v.NR_VERSAO}">
          <strong>Versão ${v.NR_VERSAO}</strong> — ${v.NM_USUARIO || 'Desconhecido'}<br>
          <small>${v.DT_CRIACAO || ''} · ${v.QTD_ITENS || 0} registros</small>
        </div>`;
    });

    const modalHtml = `
      <div class="modal-overlay" id="historico-modal-overlay">
        <div class="modal-card" style="max-width:500px">
          <div class="modal-header-row">
            <h3 style="margin:0">Histórico de versões</h3>
            <button class="modal-close-btn" id="historico-modal-fechar">&times;</button>
          </div>
          <div id="historico-modal-list">${listHtml}</div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.classList.add('modal-open');

    document.getElementById('historico-modal-overlay').addEventListener('click', function(e) {
      if (e.target === this || e.target.id === 'historico-modal-fechar') {
        this.remove();
        document.body.classList.remove('modal-open');
      }
    });

    document.querySelectorAll('#historico-modal-list .historico-item').forEach(function(item) {
      item.addEventListener('click', async () => {
        const versao = Number(item.dataset.versao);
        document.getElementById('historico-modal-overlay').remove();
        document.body.classList.remove('modal-open');
        try {
          const result = await api.get(
            `/api/escala-ativa/diff?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}&versao=${versao}`
          );
          if (result.success && result.data) {
        if (temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
           try {
              const draftRes = await api.get('/api/lote/draft');
              if (draftRes.success && draftRes.data && draftRes.data.setoresSelecionados) {
                 state.loteSectors = new Set(draftRes.data.setoresSelecionados.map(Number));
              }
           } catch(e) {}
        }

            showDiffModal(result.data, turno, versao);
          }
        } catch (err) {
          showToast('Erro ao carregar alterações', 'error');
        }
      });
    });
  }

  function showDiffModal(diff, turno, versao) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let bodyHtml = diff.alteracoes.map(a => formatDiffItem(a)).join('');

    overlay.innerHTML = `
      <div class="modal-card modal-card-diff">
        <div class="modal-header-row">
          <h3 style="margin:0"><i class="bi bi-clock-history"></i> Alterações — Versão ${versao}</h3>
          <button class="modal-close-btn" id="diff-modal-fechar">&times;</button>
        </div>
        <div class="modal-diff-meta">
          Usuário: ${escapeHtml(diff.nm_usuario || '')} &middot; ${escapeHtml(diff.data_plantao || '')} &middot; Turno: ${turno === 'N' ? 'Noturno' : 'Diurno'}
        </div>
        <div class="modal-diff-body">${bodyHtml}</div>
        <div class="modal-actions">
          <button class="modal-btn-secondary" id="diff-modal-ok">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    const close = () => {
      overlay.remove();
      document.body.classList.remove('modal-open');
    };
    overlay.querySelector('#diff-modal-fechar').onclick = close;
    overlay.querySelector('#diff-modal-ok').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
  }

  function formatDiffItem(a) {
    const icon = a.tipo === '+' ? '<span style="color:#16a34a">+</span>' : a.tipo === '-' ? '<span style="color:#dc2626">−</span>' : '<span style="color:#ca8a04">~</span>';

    if (a.secao === 'info') return `<div class="diff-info">${escapeHtml(a.texto)}</div>`;

    if (a.secao === 'enfermeiro') {
      const antes = getTecnicoNome(a.antes) || '(não informado)';
      const depois = getTecnicoNome(a.depois) || '(não informado)';
      return `<div class="diff-item"><strong>Enfermeiro:</strong> <span style="color:#dc2626;text-decoration:line-through">${escapeHtml(antes)}</span> → <span style="color:#16a34a">${escapeHtml(depois)}</span></div>`;
    }

    if (a.secao === 'tecnicos') {
      const nomeTec = getTecnicoNome(a.cd_pessoa_fisica) || `Técnico #${a.cd_pessoa_fisica || '?'}`;
      let texto = `<div class="diff-item">${icon} <strong>Técnicos:</strong> ${escapeHtml(nomeTec)}`;

      if (a.tipo === '+' && a.pacientes && a.pacientes.length) {
        texto += ` — ${a.pacientes.length} paciente(s): ${a.pacientes.map(p => escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      }
      if (a.tipo === '+' && a.patio_circulante && a.patio_circulante.length) {
        texto += ` [${a.patio_circulante.join(', ')}]`;
      }
      if (a.pacientes_adicionados && a.pacientes_adicionados.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#16a34a">+ Pacientes:</span> ${a.pacientes_adicionados.map(p => escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      }
      if (a.pacientes_removidos && a.pacientes_removidos.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#dc2626">− Pacientes:</span> ${a.pacientes_removidos.map(p => escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      }
      if (a.extras_adicionados && a.extras_adicionados.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#16a34a">+ Função:</span> ${a.extras_adicionados.join(', ')}`;
      }
      if (a.extras_removidos && a.extras_removidos.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#dc2626">− Função:</span> ${a.extras_removidos.join(', ')}`;
      }
      texto += '</div>';
      return texto;
    }

    if (a.secao === 'faltas_folgas') {
      const nomeTec = getTecnicoNome(a.cd_pessoa_fisica) || `Técnico #${a.cd_pessoa_fisica || '?'}`;
      return `<div class="diff-item">${icon} <strong>Faltas/Folgas:</strong> ${escapeHtml(nomeTec)} (${a.ff_tipo || ''})</div>`;
    }

    if (a.secao === 'avaliacao') {
      const nomeTec = getTecnicoNome(a.cd_pessoa_fisica) || `Técnico #${a.cd_pessoa_fisica || '?'}`;
      let texto = `<div class="diff-item">${icon} <strong>Avaliação:</strong> ${escapeHtml(nomeTec)}`;
      if (a.pacientes && a.pacientes.length) texto += ` — ${a.pacientes.map(p => escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      if (a.descricao) texto += ` (${escapeHtml(a.descricao)})`;
      texto += '</div>';
      return texto;
    }

    if (a.secao === 'observacoes') {
      return `<div class="diff-item"><strong>Observações:</strong><br>
        <span style="color:#dc2626;text-decoration:line-through">${escapeHtml(a.antes || '(vazio)')}</span><br>
        <span style="color:#16a34a">${escapeHtml(a.depois || '(vazio)')}</span></div>`;
    }

    return '';
  }

  function disableLivroForm() {
    document.getElementById('livro-setor').disabled = false;
    document.getElementById('livro-data-plantao').disabled = true;
    document.querySelectorAll('input[name="livro-turno"]').forEach(r => r.disabled = true);
    document.getElementById('livro-enfermeiro').disabled = true;
    document.getElementById('livro-observacoes').disabled = true;
    ['livro-ect-pre-procedimento', 'livro-ect-sala-procedimento', 'livro-ect-sala-recuperacao'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
    document.getElementById('btn-livro-salvar').classList.add('d-none');
    document.getElementById('btn-add-tecnico')?.classList.add('d-none');
    document.getElementById('btn-add-patio')?.classList.add('d-none');
    document.getElementById('btn-add-circulante')?.classList.add('d-none');
    document.getElementById('btn-add-falta')?.classList.add('d-none');
    document.getElementById('btn-add-avaliacao-externa')?.classList.add('d-none');
  }

  function enableLivroForm() {
    document.getElementById('livro-setor').disabled = false;
    document.getElementById('livro-data-plantao').disabled = false;
    document.querySelectorAll('input[name="livro-turno"]').forEach(r => r.disabled = false);
    document.getElementById('livro-enfermeiro').disabled = false;
    document.getElementById('livro-observacoes').disabled = false;
    ['livro-ect-pre-procedimento', 'livro-ect-sala-procedimento', 'livro-ect-sala-recuperacao'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
    document.getElementById('btn-livro-salvar').classList.remove('d-none');
    document.getElementById('btn-add-tecnico')?.classList.remove('d-none');
    document.getElementById('btn-add-patio')?.classList.remove('d-none');
    document.getElementById('btn-add-circulante')?.classList.remove('d-none');
    document.getElementById('btn-add-falta')?.classList.remove('d-none');
    document.getElementById('btn-add-avaliacao-externa')?.classList.remove('d-none');
  }

  function showLivroEditarBtn() {
    document.getElementById('btn-livro-editar')?.classList.remove('d-none');
  }

  function hideLivroEditarBtn() {
    document.getElementById('btn-livro-editar')?.classList.add('d-none');
  }

  function ensureLivroEditable() {
    enableLivroForm();
    hideLivroEditarBtn();
  }

  function setLivroFormLoading(loading) {
    const ids = [
      'btn-add-tecnico', 'btn-add-patio', 'btn-add-circulante',
      'btn-add-falta', 'btn-add-avaliacao-externa',
      'btn-livro-buscar', 'btn-livro-salvar', 'btn-livro-historico'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !!loading;
    });
  }

  function renderLivroSetorSelect() {
    const select = document.getElementById('livro-setor');
    if (!select) return;

    if (!state.livroSetores.length) {
      select.innerHTML = '<option value="">Nenhum setor disponível</option>';
      select.disabled = true;
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>';
    state.livroSetores.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.cd_setor_atendimento);
      option.textContent = item.ds_setor_atendimento;
      if (item.escala_liberada === true) {
        option.style.backgroundColor = '#d4edda';
        option.style.color = '#155724';
      } else if (item.escala_liberada === false) {
        option.style.backgroundColor = '#f8d7da';
        option.style.color = '#721c24';
      }
      select.appendChild(option);
    });

    select.disabled = false;

    if (Number.isInteger(state.livroSetorSelecionado)) {
      select.value = String(state.livroSetorSelecionado);
    } else if (state.livroSetores.length === 1) {
      select.value = String(state.livroSetores[0].cd_setor_atendimento);
      state.livroSetorSelecionado = Number(select.value);
    }
  }

  function renderLivroEnfermeiroSelect() {
    const select = document.getElementById('livro-enfermeiro');
    if (!select) return;

    if (!state.livroEnfermeiros.length) {
      select.innerHTML = '<option value="">Nenhum enfermeiro disponivel</option>';
      select.disabled = true;
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>';
    state.livroEnfermeiros.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.cd_pessoa_fisica);
      option.textContent = getEnfermeiroLabel(item);
      select.appendChild(option);
    });

    select.disabled = false;

    if (Number.isInteger(state.livroEnfermeiroSelecionado)) {
      select.value = String(state.livroEnfermeiroSelecionado);
    } else {
      const usuarioLogado = Number(state.usuario?.cd_pessoa_fisica);
      const existeLogado = state.livroEnfermeiros.some(
        item => Number(item.cd_pessoa_fisica) === usuarioLogado
      );

      if (Number.isInteger(usuarioLogado) && existeLogado) {
        state.livroEnfermeiroSelecionado = usuarioLogado;
      } else if (state.livroEnfermeiros.length === 1) {
        state.livroEnfermeiroSelecionado = Number(state.livroEnfermeiros[0].cd_pessoa_fisica);
      }

      if (Number.isInteger(state.livroEnfermeiroSelecionado)) {
        select.value = String(state.livroEnfermeiroSelecionado);
      }
    }
  }

  function buildTecnicoOptionsHtml(selectedId, emptyLabel = 'Selecione...') {
    const selected = Number(selectedId);
    const options = [
      `<option value="">${escapeHtml(emptyLabel)}</option>`,
      ...state.livroTecnicos.map(item => {
        const value = Number(item.cd_pessoa_fisica);
        const mark = Number.isInteger(selected) && selected === value ? 'selected' : '';
        return `<option value="${value}" ${mark}>${escapeHtml(getTecnicoLabel(item))}</option>`;
      })
    ];

    return options.join('');
  }

  function isTecnicoComPacientes(cdPessoaFisica, ignoreRowKey = null) {
    const tecnicoId = Number(cdPessoaFisica);
    if (!Number.isInteger(tecnicoId)) return false;

    return state.livroTecnicosSelecionados.some(row => {
      if (ignoreRowKey && row.row_key === ignoreRowKey) return false;
      return Number(row.cd_pessoa_fisica) === tecnicoId && Array.isArray(row.pacientes) && row.pacientes.length > 0;
    });
  }

  function isTecnicoEmListaFuncao(lista, cdPessoaFisica, ignoreRowKey = null) {
    const tecnicoId = Number(cdPessoaFisica);
    if (!Number.isInteger(tecnicoId)) return false;

    return (lista || []).some(row => {
      if (ignoreRowKey && row.row_key === ignoreRowKey) return false;
      return Number(row.cd_pessoa_fisica) === tecnicoId;
    });
  }

  function renderPatioList(locked) {
    const container = document.getElementById('livro-patio-list');
    if (!container) return;

    if (!state.livroPatio.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum técnico de pátio adicionado.</div>';
      return;
    }

    if (locked) {
      container.innerHTML = state.livroPatio
        .map((item, index) => `
          <div class="livro-item-card" data-row-key="${item.row_key}">
            <div class="livro-item-header">
              <span class="livro-item-title">Pátio ${index + 1}</span>
              <span class="livro-item-locked">${escapeHtml(item._nome || 'Técnico')}</span>
            </div>
          </div>`)
        .join('');
      const addBtn = document.getElementById('btn-add-patio');
      if (addBtn) addBtn.style.display = 'none';
      return;
    }

    const addBtn = document.getElementById('btn-add-patio');
    if (addBtn) addBtn.style.display = '';

    container.innerHTML = state.livroPatio
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Pátio ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="patio-select" data-row-key="${item.row_key}">
                ${buildTecnicoOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-patio" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  function renderCirculanteList(locked) {
    const container = document.getElementById('livro-circulante-list');
    if (!container) return;

    if (!state.livroCirculante.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum técnico circulante adicionado.</div>';
      return;
    }

    if (locked) {
      container.innerHTML = state.livroCirculante
        .map((item, index) => `
          <div class="livro-item-card" data-row-key="${item.row_key}">
            <div class="livro-item-header">
              <span class="livro-item-title">Circulante ${index + 1}</span>
              <span class="livro-item-locked">${escapeHtml(item._nome || 'Técnico')}</span>
            </div>
          </div>`)
        .join('');
      const addBtn = document.getElementById('btn-add-circulante');
      if (addBtn) addBtn.style.display = 'none';
      return;
    }

    const addBtn = document.getElementById('btn-add-circulante');
    if (addBtn) addBtn.style.display = '';

    container.innerHTML = state.livroCirculante
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Circulante ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="circulante-select" data-row-key="${item.row_key}">
                ${buildTecnicoOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-circulante" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  function addPacienteToAvaliacao(rowKey, atendimento) {
    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    const atendimentoId = Number(atendimento);
    if (!row || !Number.isInteger(atendimentoId)) return;

    if (!Number.isInteger(row.cd_pessoa_fisica)) {
      showToast('Selecione o técnico antes de adicionar pacientes', 'warning');
      return;
    }

    if (!row.pacientes.includes(atendimentoId)) {
      row.pacientes.push(atendimentoId);
    }
  }

  function removePacienteFromAvaliacao(rowKey, atendimento) {
    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    const atendimentoId = Number(atendimento);
    if (!row || !Number.isInteger(atendimentoId)) return;

    row.pacientes = row.pacientes.filter(item => Number(item) !== atendimentoId);
  }

  function getAutocompleteContextFromDescricao(input) {
    if (!input) return null;

    const text = String(input.value || '');
    const cursor = Number.isInteger(input.selectionStart) ? input.selectionStart : text.length;
    const trecho = text.slice(0, cursor);
    const match = trecho.match(/([A-Za-zÀ-ÿ]{2,})$/);
    if (!match) return null;

    return {
      query: match[1],
      tokenStart: cursor - match[1].length,
      tokenEnd: cursor
    };
  }

  function insertPacienteNomeNaDescricao(rowKey, atendimento, tokenStart, tokenEnd) {
    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    const atendimentoId = Number(atendimento);
    if (!row || !Number.isInteger(atendimentoId)) return;

    const paciente = state.livroPacientes.find(
      item => Number(item.nr_atendimento || item.atendimento) === atendimentoId
    );
    const nomePaciente = paciente?.nome || `Paciente ${atendimentoId}`;
    const descricaoOriginal = String(row.descricao || '');

    if (
      Number.isInteger(tokenStart) &&
      Number.isInteger(tokenEnd) &&
      tokenStart >= 0 &&
      tokenEnd >= tokenStart &&
      tokenEnd <= descricaoOriginal.length
    ) {
      const before = descricaoOriginal.slice(0, tokenStart);
      const after = descricaoOriginal.slice(tokenEnd);
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
      const needsSpaceAfter = after.length > 0 && !/^\s|^[,.;:!?)]/.test(after);
      row.descricao = `${before}${needsSpaceBefore ? ' ' : ''}${nomePaciente}${needsSpaceAfter ? ' ' : ''}${after}`;
      return;
    }

    row.descricao = descricaoOriginal ? `${descricaoOriginal} ${nomePaciente}` : nomePaciente;
  }

  function renderAvaliacaoAutocomplete(rowKey, context = null) {
    const dropdown = document.querySelector(`.autocomplete-dropdown[data-row-key="${rowKey}"]`);
    if (!dropdown) return;

    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    if (!row) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    const query = String(context?.query || '').trim().toLowerCase();
    if (!query || query.length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    if (Number.isInteger(context?.tokenStart) && Number.isInteger(context?.tokenEnd)) {
      dropdown.dataset.tokenStart = String(context.tokenStart);
      dropdown.dataset.tokenEnd = String(context.tokenEnd);
    } else {
      dropdown.dataset.tokenStart = '';
      dropdown.dataset.tokenEnd = '';
    }

    if (!Number.isInteger(row.cd_pessoa_fisica)) {
      dropdown.innerHTML = '<li>Selecione o técnico primeiro</li>';
      dropdown.classList.remove('hidden');
      return;
    }

    const sugestoes = state.livroPacientes
      .map(item => ({
        atendimento: Number(item.nr_atendimento || item.atendimento),
        nome: item.nome || 'Paciente',
        nome_civil: item.nome_civil || ''
      }))
      .filter(item => Number.isInteger(item.atendimento))
      .filter(item => `${item.nome} ${item.nome_civil}`.toLowerCase().includes(query))
      .filter(item => !row.pacientes.includes(item.atendimento))
      .slice(0, 10);

    if (!sugestoes.length) {
      dropdown.innerHTML = '<li>Nenhum paciente encontrado</li>';
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = sugestoes
      .map(item => `
        <li data-action="selecionar-paciente-avaliacao" data-row-key="${rowKey}" data-atendimento="${item.atendimento}">
          ${escapeHtml(item.nome)} <span class="livro-muted">(Atend. ${item.atendimento})</span>
          ${renderNomeCivilPaciente(item)}
        </li>`)
      .join('');
    dropdown.classList.remove('hidden');
  }

  function renderAvaliacaoList() {
    const container = document.getElementById('livro-avaliacao-externa-list');
    if (!container) return;

    if (!Number.isInteger(state.livroSetorSelecionado)) {
      container.innerHTML = '<div class="livro-muted">Selecione um setor para configurar avaliação externa.</div>';
      return;
    }

    if (!state.livroAvaliacaoExterna.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum card de avaliação externa adicionado.</div>';
      return;
    }

    container.innerHTML = state.livroAvaliacaoExterna
      .map((row, index) => {
        const tags = (row.pacientes || [])
          .map(atendimento => {
            const paciente = state.livroPacientes.find(item => Number(item.nr_atendimento || item.atendimento) === Number(atendimento));
            const nome = paciente?.nome || `Paciente ${atendimento}`;
            return `
              <span class="tag-paciente">
                ${escapeHtml(nome)} (Atend. ${atendimento})
                <button type="button" data-action="remover-paciente-avaliacao" data-row-key="${row.row_key}" data-atendimento="${atendimento}">&times;</button>
              </span>`;
          })
          .join('');

        return `
          <div class="livro-avaliacao-card" data-row-key="${row.row_key}">
            <div class="livro-avaliacao-header">
              <span class="livro-item-title">Técnico de Enfermagem ${index + 1}</span>
              <div class="livro-tecnico-actions">
                <select
                  class="form-select"
                  data-action="avaliacao-tecnico"
                  data-row-key="${row.row_key}"
                  aria-label="Técnico responsável pelo paciente na saída externa">
                  ${buildTecnicoOptionsHtml(row.cd_pessoa_fisica, 'Informe o técnico responsável pelo paciente na saída externa...')}
                </select>
                <button class="btn-sm btn-secondary" type="button" data-action="remover-avaliacao" data-row-key="${row.row_key}">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <div class="livro-avaliacao-body">
              <div class="paciente-search-wrapper">
                <textarea class="form-control paciente-descricao-input" data-row-key="${row.row_key}" placeholder="Ex.: Paciente Roberis saiu às 09h.">${escapeHtml(row.descricao || '')}</textarea>
                <div class="livro-avaliacao-helper">Digite o nome do paciente no meio do texto para autocompletar.</div>
                <ul class="autocomplete-dropdown hidden" data-row-key="${row.row_key}"></ul>
              </div>
              <div class="pacientes-tags">
                ${tags || '<span class="livro-muted">Nenhum paciente vinculado.</span>'}
              </div>
            </div>
          </div>`;
      })
      .join('');
  }

  function renderTecnicoRow(row, index) {
    const options = state.livroTecnicos
      .map(item => {
        const value = Number(item.cd_pessoa_fisica);
        const selected = Number(row.cd_pessoa_fisica) === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${escapeHtml(getTecnicoLabel(item))}</option>`;
      })
      .join('');

    const pacientesHtml = state.livroPacientes.length
      ? state.livroPacientes
          .map(item => {
            const atendimento = Number(item.nr_atendimento || item.atendimento);
            const checked = row.pacientes.includes(atendimento);
            const vinculado = state.livroPacienteVinculo.get(atendimento);
            const disabled =
              !Number.isInteger(row.cd_pessoa_fisica) ||
              (Number.isInteger(vinculado) && vinculado !== Number(row.cd_pessoa_fisica) && !checked);

            return `
            <label class="livro-checkbox-label ${disabled ? 'disabled' : ''}">
              <input
                type="checkbox"
                class="livro-paciente-checkbox"
                data-row-key="${row.row_key}"
                data-paciente-id="${atendimento}"
                ${checked ? 'checked' : ''}
                ${disabled ? 'disabled' : ''}>
              <span class="livro-paciente-label-text">
                <span>${escapeHtml(item.nome || 'Paciente')} (${atendimento})</span>
                ${renderNomeCivilPaciente(item)}
              </span>
            </label>`;
          })
          .join('')
      : '<div class="livro-muted">Selecione um setor para carregar pacientes.</div>';

    return `
      <div class="livro-tecnico-card" data-row-key="${row.row_key}">
        <div class="livro-tecnico-header">
          <span class="livro-tecnico-title">Técnico ${index + 1}</span>
          <div class="livro-tecnico-actions">
            <select class="form-select livro-tecnico-select" data-action="tecnico-select" data-row-key="${row.row_key}">
              <option value="">Selecione...</option>
              ${options}
            </select>
            <button class="btn-sm btn-secondary" type="button" data-action="remover-tecnico" data-row-key="${row.row_key}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="livro-pacientes-grid">
          ${pacientesHtml}
        </div>
      </div>`;
  }

  function renderTecnicosList() {
    const container = document.getElementById('livro-tecnicos-list');
    if (!container) return;

    refreshLivroPacienteVinculo();

    if (!state.livroTecnicosSelecionados.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum técnico adicionado.</div>';
      renderAvaliacaoList();
      renderPatioList();
      renderCirculanteList();
      return;
    }

    container.innerHTML = state.livroTecnicosSelecionados
      .map((item, index) => renderTecnicoRow(item, index))
      .join('');

    renderAvaliacaoList();
    renderPatioList();
    renderCirculanteList();
  }

  function renderFaltasFolgasList() {
    const container = document.getElementById('livro-faltas-list');
    if (!container) return;

    if (!state.livroFaltasFolgas.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum item de falta/folga adicionado.</div>';
      return;
    }

    const tecnicoOptions = state.livroTecnicos
      .map(item => `<option value="${item.cd_pessoa_fisica}">${escapeHtml(getTecnicoLabel(item))}</option>`)
      .join('');

    container.innerHTML = state.livroFaltasFolgas
      .map((item, index) => {
        const selectedFalta = item.tipo === 'Falta' ? 'checked' : '';
        const selectedFolga = item.tipo === 'Folga' ? 'checked' : '';
        const value = Number.isInteger(item.cd_pessoa_fisica) ? String(item.cd_pessoa_fisica) : '';
        const label = item.tipo === 'Folga' ? 'Folga' : 'Falta';

        return `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">${label} ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <button class="btn-sm btn-secondary" type="button" data-action="remover-falta" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <div class="livro-item-body">
            <select class="form-select" style="max-width:260px" data-action="falta-tecnico" data-row-key="${item.row_key}">
              <option value="">Selecione o técnico...</option>
              ${tecnicoOptions}
            </select>
            <div class="livro-falta-tipo">
              <label><input type="radio" name="falta_tipo_${item.row_key}" value="Falta" data-action="falta-tipo" data-row-key="${item.row_key}" ${selectedFalta}> Falta</label>
              <label><input type="radio" name="falta_tipo_${item.row_key}" value="Folga" data-action="falta-tipo" data-row-key="${item.row_key}" ${selectedFolga}> Folga</label>
            </div>
          </div>
        </div>`;
      })
      .join('');

    container.querySelectorAll('[data-action="falta-tecnico"]').forEach(select => {
      const row = state.livroFaltasFolgas.find(item => item.row_key === select.dataset.rowKey);
      if (row && Number.isInteger(row.cd_pessoa_fisica)) {
        select.value = String(row.cd_pessoa_fisica);
      }
    });
  }

  async function loadSetoresLivro() {
    const select = document.getElementById('livro-setor');
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Carregando...</option>';
    }

    try {
      const dataPlantao = document.getElementById('livro-data-plantao')?.value || getTodayIsoDate();
      const turno = getEscalaTurnoSelecionado();
      const result = await api.get(`/api/setores-livro?data=${dataPlantao}&turno=${turno}`);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar setores do livro');
      }

      const unicos = [];
      const seen = new Set();
      result.data.forEach(item => {
        const id = Number(item.cd_setor_atendimento);
        if (!Number.isInteger(id) || seen.has(id)) return;
        seen.add(id);
        unicos.push(item);
      });

      state.livroSetores = unicos;
      renderLivroSetorSelect();

      if (state.livroSetorSelecionado) {
        await loadPacientesSetor(state.livroSetorSelecionado);
      }
    } catch (err) {
      state.livroSetores = [];
      renderLivroSetorSelect();
      showToast(err.message || 'Erro ao carregar setores do livro', 'error');
    }
  }

  async function loadEnfermeiros() {
    const select = document.getElementById('livro-enfermeiro');
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Carregando...</option>';
    }

    try {
      const result = await api.get('/api/enfermeiros');
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar enfermeiros');
      }
      state.livroEnfermeiros = result.data;
      renderLivroEnfermeiroSelect();
      renderLivroEctSelects();
    } catch (err) {
      state.livroEnfermeiros = [];
      renderLivroEnfermeiroSelect();
      renderLivroEctSelects();
      showToast(err.message || 'Erro ao carregar enfermeiros', 'error');
    }
  }

  async function loadTecnicos() {
    try {
      const result = await api.get('/api/tecnicos');
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar técnicos');
      }
      state.livroTecnicos = result.data;
      renderTecnicosList();
      renderFaltasFolgasList();
      renderPatioList();
      renderCirculanteList();
      renderAvaliacaoList();
      renderLivroEctSelects();
    } catch (err) {
      state.livroTecnicos = [];
      renderTecnicosList();
      renderFaltasFolgasList();
      renderPatioList();
      renderCirculanteList();
      renderAvaliacaoList();
      renderLivroEctSelects();
      showToast(err.message || 'Erro ao carregar técnicos', 'error');
    }
  }

  async function loadPacientesSetor(cdSetor) {
    const setorId = Number(cdSetor);
    if (!Number.isInteger(setorId)) {
      state.livroPacientes = [];
      renderTecnicosList();
      renderAvaliacaoList();
      return;
    }

    try {
      const result = await api.get(`/api/pacientes-setor/${encodeURIComponent(String(setorId))}`);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar pacientes do setor');
      }
      state.livroPacientes = result.data;
    } catch (err) {
      state.livroPacientes = [];
      showToast(err.message || 'Erro ao carregar pacientes do setor', 'error');
    }

    refreshLivroPacienteVinculo();
    renderTecnicosList();
    renderAvaliacaoList();
  }

  function hydrateLivroFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return;

    const dateInput = document.getElementById('livro-data-plantao');
    if (payload.data_plantao && !dateInput.value) {
      dateInput.value = payload.data_plantao;
    }

    const turnoPayload =
      payload.turno === 'N' ||
      (payload.hora_inicio === '19:00' && payload.hora_fim === '07:00')
        ? 'N'
        : 'M';
    document.querySelectorAll('input[name="livro-turno"]').forEach(radio => {
      radio.checked = radio.value === turnoPayload;
    });

    const enfermeiroId = Number(payload.enfermeiro_cd_pessoa_fisica);
    state.livroEnfermeiroSelecionado = Number.isInteger(enfermeiroId) ? enfermeiroId : null;
    renderLivroEnfermeiroSelect();

    if (typeof payload.observacoes === 'string') {
      document.getElementById('livro-observacoes').value = payload.observacoes;
    }

    state.livroPatio = [];
    state.livroCirculante = [];
    state.livroTecnicosSelecionados = [];

    if (Array.isArray(payload.tecnicos) && payload.tecnicos.length > 0) {
      payload.tecnicos.forEach(item => {
        const cdPessoa = Number(item.cd_pessoa_fisica);
        if (!Number.isInteger(cdPessoa)) return;

        const pacientes = Array.isArray(item.pacientes) ? item.pacientes.map(Number).filter(Number.isInteger) : [];
        const extras = Array.isArray(item.patio_circulante)
          ? [
              ...new Set(
                item.patio_circulante
                  .map(extra => String(extra || '').toLowerCase())
                  .map(extra => {
                    if (extra === 'patio' || extra === 'p\u00e1tio') return 'Patio';
                    if (extra === 'circulante') return 'Circulante';
                    return '';
                  })
                  .filter(Boolean)
              )
            ]
          : [];

        if (pacientes.length > 0) {
          state.livroTecnicosSelecionados.push({
            row_key: nextLivroRowKey('tec'),
            cd_pessoa_fisica: cdPessoa,
            pacientes
          });
        }

        if (extras.includes('Patio')) {
          state.livroPatio.push({
            row_key: nextLivroRowKey('patio'),
            cd_pessoa_fisica: cdPessoa
          });
        }

        if (extras.includes('Circulante')) {
          state.livroCirculante.push({
            row_key: nextLivroRowKey('circulante'),
            cd_pessoa_fisica: cdPessoa
          });
        }
      });
    }

    if (state.livroTecnicosSelecionados.length === 0) {
      state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    }

    if (Array.isArray(payload.faltas_folgas)) {
      state.livroFaltasFolgas = payload.faltas_folgas.map(item => ({
        row_key: nextLivroRowKey('falta'),
        cd_pessoa_fisica: Number(item.cd_pessoa_fisica) || null,
        tipo: item.tipo === 'Folga' ? 'Folga' : 'Falta'
      }));
    } else {
      state.livroFaltasFolgas = [];
    }

    if (Array.isArray(payload.avaliacao_externa) && payload.avaliacao_externa.length > 0) {
      if (typeof payload.avaliacao_externa[0] === 'object' && payload.avaliacao_externa[0] !== null) {
        state.livroAvaliacaoExterna = payload.avaliacao_externa.map(item => ({
          row_key: nextLivroRowKey('avaliacao'),
          cd_pessoa_fisica: Number.isInteger(Number(item.cd_pessoa_fisica)) ? Number(item.cd_pessoa_fisica) : null,
          pacientes: Array.isArray(item.pacientes) ? item.pacientes.map(Number).filter(Number.isInteger) : [],
          descricao: typeof item.descricao === 'string' ? item.descricao : ''
        }));
      } else {
        const pacientes = [...new Set(payload.avaliacao_externa.map(Number).filter(Number.isInteger))];
        state.livroAvaliacaoExterna = pacientes.length
          ? [
              {
                row_key: nextLivroRowKey('avaliacao'),
                cd_pessoa_fisica: null,
                pacientes,
                descricao: ''
              }
            ]
          : [];
      }
    } else {
      state.livroAvaliacaoExterna = [];
    }

    if (payload.ect) {
      const preList = Array.isArray(payload.ect.pre_procedimento)
        ? payload.ect.pre_procedimento
        : (Number.isInteger(Number(payload.ect.pre_procedimento)) ? [Number(payload.ect.pre_procedimento)] : []);
      const salaList = Array.isArray(payload.ect.sala_procedimento)
        ? payload.ect.sala_procedimento
        : (Number.isInteger(Number(payload.ect.sala_procedimento)) ? [Number(payload.ect.sala_procedimento)] : []);
      const recList = Array.isArray(payload.ect.sala_recuperacao)
        ? payload.ect.sala_recuperacao
        : (Number.isInteger(Number(payload.ect.sala_recuperacao)) ? [Number(payload.ect.sala_recuperacao)] : []);

      state.livroEctPre = preList.map(cd => ({
        row_key: nextLivroRowKey('ect_pre'),
        cd_pessoa_fisica: Number.isInteger(Number(cd)) ? Number(cd) : null
      }));
      state.livroEctSala = salaList.map(cd => ({
        row_key: nextLivroRowKey('ect_sala'),
        cd_pessoa_fisica: Number.isInteger(Number(cd)) ? Number(cd) : null
      }));
      state.livroEctRecuperacao = recList.map(cd => ({
        row_key: nextLivroRowKey('ect_rec'),
        cd_pessoa_fisica: Number.isInteger(Number(cd)) ? Number(cd) : null
      }));
    } else {
      state.livroEctPre = [];
      state.livroEctSala = [];
      state.livroEctRecuperacao = [];
    }

    updateLivroSectionsVisibility();
    renderLivroEctSelects();
    refreshLivroPacienteVinculo();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
  }

  function fillLivroDefaults() {
    const dateInput = document.getElementById('livro-data-plantao');
    if (dateInput && !dateInput.value) {
      dateInput.value = getTodayIsoDate();
    }

    const turnoSelecionado = getEscalaTurnoSelecionado();
    if (!turnoSelecionado) {
      const turnoManha = document.querySelector('input[name="livro-turno"][value="M"]');
      if (turnoManha) turnoManha.checked = true;
    }

    if (state.livroTecnicosSelecionados.length === 0) {
      state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    }
    if (state.livroFaltasFolgas.length === 0) {
      state.livroFaltasFolgas = [];
    }
    if (!Array.isArray(state.livroAvaliacaoExterna)) {
      state.livroAvaliacaoExterna = [];
    }
    if (!Array.isArray(state.livroPatio)) {
      state.livroPatio = [];
    }
    if (!Array.isArray(state.livroCirculante)) {
      state.livroCirculante = [];
    }

    renderLivroEnfermeiroSelect();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
  }

  // --- Escala (Psicologia) ---
  const workspaceEscala = document.getElementById('workspace-escala');
  let escalasPsicologiaLiberadas = [];

  function restoreEscalaDraft(draft) {
    if (!draft) return;
    draftHydratingModules.add('escala');
    try {
      const monthInput = document.getElementById('escala-mes');
      if (monthInput && draft.month) monthInput.value = draft.month;
      state.escalaSemanalCells = {
        ...(state.escalaSemanalCells || {}),
        ...(cloneDraftValue(draft.pendingCells, {}) || {})
      };
      state.escalaEdicao = cloneDraftValue(draft.editor, null);
      renderEscalaSemanal();
      atualizarBotaoPublicarEscala();
    } finally {
      draftHydratingModules.delete('escala');
      updateTopbarDraftIndicators();
    }
  }

  async function enterEscalaMode() {
    activateWorkspace('escala', workspaceEscala);
    const escalaDraft = getModuleDraft('escala');
    
    // Atualizar UI caso haja ou não permissão de edição
    const btnPublicar = document.getElementById('btn-escala-publicar');
    const btnSalvar = document.getElementById('btn-escala-salvar');
    const observacaoInput = document.getElementById('escala-observacoes');
    const btnAddPsi = document.getElementById('btn-add-psicologo');
    
    // Verifica capability no frontend
    const canEdit = temPermissaoAtiva('escala', 'editar_publicar_escala');
    
    if (canEdit) {
      if (btnPublicar) btnPublicar.classList.remove('d-none');
      if (btnSalvar) btnSalvar.classList.remove('d-none');
      if (btnAddPsi) btnAddPsi.classList.remove('d-none');
      if (observacaoInput) observacaoInput.disabled = false;
    } else {
      if (btnPublicar) btnPublicar.classList.add('d-none');
      if (btnSalvar) btnSalvar.classList.add('d-none');
      if (btnAddPsi) btnAddPsi.classList.add('d-none');
      if (observacaoInput) observacaoInput.disabled = true;
    }

    if (!state.escalaLoaded) {
      const dataInput = document.getElementById('escala-data-plantao');
      if (dataInput && !dataInput.value) {
        dataInput.value = getTodayIsoDate();
      }
      
      state.escalaPsicologiaItens = [];
      
      if (!state.profissionaisPsicologia || state.profissionaisPsicologia.length === 0) {
        try {
          const result = await api.get('/api/profissionais-psicologia');
          if (result.success) {
            state.profissionaisPsicologia = result.data;
          }
        } catch (err) {
          console.error('Erro ao carregar psicologos', err);
          state.profissionaisPsicologia = [];
        }
      }
      
      initializeEscalaSemanal();
      state.escalaLoaded = true;
    }
    if (escalaDraft) restoreEscalaDraft(escalaDraft);
    return;
  }

  function getHolidays(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, month - 1, day);

    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const formatDate = d => {
      const mn = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${mn}-${dy}`;
    };

    const carnaval = addDays(easter, -47);
    const sextaSanta = addDays(easter, -2);
    const corpusChristi = addDays(easter, 60);

    return {
      '01-01': 'Ano Novo',
      '04-21': 'Tiradentes',
      '05-01': 'Dia do Trabalho',
      '09-07': 'Independência',
      '10-12': 'N. Sra Aparecida',
      '11-02': 'Finados',
      '11-15': 'Proc. República',
      '11-20': 'Consciência Negra',
      '12-25': 'Natal',
      '08-15': 'Assunção N.S. (BH)',
      '12-08': 'Imaculada C. (BH)',
      [formatDate(carnaval)]: 'Carnaval',
      [formatDate(sextaSanta)]: 'Sexta-feira Santa',
      [formatDate(corpusChristi)]: 'Corpus Christi'
    };
  }

  function getFeriado(date) {
    const year = date.getFullYear();
    const formatted = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const holidays = getHolidays(year);
    return holidays[formatted] || null;
  }

  function getMonday(date) {
    const value = new Date(`${date}T12:00:00`);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatShortDate(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  async function initializeEscalaSemanal() {
    const monthInput = document.getElementById('escala-mes');
    if (!monthInput.value) monthInput.value = getTodayIsoDate().slice(0, 7);
    state.escalaSemanaInicial = getMonday(getTodayIsoDate());
    state.escalaSemanasPassadas = 0;
    state.escalaSemanasVisiveis = 2;
    await loadEscalaSemanal();
  }

  async function loadEscalaSemanal() {
    const list = document.getElementById('escala-week-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando escalas...</div>';
    const inicio = new Date(state.escalaSemanaInicial);
    inicio.setDate(inicio.getDate() - (state.escalaSemanasPassadas * 7));
    const fim = new Date(state.escalaSemanaInicial);
    fim.setDate(fim.getDate() + (state.escalaSemanasVisiveis * 7) - 1);
    try {
      const result = await api.get(`/api/escala-ativa/periodo?cd_setor=4&data_inicio=${formatIsoDate(inicio)}&data_fim=${formatIsoDate(fim)}`);
      const pendingCells = {};
      Object.entries(state.escalaSemanalCells || {}).forEach(([key, value]) => {
        if (value?.pendente_publicacao) pendingCells[key] = value;
      });
      state.escalaSemanalCells = {
        ...(result.success ? result.data : {}),
        ...pendingCells
      };
      renderEscalaSemanal();
    } catch (err) {
      list.innerHTML = '<div class="loading-placeholder">Não foi possível carregar as escalas.</div>';
      showToast('Erro ao carregar escalas do período.', 'error');
    }
  }

  function renderEscalaSemanal() {
    const list = document.getElementById('escala-week-list');
    const query = (document.getElementById('escala-filtro-profissional')?.value || '').trim().toLowerCase();
    const turnoFiltro = document.querySelector('.escala-turno-filter button.active')?.dataset.turno || '';
    const canEdit = temPermissaoAtiva('escala', 'editar_publicar_escala');
    if (!list) return;
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    let html = '';
    for (let week = -state.escalaSemanasPassadas; week < state.escalaSemanasVisiveis; week += 1) {
      const monday = new Date(state.escalaSemanaInicial);
      monday.setDate(monday.getDate() + week * 7);
      const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
      html += `<section class="escala-week-card"><header><strong>Semana — ${formatShortDate(monday)} a ${formatShortDate(sunday)}</strong><span class="escala-week-status ${week === 0 ? 'active' : ''}">${week < 0 ? 'Passada' : week === 0 ? 'Ativa' : 'Futura'}</span></header><div class="escala-table"><div class="escala-table-head"><span>Turno</span>${days.map((day, index) => { const d = new Date(monday); d.setDate(d.getDate() + index); const feriado = getFeriado(d); return `<span class="${feriado ? 'escala-feriado-col' : ''}">${day}<small>${formatShortDate(d)}</small>${feriado ? `<div class="escala-feriado-badge" title="${feriado}">${feriado}</div>` : ''}</span>`; }).join('')}</div>`;
      [['M', 'Manhã'], ['N', 'Tarde']].forEach(([turno, label]) => {
        if (turnoFiltro && turnoFiltro !== turno) return;
        html += `<div class="escala-table-row"><strong>${label}</strong>`;
        for (let day = 0; day < 7; day += 1) {
          const date = new Date(monday); date.setDate(date.getDate() + day);
          const iso = formatIsoDate(date);
          const escala = state.escalaSemanalCells?.[`${iso}-${turno}`];
          const key = `${iso}-${turno}`;
          const editing = canEdit && state.escalaEdicao?.key === key;
          const profissionais = editing ? state.escalaEdicao.profissionais : (escala?.profissionais || []).map(item => Number(item.cd_pessoa_fisica));
          const chips = profissionais.map(cdPessoa => {
            const profissional = (state.profissionaisPsicologia || []).find(item => Number(item.cd_pessoa_fisica) === Number(cdPessoa));
            const nome = profissional?.nome || `Profissional ${cdPessoa}`;
            return !query || nome.toLowerCase().includes(query) ? `<span class="escala-chip" title="${escapeHtml(nome)}"><i class="bi bi-person"></i><span class="escala-chip-name">${escapeHtml(nome)}</span>${editing ? `<button class="escala-chip-remove" data-cd-pessoa="${cdPessoa}" type="button" aria-label="Remover profissional"><i class="bi bi-x"></i></button>` : ''}</span>` : '';
          }).join('');
          const editControls = editing ? `<div class="escala-cell-editor"><select class="escala-profissional-select" aria-label="Adicionar profissional"><option value="">Selecione...</option>${(state.profissionaisPsicologia || []).filter(p => !profissionais.includes(Number(p.cd_pessoa_fisica))).map(p => { const total = Number(p.plantoes_ultimas_4_semanas || 0); return `<option value="${p.cd_pessoa_fisica}">${escapeHtml(p.nome)} — ${total} ${total === 1 ? 'Plantão' : 'Plantões'}</option>`; }).join('')}</select><button class="escala-cell-save" type="button"><i class="bi bi-check-lg"></i></button><button class="escala-cell-cancel" type="button"><i class="bi bi-x-lg"></i></button></div>` : '';
          html += `<div class="escala-cell" data-date="${iso}" data-turno="${turno}">${chips || '<span class="escala-cell-empty">Adicionar profissional</span>'}${editControls}</div>`;
        }
        html += '</div>';
      });
      html += '</div></section>';
    }
    list.innerHTML = html;
    list.querySelectorAll('.escala-cell').forEach(cell => cell.addEventListener('click', event => {
      if (event.target.closest('select, button')) return;
      if (canEdit) editEscalaCell(cell.dataset.date, cell.dataset.turno);
    }));
    list.querySelectorAll('.escala-profissional-select').forEach(select => select.addEventListener('change', event => {
      const cell = event.target.closest('.escala-cell');
      if (!event.target.value) return;
      state.escalaEdicao.profissionais.push(Number(event.target.value));
      markModuleDraftDirty('escala');
      renderEscalaSemanal();
    }));
    list.querySelectorAll('.escala-chip-remove').forEach(button => button.addEventListener('click', event => {
      const cdPessoa = Number(event.currentTarget.dataset.cdPessoa);
      state.escalaEdicao.profissionais = state.escalaEdicao.profissionais.filter(id => id !== cdPessoa);
      markModuleDraftDirty('escala');
      renderEscalaSemanal();
    }));
    list.querySelectorAll('.escala-cell-cancel').forEach(button => button.addEventListener('click', () => {
      state.escalaEdicao = null;
      const hasPending = Object.values(state.escalaSemanalCells || {}).some(item => item?.pendente_publicacao);
      if (hasPending) markModuleDraftDirty('escala');
      else clearModuleDraft('escala');
      renderEscalaSemanal();
    }));
    list.querySelectorAll('.escala-cell-save').forEach(button => button.addEventListener('click', event => {
      const cell = event.currentTarget.closest('.escala-cell');
      saveEscalaCell(cell.dataset.date, cell.dataset.turno);
    }));
  }

  async function editEscalaCell(dataPlantao, turno) {
    try {
      const result = await api.get(`/api/profissionais-psicologia?data_referencia=${encodeURIComponent(dataPlantao)}`);
      if (result.success && Array.isArray(result.data)) state.profissionaisPsicologia = result.data;
    } catch (err) {
      showToast('Não foi possível atualizar a contagem de plantões.', 'warning');
    }
    const escala = state.escalaSemanalCells?.[`${dataPlantao}-${turno}`] || null;
    state.escalaEdicao = {
      key: `${dataPlantao}-${turno}`,
      profissionais: (escala?.profissionais || []).map(item => Number(item.cd_pessoa_fisica))
    };
    renderEscalaSemanal();
  }

  async function saveEscalaCell(dataPlantao, turno) {
    const escala = state.escalaSemanalCells?.[`${dataPlantao}-${turno}`] || null;
    const profissionais = state.escalaEdicao?.profissionais || [];
    if (profissionais.length === 0) return showToast('Adicione ao menos um profissional.', 'warning');
    const payload = { tipo_escala: 'PSICOLOGIA', cd_modulo: 4, cd_setor_atendimento: 4, data_plantao: dataPlantao, turno, profissionais: profissionais.map(cd_pessoa_fisica => ({ cd_pessoa_fisica })), observacoes: escala?.observacoes || '' };
    state.escalaSemanalCells[`${dataPlantao}-${turno}`] = { ...payload, nr_versao: escala?.nr_versao || null, pendente_publicacao: true };
    state.escalaEdicao = null;
    markModuleDraftDirty('escala');
    renderEscalaSemanal();
    atualizarBotaoPublicarEscala();
    showToast('Alteração incluída. Clique em Salvar/Publicar escala para concluir.', 'success');
  }

  document.getElementById('escala-mes')?.addEventListener('change', async event => {
    state.escalaSemanaInicial = getMonday(`${event.target.value}-01`);
    state.escalaSemanasPassadas = 0;
    state.escalaSemanasVisiveis = 2;
    await loadEscalaSemanal();
  });
  document.getElementById('escala-filtro-profissional')?.addEventListener('input', renderEscalaSemanal);
  document.querySelectorAll('.escala-turno-filter button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.escala-turno-filter button').forEach(item => item.classList.remove('active'));
    button.classList.add('active'); renderEscalaSemanal();
  }));
  document.getElementById('btn-escala-semanas-passadas')?.addEventListener('click', async () => {
    state.escalaSemanasPassadas += 2;
    await loadEscalaSemanal();
  });
  document.getElementById('btn-escala-mais-semanas')?.addEventListener('click', async () => { state.escalaSemanasVisiveis += 2; await loadEscalaSemanal(); });
  function setEscalaPublicacaoFeedback(message = '', type = '') {
    const feedback = document.getElementById('escala-publicacao-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `escala-publicacao-feedback ${type}`;
  }

  function atualizarBotaoPublicarEscala() {
    const button = document.getElementById('btn-escala-publicar');
    if (!button || button.disabled) return;
    const quantidade = Object.values(state.escalaSemanalCells || {}).filter(escala => escala?.pendente_publicacao).length;
    button.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar/Publicar escala${quantidade ? ` (${quantidade})` : ''}`;
    setEscalaPublicacaoFeedback(quantidade ? `${quantidade} alteração(ões) pendente(s) de publicação.` : 'Nenhuma alteração pendente.', quantidade ? 'info' : '');
  }

  document.getElementById('btn-escala-limpar')?.addEventListener('click', async () => {
    const pendentes = Object.values(state.escalaSemanalCells || {}).filter(escala => escala?.pendente_publicacao);
    if (pendentes.length === 0) {
      setEscalaPublicacaoFeedback('Não há alterações locais para limpar.', 'info');
      return;
    }
    if (!await showConfirmModal('Limpar alterações', 'Deseja descartar todas as alterações ainda não publicadas?')) return;
    state.escalaEdicao = null;
    state.escalaSemanalCells = Object.fromEntries(
      Object.entries(state.escalaSemanalCells || {}).filter(([, escala]) => !escala?.pendente_publicacao)
    );
    await loadEscalaSemanal();
    clearModuleDraft('escala');
    atualizarBotaoPublicarEscala();
    setEscalaPublicacaoFeedback('Alterações locais descartadas.', 'info');
  });

  document.getElementById('btn-escala-publicar')?.addEventListener('click', async () => {
    const pendentes = Object.values(state.escalaSemanalCells || {}).filter(escala => escala?.pendente_publicacao);
    if (pendentes.length === 0) {
      setEscalaPublicacaoFeedback('Não há alterações pendentes para publicar.', 'warning');
      showToast('Não há alterações pendentes para publicar.', 'info');
      return;
    }
    setEscalaPublicacaoFeedback(`Publicando ${pendentes.length} alteração(ões)...`, 'info');

    const existentes = pendentes.filter(escala => escala.nr_versao);
    let justificativa = '';
    if (existentes.length > 0) {
      justificativa = await showJustificativaModal();
      if (!justificativa?.trim()) {
        setEscalaPublicacaoFeedback('A justificativa é obrigatória para publicar alterações.', 'warning');
        showToast('A justificativa é obrigatória para editar uma escala publicada.', 'warning');
        return;
      }
    }

    const button = document.getElementById('btn-escala-publicar');
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Publicando...';
    try {
      for (const escala of pendentes) {
        const payload = { ...escala, ds_justificativa: escala.nr_versao ? justificativa.trim() : '' };
        const save = await api.put('/api/escala-ativa', payload);
        if (!save.success) throw new Error(save.message);
        escala.nr_versao = save.data?.versao || escala.nr_versao || 1;
      }

      const porSemana = new Map();
      pendentes.forEach(escala => {
        const inicioSemana = formatIsoDate(getMonday(escala.data_plantao));
        if (!porSemana.has(inicioSemana)) porSemana.set(inicioSemana, []);
        porSemana.get(inicioSemana).push(escala);
      });
      for (const escalasSemana of porSemana.values()) {
        const publicacao = await api.post('/api/escala-psicologia/publicar', {
          cd_modulo: 4,
          cd_setor_atendimento: 4,
          escalas: escalasSemana.map(escala => ({
            data_plantao: escala.data_plantao,
            turno: escala.turno,
            profissionais: escala.profissionais,
            observacoes: escala.observacoes || ''
          })),
          ds_justificativa: justificativa.trim()
        });
        if (!publicacao.success) throw new Error(publicacao.message);
      }

      pendentes.forEach(escala => { escala.pendente_publicacao = false; });
      clearModuleDraft('escala');
      renderEscalaSemanal();
      atualizarBotaoPublicarEscala();
      showToast('Escala publicada com sucesso.', 'success');
      await showModal('success', 'Sucesso!', 'Escala publicada na semana selecionada.');
    } catch (err) {
      showToast(err.message || 'Não foi possível publicar a escala.', 'error');
      await showModal('error', 'Falha ao publicar', err.message || 'Não foi possível publicar a escala.');
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar/Publicar escala';
    }
  });

  function fecharModalImpressaoEscala() {
    document.getElementById('modal-escala-print-overlay')?.classList.add('d-none');
    document.body.classList.remove('modal-open');
  }

  async function carregarSemanasLiberadasParaImpressao() {
    const mes = document.getElementById('escala-print-mes')?.value || getTodayIsoDate().slice(0, 7);
    const container = document.getElementById('escala-print-semanas');
    const confirmar = document.getElementById('btn-escala-print-confirmar');
    if (!container) return;
    container.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando semanas liberadas...</div>';
    if (confirmar) confirmar.disabled = true;
    try {
      const result = await api.get(`/api/escala-psicologia/liberadas?mes=${encodeURIComponent(mes)}`);
      escalasPsicologiaLiberadas = result.success && Array.isArray(result.data) ? result.data : [];
      if (escalasPsicologiaLiberadas.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Nenhuma semana liberada encontrada neste mês.</div>';
        return;
      }
      container.innerHTML = escalasPsicologiaLiberadas.map((item, index) => `
        <label class="escala-print-week-option">
          <input type="checkbox" value="${index}" checked>
          <span><strong>${escapeHtml(formatIsoDatePtBr(item.semana_inicio))} a ${escapeHtml(formatIsoDatePtBr(item.semana_fim))}</strong><small> Liberada por ${escapeHtml(item.nm_usuario || '-')} em ${escapeHtml(formatPrintReleaseDate(item.dt_liberacao))}</small></span>
        </label>`).join('');
      if (confirmar) confirmar.disabled = false;
    } catch (err) {
      container.innerHTML = '<div class="loading-placeholder">Não foi possível carregar as semanas liberadas.</div>';
      showToast(err?.message || 'Erro ao buscar escalas liberadas', 'error');
    }
  }

  function formatIsoDatePtBr(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
  }

  function formatCancelamentoDate(value) {
    if (!value) return '';
    if (value instanceof Date) {
      return value.toLocaleDateString('pt-BR');
    }
    const dateOnly = String(value).replace(' ', 'T').slice(0, 10);
    return formatIsoDatePtBr(dateOnly);
  }

  function addIsoDays(value, days) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function buildEscalaPsicologiaPrintPage(item) {
    const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const datas = diasSemana.map((_, index) => addIsoDays(item.semana_inicio, index));
    const celula = (data, turno) => {
      const escala = (item.escalas || []).find(row => row.data_plantao === data && row.turno === turno);
      const nomes = (escala?.profissionais || []).map(profissional => profissional.nome).filter(Boolean);
      const observacao = String(escala?.observacoes || '').trim();
      return `<td>${nomes.length ? nomes.map(nome => `<div class="nome">${escapeHtml(nome)}</div>`).join('') : '<span class="vazio">Sem profissional</span>'}${observacao ? `<div class="obs">${escapeHtml(observacao)}</div>` : ''}</td>`;
    };
    return `<div class="week-section"><div class="week-title">Semana de ${escapeHtml(formatIsoDatePtBr(item.semana_inicio))} a ${escapeHtml(formatIsoDatePtBr(item.semana_fim))} <span style="float:right;font-size:9px;font-weight:normal;color:#52627a">Liberada por ${escapeHtml(item.nm_usuario || '-')} em ${escapeHtml(formatPrintReleaseDate(item.dt_liberacao))}</span></div><table><thead><tr><th>Turno</th>${datas.map((data, index) => `<th>${diasSemana[index]}<small>${formatIsoDatePtBr(data)}</small></th>`).join('')}</tr></thead><tbody><tr><th>Manhã</th>${datas.map(data => celula(data, 'M')).join('')}</tr><tr><th>Tarde</th>${datas.map(data => celula(data, 'N')).join('')}</tr></tbody></table></div>`;
  }

  function imprimirSemanasPsicologia(semanas) {
    const popup = window.open('', '_blank', 'width=1200,height=850');
    if (!popup) return showToast('Libere pop-ups no navegador para imprimir.', 'warning');
    const paginas = semanas.map(buildEscalaPsicologiaPrintPage).join('');
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Escalas liberadas</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#152238;font-size:10px}.print-page{display:flex;flex-direction:column;gap:12px}header{display:grid;grid-template-columns:180px 1fr 220px;align-items:center;gap:16px;border-bottom:2px solid #0754a6;padding:0 0 5px;margin-bottom:5px}.brand{display:flex;align-items:center;gap:8px;color:#0754a6;font-size:14px}.brand span{font-size:20px}h1{font-size:16px;margin:0 0 4px;text-align:center;color:#0754a6}p{margin:0;text-align:center;font-size:12px}.week-section{margin-bottom:8px}.week-title{font-size:11px;font-weight:bold;color:#0754a6;margin-bottom:4px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aebfd3;padding:4px;vertical-align:top}thead th{background:#0754a6;color:#fff;text-align:center;font-size:10px}thead th:first-child{width:50px}th small{display:block;margin-top:2px;font-weight:normal;font-size:8px}tbody>tr>th{background:#eaf2fb;color:#0754a6;text-align:center;vertical-align:middle;font-size:10px}.nome{margin-bottom:3px;padding:3px;border-radius:3px;background:#edf5ff;color:#164d91;font-size:9px;font-weight:700}.obs{margin-top:3px;font-size:8px;color:#52627a}.vazio{color:#94a3b8;font-size:9px}footer{margin-top:10px;text-align:center;color:#64748b;font-size:9px}</style></head><body><div class="print-page"><header><div class="brand"><span>♥</span><strong>Conecta HEAL</strong></div><div><h1>Escala de Plantão — Psicologia</h1><p>Visão Mensal</p></div><div></div></header>${paginas}<footer>Hospital Espírita André Luiz · Gestão Assistencial</footer></div></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  document.getElementById('btn-escala-imprimir')?.addEventListener('click', async () => {
    const overlay = document.getElementById('modal-escala-print-overlay');
    const mes = document.getElementById('escala-print-mes');
    if (mes) mes.value = document.getElementById('escala-mes')?.value || getTodayIsoDate().slice(0, 7);
    overlay?.classList.remove('d-none');
    document.body.classList.add('modal-open');
    await carregarSemanasLiberadasParaImpressao();
  });
  document.getElementById('escala-print-mes')?.addEventListener('change', carregarSemanasLiberadasParaImpressao);
  document.getElementById('modal-escala-print-close')?.addEventListener('click', fecharModalImpressaoEscala);
  document.getElementById('btn-escala-print-cancelar')?.addEventListener('click', fecharModalImpressaoEscala);
  document.getElementById('btn-escala-print-confirmar')?.addEventListener('click', () => {
    const indices = [...document.querySelectorAll('#escala-print-semanas input:checked')].map(input => Number(input.value));
    const selecionadas = indices.map(index => escalasPsicologiaLiberadas[index]).filter(Boolean);
    if (!selecionadas.length) return showToast('Selecione ao menos uma semana.', 'warning');
    fecharModalImpressaoEscala();
    imprimirSemanasPsicologia(selecionadas);
  });

  function renderEscalaPsicologiaList() {
    const listDiv = document.getElementById('escala-profissionais-list');
    if (!listDiv) return;
    
    if (!state.escalaPsicologiaItens || state.escalaPsicologiaItens.length === 0) {
      listDiv.innerHTML = '<div class="livro-empty">Nenhum profissional adicionado à escala deste dia/turno.</div>';
      return;
    }
    
    const canEdit = true;
    
    let html = '';
    state.escalaPsicologiaItens.forEach((item, index) => {
      let options = '<option value="">Selecione o psicólogo...</option>';
      (state.profissionaisPsicologia || []).forEach(p => {
        const sel = (p.cd_pessoa_fisica == item.cd_pessoa_fisica) ? 'selected' : '';
        options += `<option value="${p.cd_pessoa_fisica}" data-nome="${escapeHtml(p.nome)}" ${sel}>${escapeHtml(p.nome)}</option>`;
      });
      
      html += `
        <div class="livro-list-item" data-index="${index}">
          <div class="livro-list-item-content">
            <select class="form-select psi-select" ${!canEdit ? 'disabled' : ''}>
              ${options}
            </select>
          </div>
          ${canEdit ? `
            <div class="livro-list-item-actions">
              <button class="btn-sm btn-icon btn-remove-psi" type="button" title="Remover"><i class="bi bi-trash"></i></button>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    listDiv.innerHTML = html;
    
    // Listeners
    listDiv.querySelectorAll('.psi-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(e.target.closest('.livro-list-item').dataset.index);
        const val = e.target.value;
        if (val) {
          state.escalaPsicologiaItens[idx].cd_pessoa_fisica = val;
          const opt = e.target.options[e.target.selectedIndex];
          state.escalaPsicologiaItens[idx].nome = opt.dataset.nome;
        } else {
          state.escalaPsicologiaItens[idx].cd_pessoa_fisica = null;
          state.escalaPsicologiaItens[idx].nome = null;
        }
      });
    });
    
    listDiv.querySelectorAll('.btn-remove-psi').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.closest('.livro-list-item').dataset.index);
        state.escalaPsicologiaItens.splice(idx, 1);
        renderEscalaPsicologiaList();
      });
    });
  }

  document.getElementById('btn-add-psicologo')?.addEventListener('click', () => {
    state.escalaPsicologiaItens.push({ cd_pessoa_fisica: null, nome: null });
    renderEscalaPsicologiaList();
  });
  
  document.getElementById('btn-escala-consultar')?.addEventListener('click', async () => {
    const dataInput = document.getElementById('escala-data-plantao');
    const turnoManha = document.querySelector('input[name="escala-turno"][value="M"]');
    
    if (!dataInput || !dataInput.value) {
      showToast('Selecione a data do plantão', 'warning');
      return;
    }
    
    const turno = turnoManha && turnoManha.checked ? 'M' : 'N';
    
    try {
      // Setor da Psicologia (Tasy) = 4
      const result = await api.get(`/api/escala-ativa?cd_setor=4&dt_plantao=${dataInput.value}&turno=${turno}`);
      if (result.success) {
        const escala = result.data;
        state.escalaPsicologiaItens = (escala?.profissionais || []).map(item => ({
          cd_pessoa_fisica: item.cd_pessoa_fisica,
          nome: ''
        }));

        const obsEl = document.getElementById('escala-observacoes');
        if (obsEl) obsEl.value = escala?.observacoes || '';

        renderEscalaPsicologiaList();
        showToast(escala ? 'Escala carregada com sucesso' : 'Nenhuma escala encontrada para este plantão', escala ? 'success' : 'info');
      }
    } catch (err) {
      console.error('Erro ao consultar escala psicologia', err);
      showToast('Erro ao consultar escala', 'error');
    }
  });
  
  document.getElementById('btn-escala-salvar')?.addEventListener('click', async () => {
    const dataInput = document.getElementById('escala-data-plantao');
    const turnoManha = document.querySelector('input[name="escala-turno"][value="M"]');
    
    if (!dataInput || !dataInput.value) {
      showToast('Selecione a data do plantão', 'warning');
      return;
    }
    
    const validos = state.escalaPsicologiaItens.filter(i => !!i.cd_pessoa_fisica);
    if (validos.length === 0 && !document.getElementById('escala-observacoes').value.trim()) {
      showToast('A escala está vazia. Insira profissionais ou uma observação.', 'warning');
      return;
    }
    
    const turno = turnoManha && turnoManha.checked ? 'M' : 'N';
    const obsEl = document.getElementById('escala-observacoes');
    
    const payload = {
      tipo_escala: 'PSICOLOGIA',
      cd_modulo: 4,
      cd_setor_atendimento: 4,
      data_plantao: dataInput.value,
      turno,
      profissionais: validos.map(i => ({ cd_pessoa_fisica: Number(i.cd_pessoa_fisica) })),
      observacoes: obsEl ? obsEl.value.trim() : ''
    };

    try {
      const existente = await api.get(`/api/escala-ativa?cd_setor=4&dt_plantao=${dataInput.value}&turno=${turno}`);
      if (existente.success && existente.data) {
        const justificativa = window.prompt('Informe a justificativa para alterar a escala publicada:');
        if (!justificativa || !justificativa.trim()) {
          showToast('A justificativa é obrigatória para editar uma escala publicada.', 'warning');
          return;
        }
        payload.ds_justificativa = justificativa.trim();
      }
      const btn = document.getElementById('btn-escala-salvar');
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-hourglass-split spin"></i> Salvando...';
      
      const res = await api.put('/api/escala-ativa', payload);
      if (!res.success) {
        showToast('Erro: ' + res.message, 'error');
        return;
      }
      const publicacao = await api.post('/api/escala-psicologia/publicar', payload);
      if (publicacao.success) {
        showToast('Escala salva e publicada com sucesso', 'success');
      } else {
        showToast('Escala salva, mas não foi possível publicar: ' + publicacao.message, 'warning');
      }
    } catch (e) {
      showToast('Erro de comunicação', 'error');
    } finally {
      const btn = document.getElementById('btn-escala-salvar');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> Salvar escala';
      }
    }
  });
  
  document.getElementById('btn-escala-limpar')?.addEventListener('click', () => {
    state.escalaPsicologiaItens = [];
    const obsEl = document.getElementById('escala-observacoes');
    if (obsEl) obsEl.value = '';
    renderEscalaPsicologiaList();
    showToast('Formulário limpo', 'success');
  });

  document.getElementById('btn-escala-voltar')?.addEventListener('click', () => {
    showModeChooser();
  });

  async function restoreLivroDraft(draft, transitionId = modeTransitionSeq) {
    if (!draft || !isCurrentWorkspace(transitionId, 'livro')) return;
    draftHydratingModules.add('livro');

    try {
      const dateInput = document.getElementById('livro-data-plantao');
      if (dateInput && draft.dataPlantao) dateInput.value = draft.dataPlantao;
      document.querySelectorAll('input[name="livro-turno"]').forEach(radio => {
        radio.checked = radio.value === (draft.turno === 'N' ? 'N' : 'M');
      });

      state.livroSetorSelecionado = Number.isInteger(Number(draft.setorSelecionado))
        ? Number(draft.setorSelecionado)
        : null;
      state.livroEnfermeiroSelecionado = Number.isInteger(Number(draft.enfermeiroSelecionado))
        ? Number(draft.enfermeiroSelecionado)
        : null;
      state.livroTecnicosSelecionados = cloneDraftValue(draft.tecnicosSelecionados, []);
      state.livroFaltasFolgas = cloneDraftValue(draft.faltasFolgas, []);
      state.livroPatio = cloneDraftValue(draft.patio, []);
      state.livroCirculante = cloneDraftValue(draft.circulante, []);
      state.livroAvaliacaoExterna = cloneDraftValue(draft.avaliacaoExterna, []);

      const observacoes = document.getElementById('livro-observacoes');
      if (observacoes) observacoes.value = draft.observacoes || '';

      renderLivroSetorSelect();
      renderLivroEnfermeiroSelect();
      if (state.livroSetorSelecionado) {
        await loadPacientesSetor(state.livroSetorSelecionado);
        if (!isCurrentWorkspace(transitionId, 'livro')) return;
      }
      refreshLivroPacienteVinculo();
      renderTecnicosList();
      renderFaltasFolgasList();
      renderPatioList();
      renderCirculanteList();
      renderAvaliacaoList();
      ensureLivroEditable();
    } finally {
      draftHydratingModules.delete('livro');
      updateTopbarDraftIndicators();
    }
  }

  async function enterLivroMode() {

    if (!canAccessLivro()) {
      showToast('Módulo de livro disponível apenas para Enfermagem', 'warning');
      enterPassagemMode();
      return;
    }

    const transitionId = activateWorkspace('livro', workspaceLivro);
    const livroDraft = getModuleDraft('livro');

    if (!state.livroLoaded) {
      fillLivroDefaults();

      await loadSetoresLivro();
      if (!isCurrentWorkspace(transitionId, 'livro')) return;
      await loadEnfermeiros();
      if (!isCurrentWorkspace(transitionId, 'livro')) return;
      await loadTecnicos();
      if (!isCurrentWorkspace(transitionId, 'livro')) return;

      state.livroLoaded = true;
    }

    if (livroDraft) {
      await restoreLivroDraft(livroDraft, transitionId);
      if (!isCurrentWorkspace(transitionId, 'livro')) return;
    }

    await refreshHistoricoButton();

  }



  function renderSetorLivreCard(setor) {

    return `

      <div class="setor-group">

        <div class="setor-group-header"><i class="bi bi-building"></i> ${setor.ds_setor_atendimento}</div>

        <div class="setor-livre-card">

          <div class="setor-livre-header">

            <span class="setor-livre-badge"><i class="bi bi-journal-text"></i> Passagem do setor</span>

            <p>Registre a passagem de plantão do setor mesmo sem pacientes listados.</p>

          </div>

          <div class="intercorrencia-editor-wrap">
            ${buildFormattingToolbar()}
            <div class="paciente-textarea intercorrencia-textarea"
              contenteditable="true" role="textbox" aria-multiline="true"
              data-placeholder="Descreva a passagem de plantão do setor..."
              data-setor="${setor.cd_setor_atendimento}"
              data-setornome="${setor.ds_setor_atendimento}"></div>
          </div>

        </div>

      </div>`;

  }



  function renderSetorDropdown() {

    const menuList = document.getElementById('user-profile-menu-list');
    const userDisplay = document.getElementById('user-display');
    const chevron = userDisplay?.querySelector('.user-badge-chevron');

    let perfis = [];
    if (Array.isArray(state.usuario?.perfisDisponiveis)) {
      perfis = state.usuario.perfisDisponiveis;
    } else if (state.usuario?.perfisDisponiveis && typeof state.usuario.perfisDisponiveis === 'object') {
      perfis = Object.values(state.usuario.perfisDisponiveis);
    }

    const perfilAtivo = state.usuario?.perfilAtivo;

    if (chevron) {
      chevron.style.display = perfis.length > 1 ? 'inline-block' : 'none';
    }

    updateProfileLabels();

    if (!menuList) return;

    if (perfis.length === 0) {
      menuList.innerHTML = '<div class="px-3 py-2 text-muted small">Nenhum perfil adicional</div>';
      return;
    }

    menuList.innerHTML = perfis.map(perfil => {
      const perfilId = String(perfil.id);
      const isActive = String(perfilAtivo) === perfilId;
      return `<button type="button" class="user-profile-menu-item ${isActive ? 'active' : ''}" data-perfil-id="${escapeHtml(perfilId)}">
        <span class="profile-item-name">
          <i class="bi ${isActive ? 'bi-person-check-fill' : 'bi-person'}"></i>
          <span>${escapeHtml(perfil.nome || perfil.id)}</span>
        </span>
        <i class="bi bi-check2 profile-check"></i>
      </button>`;
    }).join('');

    menuList.querySelectorAll('.user-profile-menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const perfilId = btn.dataset.perfilId;
        closeUserProfileMenu();
        if (perfilId && String(perfilId) !== String(state.usuario?.perfilAtivo)) {
          trocarPerfil(perfilId);
        }
      });
    });

  }

  function toggleUserProfileMenu() {
    renderSetorDropdown();

    const menu = document.getElementById('user-profile-menu');
    const userDisplay = document.getElementById('user-display');
    if (!menu || !userDisplay) return;

    const isHidden = menu.classList.contains('d-none');
    if (isHidden) {
      menu.classList.remove('d-none');
      userDisplay.setAttribute('aria-expanded', 'true');
      userDisplay.classList.add('active');
    } else {
      closeUserProfileMenu();
    }
  }

  function closeUserProfileMenu() {
    const menu = document.getElementById('user-profile-menu');
    const userDisplay = document.getElementById('user-display');
    if (menu) menu.classList.add('d-none');
    if (userDisplay) {
      userDisplay.setAttribute('aria-expanded', 'false');
      userDisplay.classList.remove('active');
    }
  }

  document.getElementById('user-display')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUserProfileMenu();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-dropdown-container')) {
      closeUserProfileMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUserProfileMenu();
    }
  });



  const SETOR_ENFERMAGEM_ID = 1;

  const SETOR_PSI_ID = 4;



  function resolveCdModulo() {

    const moduloAtual = Number(state.cdModulo);
    if ([SETOR_ENFERMAGEM_ID, SETOR_PSI_ID].includes(moduloAtual)) {
      return moduloAtual;
    }

    if (state.usuario?.acesso_enfermagem && !state.usuario?.acesso_psicologia) {
      return SETOR_ENFERMAGEM_ID;
    }

    if (state.usuario?.acesso_psicologia && !state.usuario?.acesso_enfermagem) {
      return SETOR_PSI_ID;
    }

    if (state.usuario?.acesso_enfermagem) {
      return SETOR_ENFERMAGEM_ID;
    }

    return null;

  }

  function getSetorIdByPerfil(perfilId) {
    return null; // Deprecated, sectors are now dynamic
  }



  async function alterarPerfilSeNecessario(perfilId) {

    if (String(state.usuario?.perfilAtivo) === String(perfilId)) return true;

    try {
      const result = await api.post('/api/perfil/alterar', { perfil: perfilId });

      if (result.success && result.data) {

        state.usuario = result.data;
        updateProfileLabels();
        return true;

      }

    } catch (err) {
      showToast(err?.message || 'Erro ao alterar perfil', 'error');
    }

    return false;

  }

  async function trocarPerfil(perfilId) {
    const perfilAnterior = state.usuario?.perfilAtivo || '';
    if (!perfilId || String(perfilId) === String(perfilAnterior)) return;
    const seq = ++profileChangeSeq;
    flushPendingDrafts(perfilAnterior);

    activeProfileChangePromise = (async () => {
      try {
        const atualizado = await alterarPerfilSeNecessario(perfilId);
        if (!atualizado || seq !== profileChangeSeq) return;
        state.setores = [];
        state.setoresSelecionados = [];
        state.pacientes = [];
        state.savedTexts = {};
        state.cdModulo = null;
        state.livroLoaded = false;
        state.escalaLoaded = false;
        state.profissionaisPsicologia = [];
        state.escalaSemanalCells = {};
        state.escalaEdicao = null;
        state.dashboardSetores = [];
        state.dashboardSetorSelecionado = null;
        await loadModulosFromBackend();
        initializeDraftSession();
        renderSetorDropdown();
        showModeChooser();
        showToast(`Perfil alterado para ${state.usuario?.perfisDisponiveis?.find(p => String(p.id) === String(perfilId))?.nome || perfilId}`, 'success');
      } catch (err) {
        showToast(err?.message || 'Não foi possível alterar o perfil', 'error');
      } finally {
        if (seq === profileChangeSeq) activeProfileChangePromise = null;
      }
    })();

    await activeProfileChangePromise;
  }

  async function onSetorChange(transitionId = modeTransitionSeq) {
    let perfilId = state.usuario?.perfilAtivo;

    if (!isCurrentWorkspace(transitionId, 'passagem')) return;

    document.getElementById('empty-state')?.classList.remove('d-none');
    document.getElementById('pacientes-list')?.classList.add('d-none');
    document.getElementById('main-footer')?.classList.add('d-none');

    if (!perfilId) {
      state.setoresSelecionados = [];
      state.cdModulo = null;
      document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));
      return;
    }

    const perfilAtualizado = await alterarPerfilSeNecessario(perfilId);
    if (!perfilAtualizado || !isCurrentWorkspace(transitionId, 'passagem')) return;

    await loadSetoresInternacao(transitionId);
  }



  async function loadSetoresInternacao(transitionId = modeTransitionSeq) {

    const list = document.getElementById('setores-list');
    if (!list || !isCurrentWorkspace(transitionId, 'passagem')) return;

    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando setores...</div>';



    try {

      const result = await api.get('/api/setores-internacao');

      if (!isCurrentWorkspace(transitionId, 'passagem')) return;

      if (result.success && result.data) {
        const uniqueSetores = [];
        const seenIds = new Set();
        (result.data || []).forEach(s => {
          const id = String(s.cd_setor_atendimento);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueSetores.push(s);
          }
        });
        state.setores = uniqueSetores;
        renderSetoresInternacao(state.setores);
      } else {

        list.innerHTML = `<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> ${result.message}</div>`;

      }

    } catch (err) {

      if (isCurrentWorkspace(transitionId, 'passagem')) {
        list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar setores</div>';
      }

    }

  }



  function renderSetoresInternacao(setores) {

    const list = document.getElementById('setores-list');

    if (setores.length === 0) {

      list.innerHTML = '<div class="loading-placeholder">Nenhum setor encontrado</div>';

      return;

    }



    list.innerHTML = setores.map(s => `

      <div class="setor-item" data-cd="${s.cd_setor_atendimento}">

        <input type="radio" name="setor-radio" value="${s.cd_setor_atendimento}">

        <span class="setor-name">${s.ds_setor_atendimento}</span>

      </div>

    `).join('');



    list.querySelectorAll('.setor-item').forEach(item => {
      item.addEventListener('click', async () => {
        if (item.classList.contains('active')) return;
        
        let hasUnsaved = false;
        document.querySelectorAll('.intercorrencia-checkbox').forEach(cb => { if (cb.checked) hasUnsaved = true; });
        document.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
          if (editorHasContent(ta)) hasUnsaved = true;
        });

        if (hasUnsaved) {
          if (temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
            if (typeof showModal === 'function') {
              await showModal('warning', 'Atenção: Dados Não Salvos', 'Você preencheu informações neste setor. Clique em "Salvar / Finalizar Passagem" e escolha "Salvar e Continuar Passagem" para não perder os dados!');
            }
            return;
          } else {
            const descartar = await showConfirmModal('Atenção: Dados Não Salvos', 'Você preencheu informações neste setor. Deseja descartar as alterações e trocar de setor?');
            if (!descartar) return;
            state.savedTexts = {};
            clearModuleDraft('passagem');
          }
        }

        list.querySelectorAll('.setor-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        item.querySelector('input[type="radio"]').checked = true;

        updateSetoresSelecionados();
        markModuleDraftDirty('passagem');
        closeSidebarOverlay();
        loadPacientes();

      });

    });

  }



  
  function renderLoteChecksNaSidebar() {
    if (!temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
      document.querySelectorAll('.lote-check').forEach(el => el.remove());
      return;
    }
    document.querySelectorAll('.setor-item').forEach(item => {
      const cd = parseInt(item.dataset.cd, 10);
      let badge = item.querySelector('.lote-check');
      if (state.loteSectors && state.loteSectors.has(cd)) {
         if (!badge) {
            badge = document.createElement('span');
            badge.className = 'lote-check ms-auto text-primary';
            badge.innerHTML = '<i class="bi bi-check2-all"></i>';
            item.appendChild(badge);
         }
      } else if (badge) {
         badge.remove();
      }
    });
  }

  function highlightSidebarSetor(setorId) {

    document.querySelectorAll('.setor-item').forEach(item => {

      item.classList.toggle('active', parseInt(item.dataset.cd, 10) === setorId);

    });

  }



  const formLogin = document.getElementById('form-login');

  const inpUsuario = document.getElementById('inp-usuario');

  const inpSenha = document.getElementById('inp-senha');

  const btnLogin = document.getElementById('btn-login');

  const loginError = document.getElementById('login-error');



  formLogin.addEventListener('submit', async e => {

    e.preventDefault();

    loginError.classList.add('d-none');

    setLoading(btnLogin, true);



    try {

      const result = await api.post('/api/login', {

        nm_usuario: inpUsuario.value,

        senha: inpSenha.value

      });



      if (result.success) {

        sessionStorage.setItem('session_active', '1');

        state.usuario = result.data;

        document.getElementById('user-name').textContent = state.usuario.nome || state.usuario.nm_usuario;

        showScreen('app');

        updateProfileLabels();
        initializeDraftSession();

        await loadModulosFromBackend();
        renderSetorDropdown();

        if (shouldShowModeSelector()) {

          showModeChooser();

        } else {

          enterPassagemMode();

        }

      } else {

        loginError.textContent = result.message || 'Erro ao fazer login';

        loginError.classList.remove('d-none');

      }

    } catch (err) {

      loginError.textContent = err?.message || 'Erro ao conectar com o servidor';

      loginError.classList.remove('d-none');

    } finally {

      setLoading(btnLogin, false);

    }

  });



  async function restorePassagemDraft(draft, transitionId = modeTransitionSeq) {
    if (!draft || !isCurrentWorkspace(transitionId, 'passagem')) return;
    draftHydratingModules.add('passagem');

    try {
      const entries = draft.entries && typeof draft.entries === 'object' ? draft.entries : {};
      await onSetorChange(transitionId);
      if (!isCurrentWorkspace(transitionId, 'passagem')) return;

      state.savedTexts = {};
      Object.entries(entries).forEach(([key, entry]) => {
        if (entry?.text) state.savedTexts[key] = String(entry.text);
      });

      const selected = Array.isArray(draft.setoresSelecionados)
        ? draft.setoresSelecionados.map(Number).filter(Number.isInteger)
        : [];

      if (state.usuario?.perfilAtivo === 'enfermagem' && selected.length > 0) {
        const availableIds = new Set(state.setores.map(setor => Number(setor.cd_setor_atendimento)));
        state.setoresSelecionados = selected.filter(id => availableIds.has(id));
        document.querySelectorAll('.setor-item').forEach(item => {
          const isSelected = state.setoresSelecionados.includes(Number(item.dataset.cd));
          item.classList.toggle('active', isSelected);
          const radio = item.querySelector('input[type="radio"]');
          if (radio) radio.checked = isSelected;
        });
        updatePassagemContext();
        if (state.setoresSelecionados.length > 0) {
          await loadPacientes(transitionId);
        }
      }

      if (!isCurrentWorkspace(transitionId, 'passagem')) return;

      const turno = Number(draft.turno);
      state.turno = [1, 2, 3, 4, 5].includes(turno) ? turno : null;
      document.querySelectorAll('input[name="turno"]').forEach(radio => {
        radio.checked = Number(radio.value) === state.turno;
      });

      restoreTextsAfterRender();
      document.querySelectorAll('.intercorrencia-checkbox').forEach(checkbox => {
        const key = `atendimento_${checkbox.dataset.atendimento || ''}`;
        const checks = Array.isArray(entries[key]?.checks) ? entries[key].checks : [];
        checkbox.checked = checks.includes(checkbox.dataset.field);
      });
      updateFooter();
    } finally {
      draftHydratingModules.delete('passagem');
      updateTopbarDraftIndicators();
    }
  }

  async function loadSetores(transitionId = modeTransitionSeq) {

    const list = document.getElementById('setores-list');
    if (!list || !isCurrentWorkspace(transitionId, 'passagem')) return;
    const passagemDraft = getModuleDraft('passagem');

    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando setores...</div>';

    state.setores = [];

    state.setoresSelecionados = [];
    state.pacientes = [];
    state.savedTexts = {};
    state.cdModulo = null;

    const pacientesList = document.getElementById('pacientes-list');
    if (pacientesList) {
      pacientesList.innerHTML = '';
      pacientesList.classList.add('d-none');
    }
    document.getElementById('empty-state')?.classList.remove('d-none');
    document.getElementById('main-footer')?.classList.add('d-none');



    try {

      const result = await api.get('/api/setores-internacao');

      if (!isCurrentWorkspace(transitionId, 'passagem')) return;

      if (result.success && result.data) {

        const uniqueSetores = [];

        const seenIds = new Set();

        result.data.forEach(s => {

          const id = String(s.cd_setor_atendimento);

          if (!seenIds.has(id)) {

            seenIds.add(id);

            uniqueSetores.push(s);

          }

        });

        state.setores = uniqueSetores;
        renderSetorDropdown();
        if (passagemDraft) {
          await restorePassagemDraft(passagemDraft, transitionId);
        } else {
          renderSetoresInternacao(state.setores);
        }

      } else {

        list.innerHTML = `<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> ${result.message}</div>`;

      }

    } catch (err) {

      if (isCurrentWorkspace(transitionId, 'passagem')) {
        list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar setores</div>';
      }

    }

  }

  function updateSetoresSelecionados() {

    state.setoresSelecionados = [...document.querySelectorAll('.setor-item.active')]

      .map(el => parseInt(el.dataset.cd, 10));

    if (state.setoresSelecionados.length > 0) {
      state.cdModulo = resolveCdModulo();
    }

    updatePassagemContext();

  }



  async function loadPacientes(transitionId = modeTransitionSeq) {
    if (!Number.isInteger(transitionId)) transitionId = modeTransitionSeq;

    if (state.setoresSelecionados.length === 0) return;



    document.getElementById('empty-state').classList.add('d-none');

    document.getElementById('pacientes-list').classList.remove('d-none');

    document.getElementById('pacientes-list').innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Buscando pacientes...</div>';



    try {

      const result = await api.post('/api/pacientes', { setores: state.setoresSelecionados });

      if (!isCurrentWorkspace(transitionId, 'passagem')) return;

      if (result.success && result.data) {

        state.pacientes = result.data;

        renderPacientes();

        document.getElementById('main-footer').classList.remove('d-none');

        updateFooter();

      } else {

        showToast(result.message || 'Erro ao carregar', 'error');

      }

    } catch (err) {

      showToast('Erro ao carregar pacientes', 'error');

    }

  }



  function renderPacientes() {

    const container = document.getElementById('pacientes-list');

    const emptyState = document.getElementById('empty-state');

    saveTextsBeforeRender();
    updatePassagemContext();



    document.getElementById('pacientes-list').classList.remove('d-none');

    emptyState.classList.add('d-none');



    if (state.pacientes.length === 0) {

      container.innerHTML = getSelectedSetoresData().map(renderSetorLivreCard).join('');

      restoreTextsAfterRender();

      bindTextareaEvents(container);

      bindCheckboxEvents(container);

      updateFooter();

      return;

    }



    const grouped = {};

    state.pacientes.forEach(p => {

      const key = p.cd_setor_atendimento;

      if (!grouped[key]) grouped[key] = { setor: p.setor, pacientes: [] };

      grouped[key].pacientes.push(p);

    });



    let html = '';

    for (const key in grouped) {

      const group = grouped[key];

      html += `<div class="setor-group"><div class="setor-group-header"><i class="bi bi-building"></i> ${escapeHtml(group.setor || '-')}</div>`;

      group.pacientes.forEach(p => {

        const initials = getPacienteInitials(p.nome);

        const dtCancelamento = p.dt_cancelamento;

        const setorTexto = dtCancelamento

          ? `Cancelado: ${formatCancelamentoDate(dtCancelamento)}`

          : escapeHtml(p.setor || '-');

        html += `

          <div class="paciente-card">

            <div class="paciente-info">

              <div class="paciente-avatar">${initials}</div>

              <div class="paciente-details">

                <div class="paciente-name">${escapeHtml(p.nome || '-')}</div>
                ${renderNomeCivilPaciente(p)}

                <div class="paciente-meta">

                  <span><i class="bi bi-hash"></i> Atend: ${escapeHtml(p.atendimento)}</span>

                  <span><i class="bi bi-geo-alt"></i> ${setorTexto}</span>

                </div>

              </div>

            </div>

            ${renderCheckboxesIntercorrencia(p.atendimento)}

            <div class="intercorrencia-editor-wrap">
              ${buildFormattingToolbar()}
              <div class="paciente-textarea intercorrencia-textarea"
                contenteditable="true" role="textbox" aria-multiline="true"
                data-placeholder="Descreva a intercorrência..."
                data-atendimento="${escapeHtml(p.atendimento)}"
                data-setor="${escapeHtml(p.cd_setor_atendimento)}"
                data-nome="${escapeHtml(p.nome || '')}"
                data-setornome="${escapeHtml(group.setor || '')}"></div>
            </div>

          </div>`;

      });

      html += '</div>';

    }



    container.innerHTML = html;

    restoreTextsAfterRender();

    bindTextareaEvents(container);

    bindCheckboxEvents(container);

    updateFooter();

  }



  function updateFooter() {

    const total = state.pacientes.length;

    const atendimentosComCheckbox = new Set(
      [...document.querySelectorAll('.intercorrencia-checkbox:checked')]
        .map(cb => cb.dataset.atendimento)
        .filter(Boolean)
    );

    const intercorrencias = [...document.querySelectorAll('.intercorrencia-textarea')]

      .filter(ta => {
        const hasTexto = editorHasContent(ta);
        const hasCheckbox = atendimentosComCheckbox.has(ta.dataset.atendimento);
        return hasTexto || hasCheckbox;
      }).length;



    document.getElementById('pacientes-count').textContent = total;

    document.getElementById('intercorrencias-count').textContent = intercorrencias;



    const btnSalvar = document.getElementById('btn-salvar');

    const hasTurno = document.querySelector('input[name="turno"]:checked');

    btnSalvar.disabled = false;

  }



  document.querySelectorAll('input[name="turno"]').forEach(radio => {

    radio.addEventListener('change', () => {

      state.turno = parseInt(radio.value, 10);

      updateFooter();
      markModuleDraftDirty('passagem');

    });

  });



  document.getElementById('btn-salvar').addEventListener('click', async () => {

    const hasTurno = document.querySelector('input[name="turno"]:checked');

    if (!hasTurno) {

      await showModal('error', 'Turno não selecionado',
        'Indique o turno atual (Diurno ou Noturno) para finalizar a passagem de plantão.');

      const turnoWrapper = document.getElementById('main-footer-turno-wrapper') || document.getElementById('turno-options-dinamico') || document.querySelector('.turno-bar');
      if (turnoWrapper) {
        turnoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        turnoWrapper.classList.add('turno-bar--highlight');
        setTimeout(() => turnoWrapper.classList.remove('turno-bar--highlight'), 2200);
      }

      return;

    }



    const intercorrencias = {};

    const setorIntercorrencias = {};

    const cdModuloPayload = resolveCdModulo();
    if (!cdModuloPayload) {
      showToast('Módulo não definido. Recarregue os setores e tente novamente.', 'warning');
      return;
    }
    state.cdModulo = cdModuloPayload;

    const checkboxesPorAtendimento = {};
    document.querySelectorAll('.intercorrencia-checkbox:checked').forEach(cb => {
      const atendimento = cb.dataset.atendimento;
      if (!atendimento) return;

      const field = (cb.dataset.field || '').trim().toLowerCase();
      const label = CHECKBOX_INTERCORRENCIAS_MAP.get(field);
      if (!label) return;

      const linha = `${label}: Sim`;

      if (!checkboxesPorAtendimento[atendimento]) {
        checkboxesPorAtendimento[atendimento] = [];
      }
      checkboxesPorAtendimento[atendimento].push(linha);
    });

    document.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
      const textoHtml = getEditorHtmlForSave(ta);

      if (ta.dataset.atendimento) {
        const checkboxes = checkboxesPorAtendimento[ta.dataset.atendimento] || [];
        const partes = [];

        if (checkboxes.length > 0) {
          partes.push(checkboxes.join('\n'));
        }
        if (textoHtml) {
          partes.push(textoHtml);
        }

        const textoFinal = partes.join('\n');
        if (!textoFinal) return;

        intercorrencias[ta.dataset.atendimento] = textoFinal;
        return;
      }

      if (ta.dataset.setor) {
        if (!textoHtml) return;
        setorIntercorrencias[ta.dataset.setor] = textoHtml;
      }

    });


const btnSalvar = document.getElementById('btn-salvar');

    const originalHtml = btnSalvar.innerHTML;

    btnSalvar.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';

    btnSalvar.disabled = true;



    try {

    if (temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
      const overlay = document.getElementById('modal-confirm-overlay');
      const btnYes = document.getElementById('modal-confirm-yes');
      const btnNo = document.getElementById('modal-confirm-no');
      
      const originalYes = btnYes.innerHTML;
      const originalNo = btnNo.innerHTML;
      
      const choice = await new Promise(resolve => {
        document.getElementById('modal-confirm-title').textContent = "Continuar a passagem para outros setores?";
        document.getElementById('modal-confirm-message').textContent = "";
        
        btnYes.innerHTML = '<i class="bi bi-save"></i> Salvar e Continuar Passagem';
        btnNo.innerHTML = '<i class="bi bi-check2-circle"></i> Finalizar';
        
        // Custom styling for this specific prompt
        btnNo.classList.remove('modal-btn-secondary');
        btnNo.classList.add('modal-btn-primary');
        btnNo.setAttribute('style', 'background: var(--success, #198754) !important; border-color: var(--success, #198754) !important; color: white !important; box-shadow: 0 4px 14px rgba(25,135,84,0.4) !important;');
        
        overlay.classList.remove('d-none');
        document.body.classList.add('modal-open');

        const close = (result) => {
          overlay.classList.add('d-none');
          document.body.classList.remove('modal-open');
          btnYes.innerHTML = originalYes;
          btnNo.innerHTML = originalNo;
          
          // Restore classes
          btnNo.classList.add('modal-btn-secondary');
          btnNo.classList.remove('modal-btn-primary');
          btnNo.style.backgroundColor = '';
          btnNo.style.borderColor = '';
          
          resolve(result);
        };

        btnYes.onclick = () => close(true);
        btnNo.onclick = () => close(false);
        overlay.onclick = e => { if (e.target === overlay) close(null); };
      });

      if (choice === true) {
        const btnSalvarLocal = document.getElementById('btn-salvar');
        const btnOriginalHtml = btnSalvarLocal.innerHTML;
        btnSalvarLocal.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
        btnSalvarLocal.disabled = true;

        try {
           const payload = {
              setoresSelecionados: state.setoresSelecionados,
              intercorrencias,
              setorIntercorrencias
           };
           const result = await api.post('/api/lote/draft', payload);
           if (result.success) {
              if (!state.loteSectors) state.loteSectors = new Set();
              (result.data.setoresSelecionados || []).forEach(s => state.loteSectors.add(Number(s)));
              renderLoteChecksNaSidebar();
              
              // Clear screen so we don't trigger "unsaved data" when clicking next sector
              document.getElementById('pacientes-list').classList.add('d-none');
              document.getElementById('pacientes-list').innerHTML = '';
              document.getElementById('empty-state').classList.remove('d-none');
              document.getElementById('main-footer').classList.add('d-none');
              document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));
              
              document.getElementById('btn-expand-sidebar')?.click();
              showToast('Setor salvo no lote. Escolha o próximo setor.', 'success');
           } else {
              throw new Error(result.message || 'Erro ao salvar passagem');
           }
        } catch (err) {
           showToast(err.message, 'error');
        } finally {
           btnSalvarLocal.innerHTML = btnOriginalHtml;
           btnSalvarLocal.disabled = false;
        }
        return; 
      } else if (choice === null) {
        return; // Cancelado
      }
    }

      const result = await api.post('/api/salvar', {

        nr_seq_turno: state.turno,

        setoresSelecionados: state.setoresSelecionados,

        cd_modulo: cdModuloPayload,

        intercorrencias,

        setorIntercorrencias

      });



      if (result.success) {

        await showModal('success', 'Sucesso!', result.data.inseridos + ' registro(s) salvo(s)');

        clearModuleDraft('passagem');
        resetForm();

      } else {

        await showModal('error', 'Falha ao salvar', result.message || 'Não foi possível salvar.');

      }

    } catch (err) {

      await showModal('error', 'Falha ao salvar', err?.message || 'Erro ao salvar.');

    } finally {

      btnSalvar.innerHTML = originalHtml;

      updateFooter();

    }

  });



  function resetForm() {
    if (state.loteSectors) state.loteSectors.clear();
    if (typeof renderLoteChecksNaSidebar === 'function') renderLoteChecksNaSidebar();

    state.pacientes = [];

    state.turno = null;

    state.savedTexts = {};

    state.cdModulo = resolveCdModulo();

    document.querySelectorAll('input[name="turno"]').forEach(r => r.checked = false);

    document.getElementById('pacientes-list').classList.add('d-none');

    document.getElementById('pacientes-list').innerHTML = '';

    document.getElementById('empty-state').classList.remove('d-none');

    document.getElementById('main-footer').classList.add('d-none');

    document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));

    updatePassagemContext();

    updateSetoresSelecionados();

  }



  function adicionarTecnico() {
    state.livroTecnicosSelecionados.push(buildLivroTecnicoRow());
    renderTecnicosList();
  }

  function removerTecnico(rowKey) {
    if (state.livroTecnicosSelecionados.length <= 1) {
      showToast('Mantenha ao menos uma linha de técnico', 'warning');
      return;
    }

    state.livroTecnicosSelecionados = state.livroTecnicosSelecionados.filter(item => item.row_key !== rowKey);
    refreshLivroPacienteVinculo();
    renderTecnicosList();
  }

  function adicionarAvaliacao() {
    state.livroAvaliacaoExterna.push(buildAvaliacaoRow());
    renderAvaliacaoList();
  }

  function removerAvaliacao(rowKey) {
    state.livroAvaliacaoExterna = state.livroAvaliacaoExterna.filter(item => item.row_key !== rowKey);
    renderAvaliacaoList();
  }

  function adicionarPatio() {
    state.livroPatio.push(buildPatioRow());
    renderPatioList();
  }

  function removerPatio(rowKey) {
    state.livroPatio = state.livroPatio.filter(item => item.row_key !== rowKey);
    renderPatioList();
  }

  function adicionarCirculante() {
    state.livroCirculante.push(buildCirculanteRow());
    renderCirculanteList();
  }

  function removerCirculante(rowKey) {
    state.livroCirculante = state.livroCirculante.filter(item => item.row_key !== rowKey);
    renderCirculanteList();
  }

  function isTecnicoComConflitoDeFuncao(cdPessoaFisica, tipo, rowKey = null) {
    const tecnicoId = Number(cdPessoaFisica);
    if (!Number.isInteger(tecnicoId)) return false;

    if (tipo === 'tecnico') {
      return (
        isTecnicoEmListaFuncao(state.livroPatio, tecnicoId) ||
        isTecnicoEmListaFuncao(state.livroCirculante, tecnicoId)
      );
    }

    if (tipo === 'patio') {
      return (
        isTecnicoEmListaFuncao(state.livroPatio, tecnicoId, rowKey) ||
        isTecnicoEmListaFuncao(state.livroCirculante, tecnicoId) ||
        isTecnicoComPacientes(tecnicoId)
      );
    }

    if (tipo === 'circulante') {
      return (
        isTecnicoEmListaFuncao(state.livroCirculante, tecnicoId, rowKey) ||
        isTecnicoEmListaFuncao(state.livroPatio, tecnicoId) ||
        isTecnicoComPacientes(tecnicoId)
      );
    }

    return false;
  }

  function adicionarFalta() {
    state.livroFaltasFolgas.push(buildLivroFaltaRow());
    renderFaltasFolgasList();
  }

  function removerFalta(rowKey) {
    state.livroFaltasFolgas = state.livroFaltasFolgas.filter(item => item.row_key !== rowKey);
    renderFaltasFolgasList();
  }

  function togglePaciente(rowKey, pacienteId, checkbox) {
    const row = state.livroTecnicosSelecionados.find(item => item.row_key === rowKey);
    const atendimento = Number(pacienteId);
    if (!row || !Number.isInteger(atendimento)) return;

    if (!Number.isInteger(row.cd_pessoa_fisica)) {
      checkbox.checked = false;
      showToast('Selecione um técnico antes de vincular pacientes', 'warning');
      return;
    }

    const tecnicoVinculado = state.livroPacienteVinculo.get(atendimento);
    if (checkbox.checked) {
      if (isTecnicoComConflitoDeFuncao(row.cd_pessoa_fisica, 'tecnico')) {
        checkbox.checked = false;
        showToast('Técnico em pátio/circulante não pode receber pacientes na lista de técnicos', 'warning');
        return;
      }

      if (Number.isInteger(tecnicoVinculado) && tecnicoVinculado !== Number(row.cd_pessoa_fisica)) {
        checkbox.checked = false;
        showToast('Paciente já vinculado a outro técnico', 'error');
        return;
      }

      if (!row.pacientes.includes(atendimento)) {
        row.pacientes.push(atendimento);
      }
    } else {
      row.pacientes = row.pacientes.filter(item => Number(item) !== atendimento);
    }

    refreshLivroPacienteVinculo();
    renderTecnicosList();
  }

  function showConfirmModal(title, message) {
    return new Promise(resolve => {
      const overlay = document.getElementById('modal-confirm-overlay');
      document.getElementById('modal-confirm-title').textContent = title;
      document.getElementById('modal-confirm-message').textContent = message;
      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');

      const close = (result) => {
        overlay.classList.add('d-none');
        document.body.classList.remove('modal-open');
        resolve(result);
      };

      document.getElementById('modal-confirm-yes').onclick = () => close(true);
      document.getElementById('modal-confirm-no').onclick = () => close(false);
      overlay.onclick = e => { if (e.target === overlay) close(false); };
    });
  }

  function showJustificativaModal() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-card modal-card-wide">
          <h3><i class="bi bi-pencil-square"></i> Justificativa da alteração</h3>
          <p style="margin-bottom:0.8rem;color:var(--slate-600)">Por que esta escala está sendo alterada?</p>
          <textarea id="justificativa-input" rows="3" placeholder="Descreva o motivo da alteração..."></textarea>
          <div class="modal-actions">
            <button class="modal-btn-secondary" id="justificativa-cancel">Cancelar</button>
            <button class="modal-btn-primary" id="justificativa-confirm">Confirmar</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');

      const input = overlay.querySelector('#justificativa-input');
      input.focus();

      overlay.querySelector('#justificativa-cancel').onclick = () => {
        overlay.remove();
        document.body.classList.remove('modal-open');
        resolve(null);
      };

      overlay.querySelector('#justificativa-confirm').onclick = () => {
        const valor = input.value.trim();
        overlay.remove();
        document.body.classList.remove('modal-open');
        resolve(valor || null);
      };

      overlay.onclick = e => {
        if (e.target === overlay) {
          overlay.remove();
          document.body.classList.remove('modal-open');
          resolve(null);
        }
      };
    });
  }

  function clearLivroForm() {
    document.getElementById('livro-observacoes').value = '';
    state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    state.livroFaltasFolgas = [];
    state.livroPatio = [];
    state.livroCirculante = [];
    state.livroAvaliacaoExterna = [];
    state.livroPacienteVinculo = new Map();
    state.livroEnfermeiroSelecionado = null;
    state.livroEctPre = [];
    state.livroEctSala = [];
    state.livroEctRecuperacao = [];
    ensureLivroEditable();
    renderLivroPreviewData(null);
    renderLivroEnfermeiroSelect();
    updateLivroSectionsVisibility();
    renderLivroEctSelects();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
  }

  async function checkPatioCirculanteGlobal() {
    const data = document.getElementById('livro-data-plantao')?.value;
    const turno = getEscalaTurnoSelecionado();
    if (!data || !turno) return;

    try {
      const res = await api.get(`/api/escala-ativa/patio-circulante-global?dt_plantao=${data}&turno=${turno}`);
      if (!res.success) return;

      state.livroPatioCirculanteLocked = res.data.locked;
      state.livroPatioGlobal = res.data.patio;
      state.livroCirculanteGlobal = res.data.circulante;

      if (res.data.locked) {
        state.livroPatio = (res.data.patio || []).map(p => ({
          row_key: 'patio_global_' + p.cd_pessoa_fisica,
          cd_pessoa_fisica: p.cd_pessoa_fisica,
          _nome: p.nome
        }));
        state.livroCirculante = (res.data.circulante || []).map(c => ({
          row_key: 'circ_global_' + c.cd_pessoa_fisica,
          cd_pessoa_fisica: c.cd_pessoa_fisica,
          _nome: c.nome
        }));
        showToast('Pátio e Circulante definidos pela primeira escala liberada', 'info');
      } else {
        state.livroPatioCirculanteLocked = false;
      }

      renderPatioList(state.livroPatioCirculanteLocked);
      renderCirculanteList(state.livroPatioCirculanteLocked);
    } catch (e) {
      console.error('[checkPatioCirculanteGlobal] Erro:', e);
    }
  }

  async function onLivroSetorChange() {
    const select = document.getElementById('livro-setor');
    const cdSetor = Number(select.value);

    state.livroSetorSelecionado = Number.isInteger(cdSetor) ? cdSetor : null;

    if (!state.livroSetorSelecionado) {
      clearLivroForm();
      return;
    }

    ensureLivroEditable();
    clearLivroForm();
    await loadPacientesSetor(state.livroSetorSelecionado);
    await refreshHistoricoButton();
    await loadLivroAdministrativoByDate(getLivroDataSelecionada());
    await checkPatioCirculanteGlobal();
  }

  function collectEscalaTecnicaPayload() {
    const cdSetor = Number(state.livroSetorSelecionado);
    if (!Number.isInteger(cdSetor)) {
      showToast('Selecione o setor do plantão', 'warning');
      return null;
    }

    const turno = getEscalaTurnoSelecionado();
    if (!turno) {
      showToast('Selecione o turno (Diurno ou Noturno)', 'warning');
      return null;
    }

    const enfermeiroId = Number(state.livroEnfermeiroSelecionado);
    if (!Number.isInteger(enfermeiroId)) {
      showToast('Selecione o enfermeiro responsável', 'warning');
      return null;
    }

    const extrasByTecnico = new Map();

    const appendExtra = (cdPessoaFisica, extra) => {
      if (!Number.isInteger(cdPessoaFisica)) return;
      if (!extrasByTecnico.has(cdPessoaFisica)) {
        extrasByTecnico.set(cdPessoaFisica, new Set());
      }
      extrasByTecnico.get(cdPessoaFisica).add(extra);
    };

    state.livroPatio
      .map(item => Number(item.cd_pessoa_fisica))
      .filter(Number.isInteger)
      .forEach(cdPessoaFisica => appendExtra(cdPessoaFisica, 'Patio'));

    state.livroCirculante
      .map(item => Number(item.cd_pessoa_fisica))
      .filter(Number.isInteger)
      .forEach(cdPessoaFisica => appendExtra(cdPessoaFisica, 'Circulante'));

    const tecnicosMap = new Map();
    state.livroTecnicosSelecionados.forEach(item => {
      const cdPessoaFisica = Number(item.cd_pessoa_fisica);
      if (!Number.isInteger(cdPessoaFisica)) return;

      const pacientesValidos = (item.pacientes || [])
        .map(Number)
        .filter(Number.isInteger);
      if (pacientesValidos.length === 0) return;

      if (!tecnicosMap.has(cdPessoaFisica)) {
        tecnicosMap.set(cdPessoaFisica, {
          cd_pessoa_fisica: cdPessoaFisica,
          pacientes: new Set(),
          patio_circulante: new Set()
        });
      }

      const entry = tecnicosMap.get(cdPessoaFisica);
      pacientesValidos.forEach(atendimento => entry.pacientes.add(atendimento));
    });

    extrasByTecnico.forEach((extras, cdPessoaFisica) => {
      if (!tecnicosMap.has(cdPessoaFisica)) {
        tecnicosMap.set(cdPessoaFisica, {
          cd_pessoa_fisica: cdPessoaFisica,
          pacientes: new Set(),
          patio_circulante: new Set()
        });
      }

      const entry = tecnicosMap.get(cdPessoaFisica);
      extras.forEach(extra => entry.patio_circulante.add(extra));
    });

    const tecnicos = [...tecnicosMap.values()].map(item => ({
      cd_pessoa_fisica: item.cd_pessoa_fisica,
      pacientes: [...item.pacientes],
      patio_circulante: [...item.patio_circulante]
    }));

    const faltas_folgas = state.livroFaltasFolgas
      .filter(item => Number.isInteger(item.cd_pessoa_fisica) && ['Falta', 'Folga'].includes(item.tipo))
      .map(item => ({
        cd_pessoa_fisica: Number(item.cd_pessoa_fisica),
        tipo: item.tipo
      }));

    const avaliacao_externa = state.livroAvaliacaoExterna
      .map(item => ({
        cd_pessoa_fisica: Number.isInteger(Number(item.cd_pessoa_fisica)) ? Number(item.cd_pessoa_fisica) : null,
        pacientes: Array.isArray(item.pacientes) ? [...new Set(item.pacientes.map(Number).filter(Number.isInteger))] : [],
        descricao: String(item.descricao || '').trim()
      }))
      .filter(item => Number.isInteger(item.cd_pessoa_fisica) && item.pacientes.length > 0);

    const observacoes = document.getElementById('livro-observacoes').value || '';

    if (isLivroSetorEct()) {
      const preList = state.livroEctPre.map(i => Number(i.cd_pessoa_fisica)).filter(Number.isInteger);
      const salaList = state.livroEctSala.map(i => Number(i.cd_pessoa_fisica)).filter(Number.isInteger);
      const recList = state.livroEctRecuperacao.map(i => Number(i.cd_pessoa_fisica)).filter(Number.isInteger);

      const temEct = preList.length > 0 || salaList.length > 0 || recList.length > 0;

      if (!temEct && !observacoes.trim()) {
        showToast('Adicione profissionais na equipe ECT ou informe observações', 'warning');
        return null;
      }

      return {
        data_plantao: document.getElementById('livro-data-plantao').value || getTodayIsoDate(),
        turno,
        cd_setor_atendimento: cdSetor,
        cd_modulo: cdSetor === 4 ? 4 : 1,
        enfermeiro_cd_pessoa_fisica: enfermeiroId,
        ect: {
          pre_procedimento: preList,
          sala_procedimento: salaList,
          sala_recuperacao: recList
        },
        tecnicos: [],
        faltas_folgas: [],
        avaliacao_externa: [],
        observacoes
      };
    }

    const temPacientes = tecnicos.some(item => item.pacientes.length > 0);
    const temPatioCirculante = extrasByTecnico.size > 0;
    const temAvaliacaoExterna = avaliacao_externa.length > 0;

    if (!temPacientes && !temPatioCirculante && faltas_folgas.length === 0 && !temAvaliacaoExterna && !observacoes.trim()) {
      showToast('Preencha técnicos/pacientes, pátio/circulante, faltas/folgas, avaliação externa ou observações', 'warning');
      return null;
    }

    return {
      data_plantao: document.getElementById('livro-data-plantao').value || getTodayIsoDate(),
      turno,
      cd_setor_atendimento: cdSetor,
      cd_modulo: cdSetor === 4 ? 4 : 1,
      enfermeiro_cd_pessoa_fisica: enfermeiroId,
      tecnicos,
      faltas_folgas,
      avaliacao_externa,
      observacoes
    };
  }

  function adicionarEctPre() {
    state.livroEctPre.push(buildEctPreRow());
    renderEctPreList();
  }

  function removerEctPre(rowKey) {
    state.livroEctPre = state.livroEctPre.filter(item => item.row_key !== rowKey);
    renderEctPreList();
  }

  function adicionarEctSala() {
    state.livroEctSala.push(buildEctSalaRow());
    renderEctSalaList();
  }

  function removerEctSala(rowKey) {
    state.livroEctSala = state.livroEctSala.filter(item => item.row_key !== rowKey);
    renderEctSalaList();
  }

  function adicionarEctRecuperacao() {
    state.livroEctRecuperacao.push(buildEctRecuperacaoRow());
    renderEctRecuperacaoList();
  }

  function removerEctRecuperacao(rowKey) {
    state.livroEctRecuperacao = state.livroEctRecuperacao.filter(item => item.row_key !== rowKey);
    renderEctRecuperacaoList();
  }

  document.getElementById('livro-setor').addEventListener('change', onLivroSetorChange);

  const loadLivroContextoDebounced = debounce(async () => {
    const dateValue = getLivroDataSelecionada();
    loadLivroAdministrativoByDate(dateValue);
    await checkPatioCirculanteGlobal();
    await loadSetoresLivro();
  }, 300);

  document.getElementById('livro-data-plantao').addEventListener('change', loadLivroContextoDebounced);
  document.querySelectorAll('input[name="livro-turno"]').forEach(radio => {
    radio.addEventListener('change', loadLivroContextoDebounced);
  });

  document.getElementById('btn-livro-editar')?.addEventListener('click', ensureLivroEditable);

  document.getElementById('livro-enfermeiro').addEventListener('change', e => {
    const value = Number(e.target.value);
    state.livroEnfermeiroSelecionado = Number.isInteger(value) ? value : null;
  });

  document.getElementById('btn-add-ect-pre')?.addEventListener('click', adicionarEctPre);
  document.getElementById('btn-add-ect-sala')?.addEventListener('click', adicionarEctSala);
  document.getElementById('btn-add-ect-recuperacao')?.addEventListener('click', adicionarEctRecuperacao);

  document.getElementById('livro-ect-pre-list')?.addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;
    if (target.matches('[data-action="ect-pre-select"]')) {
      const val = Number(target.value);
      const row = state.livroEctPre.find(i => i.row_key === rowKey);
      if (row) row.cd_pessoa_fisica = Number.isInteger(val) ? val : null;
    }
  });

  document.getElementById('livro-ect-pre-list')?.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-ect-pre"]');
    if (!button) return;
    removerEctPre(button.dataset.rowKey);
  });

  document.getElementById('livro-ect-sala-list')?.addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;
    if (target.matches('[data-action="ect-sala-select"]')) {
      const val = Number(target.value);
      const row = state.livroEctSala.find(i => i.row_key === rowKey);
      if (row) row.cd_pessoa_fisica = Number.isInteger(val) ? val : null;
    }
  });

  document.getElementById('livro-ect-sala-list')?.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-ect-sala"]');
    if (!button) return;
    removerEctSala(button.dataset.rowKey);
  });

  document.getElementById('livro-ect-recuperacao-list')?.addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;
    if (target.matches('[data-action="ect-recuperacao-select"]')) {
      const val = Number(target.value);
      const row = state.livroEctRecuperacao.find(i => i.row_key === rowKey);
      if (row) row.cd_pessoa_fisica = Number.isInteger(val) ? val : null;
    }
  });

  document.getElementById('livro-ect-recuperacao-list')?.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-ect-recuperacao"]');
    if (!button) return;
    removerEctRecuperacao(button.dataset.rowKey);
  });
  document.getElementById('btn-add-tecnico').addEventListener('click', adicionarTecnico);
  document.getElementById('btn-add-falta').addEventListener('click', adicionarFalta);
  document.getElementById('btn-add-avaliacao-externa')?.addEventListener('click', adicionarAvaliacao);
  document.getElementById('btn-add-patio')?.addEventListener('click', adicionarPatio);
  document.getElementById('btn-add-circulante')?.addEventListener('click', adicionarCirculante);

  document.getElementById('livro-tecnicos-list').addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;

    if (target.matches('[data-action="tecnico-select"]')) {
      const novoTecnico = Number(target.value);
      const row = state.livroTecnicosSelecionados.find(item => item.row_key === rowKey);
      if (!row) return;

      if (
        Number.isInteger(novoTecnico) &&
        state.livroTecnicosSelecionados.some(
          item => item.row_key !== rowKey && Number(item.cd_pessoa_fisica) === novoTecnico
        )
      ) {
        target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
        showToast('Técnico já selecionado em outra linha', 'warning');
        return;
      }

      if (Number.isInteger(novoTecnico) && isTecnicoComConflitoDeFuncao(novoTecnico, 'tecnico', rowKey)) {
        target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
        showToast('Técnico em pátio/circulante não pode ficar na lista de técnicos com pacientes', 'warning');
        return;
      }

      row.cd_pessoa_fisica = Number.isInteger(novoTecnico) ? novoTecnico : null;
      row.pacientes = [];
      refreshLivroPacienteVinculo();
      renderTecnicosList();
      return;
    }

    if (target.matches('.livro-paciente-checkbox')) {
      togglePaciente(rowKey, target.dataset.pacienteId, target);
      return;
    }
  });

  document.getElementById('livro-tecnicos-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-tecnico"]');
    if (!button) return;
    removerTecnico(button.dataset.rowKey);
  });

  document.getElementById('livro-faltas-list').addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;

    const row = state.livroFaltasFolgas.find(item => item.row_key === rowKey);
    if (!row) return;

    if (target.matches('[data-action="falta-tecnico"]')) {
      const tecnico = Number(target.value);
      row.cd_pessoa_fisica = Number.isInteger(tecnico) ? tecnico : null;
      return;
    }

    if (target.matches('[data-action="falta-tipo"]')) {
      row.tipo = target.value === 'Folga' ? 'Folga' : 'Falta';
    }
  });

  document.getElementById('livro-faltas-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-falta"]');
    if (!button) return;
    removerFalta(button.dataset.rowKey);
  });

  document.getElementById('livro-patio-list').addEventListener('change', e => {
    const target = e.target;
    if (!target.matches('[data-action="patio-select"]')) return;

    const rowKey = target.dataset.rowKey;
    const row = state.livroPatio.find(item => item.row_key === rowKey);
    if (!row) return;

    const tecnicoId = Number(target.value);
    if (!Number.isInteger(tecnicoId)) {
      row.cd_pessoa_fisica = null;
      return;
    }

    if (isTecnicoComConflitoDeFuncao(tecnicoId, 'patio', rowKey)) {
      target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
      showToast('Técnico já vinculado em outra função', 'warning');
      return;
    }

    row.cd_pessoa_fisica = tecnicoId;
  });

  document.getElementById('livro-patio-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-patio"]');
    if (!button) return;
    removerPatio(button.dataset.rowKey);
  });

  document.getElementById('livro-circulante-list').addEventListener('change', e => {
    const target = e.target;
    if (!target.matches('[data-action="circulante-select"]')) return;

    const rowKey = target.dataset.rowKey;
    const row = state.livroCirculante.find(item => item.row_key === rowKey);
    if (!row) return;

    const tecnicoId = Number(target.value);
    if (!Number.isInteger(tecnicoId)) {
      row.cd_pessoa_fisica = null;
      return;
    }

    if (isTecnicoComConflitoDeFuncao(tecnicoId, 'circulante', rowKey)) {
      target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
      showToast('Técnico já vinculado em outra função', 'warning');
      return;
    }

    row.cd_pessoa_fisica = tecnicoId;
  });

  document.getElementById('livro-circulante-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-circulante"]');
    if (!button) return;
    removerCirculante(button.dataset.rowKey);
  });

  document.getElementById('livro-avaliacao-externa-list').addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;

    if (!target.matches('[data-action="avaliacao-tecnico"]')) return;

    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    if (!row) return;

    const tecnicoId = Number(target.value);
    row.cd_pessoa_fisica = Number.isInteger(tecnicoId) ? tecnicoId : null;
  });

  const renderAvaliacaoAutocompleteDebounced = debounce((rowKey, context) => {
    renderAvaliacaoAutocomplete(rowKey, context);
  }, 300);

  document.getElementById('livro-avaliacao-externa-list').addEventListener('input', e => {
    const target = e.target;
    if (!target.matches('.paciente-descricao-input')) return;

    const rowKey = target.dataset.rowKey;
    if (!rowKey) return;

    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    if (!row) return;

    row.descricao = String(target.value || '');
    const context = getAutocompleteContextFromDescricao(target);
    renderAvaliacaoAutocompleteDebounced(rowKey, context);
  });

  document.getElementById('livro-avaliacao-externa-list').addEventListener('click', e => {
    const removerBtn = e.target.closest('[data-action="remover-avaliacao"]');
    if (removerBtn) {
      removerAvaliacao(removerBtn.dataset.rowKey);
      return;
    }

    const removerPacienteBtn = e.target.closest('[data-action="remover-paciente-avaliacao"]');
    if (removerPacienteBtn) {
      removePacienteFromAvaliacao(removerPacienteBtn.dataset.rowKey, removerPacienteBtn.dataset.atendimento);
      renderAvaliacaoList();
      return;
    }

    const selecionarPaciente = e.target.closest('[data-action="selecionar-paciente-avaliacao"]');
    if (selecionarPaciente) {
      const rowKey = selecionarPaciente.dataset.rowKey;
      const atendimento = selecionarPaciente.dataset.atendimento;
      const dropdown = document.querySelector(`.autocomplete-dropdown[data-row-key="${rowKey}"]`);
      const tokenStartRaw = dropdown?.dataset?.tokenStart || '';
      const tokenEndRaw = dropdown?.dataset?.tokenEnd || '';
      const tokenStart = /^\d+$/.test(tokenStartRaw) ? Number(tokenStartRaw) : null;
      const tokenEnd = /^\d+$/.test(tokenEndRaw) ? Number(tokenEndRaw) : null;

      insertPacienteNomeNaDescricao(rowKey, atendimento, tokenStart, tokenEnd);
      addPacienteToAvaliacao(rowKey, atendimento);
      renderAvaliacaoList();
    }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.paciente-search-wrapper')) return;
    document.querySelectorAll('.autocomplete-dropdown').forEach(dropdown => dropdown.classList.add('hidden'));
  });

  workspaceLivro?.addEventListener('input', () => markModuleDraftDirty('livro'));
  workspaceLivro?.addEventListener('change', () => markModuleDraftDirty('livro'));
  workspaceLivro?.addEventListener('click', event => {
    const mutationControl = event.target.closest(
      '#btn-add-tecnico, #btn-add-falta, #btn-add-avaliacao-externa, #btn-add-patio, #btn-add-circulante, ' +
      '[data-action="remover-tecnico"], [data-action="remover-falta"], [data-action="remover-avaliacao"], ' +
      '[data-action="remover-patio"], [data-action="remover-circulante"], ' +
      '[data-action="remover-paciente-avaliacao"], [data-action="selecionar-paciente-avaliacao"]'
    );
    if (mutationControl) markModuleDraftDirty('livro');
  });

  document.getElementById('btn-livro-salvar').addEventListener('click', async () => {
    const btn = document.getElementById('btn-livro-salvar');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
    btn.disabled = true;

    try {
      const payload = collectEscalaTecnicaPayload();
      if (!payload) return;

      const setorId = payload.cd_setor_atendimento;
      const dtPlantao = payload.data_plantao || getTodayIsoDate();
      const turno = payload.turno || 'M';

      const checkResult = await api.get(
        `/api/escala-ativa?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}`
      );

      if (checkResult.success && checkResult.data && checkResult.data.tecnicos && checkResult.data.tecnicos.length > 0) {
        const confirm = await showConfirmModal(
          'Escala já existente',
          'Já existe uma escala para este setor, data e turno. Deseja alterar?'
        );
        if (!confirm) return;

        const justificativa = await showJustificativaModal();
        if (justificativa === null) return;
        payload.ds_justificativa = justificativa;
      }

      const resultDb = await api.put('/api/escala-ativa', payload);
      if (!resultDb.success) {
        showToast(resultDb.message || 'Falha ao salvar escala', 'error');
        return;
      }

      const resultOc = await api.post('/api/escala-tecnica', payload);
      if (resultOc.success) {
        clearModuleDraft('livro');
        showToast('Escala salva com sucesso', 'success');
        await loadLivroAdministrativoByDate(dtPlantao);
      } else {
        showToast(resultOc.message || 'Escala salva no DB mas falha no histórico', 'warning');
        await loadLivroAdministrativoByDate(dtPlantao);
      }
    } catch (err) {
      showToast('Erro ao salvar escala técnica', 'error');
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  });

  document.getElementById('btn-livro-buscar').addEventListener('click', async () => {
    ensureLivroEditable();
    await loadLivroAdministrativoByDate(getLivroDataSelecionada());
  });

  document.getElementById('btn-livro-limpar')?.addEventListener('click', async () => {
    const confirm = await showConfirmModal(
      'Limpar escala?',
      'Os dados preenchidos nesta tela serão removidos. Deseja continuar?'
    );
    if (!confirm) return;

    clearLivroForm();
    clearModuleDraft('livro');
    showToast('Formulário limpo', 'success');
  });

  document.getElementById('btn-livro-historico')?.addEventListener('click', async () => {
    await showHistoricoModal();
  });
  


const moduleHandlers = {
    auditorias: () => {
      const draft = getModuleDraft('auditorias');
      if (draft?.activeScreen && typeof window.hydrateAuditoriaDraft === 'function') {
        window.hydrateAuditoriaDraft(draft);
      } else {
        const menu = document.getElementById('auditorias-sub-menu');
        if (menu) activateWorkspace('auditorias-submenu', menu);
      }
    },
   passagem: () => {
     showPassagemSubMenu(); return; if (false) {
       enterPassagemMode();
     } else if (state.lastModuleState.passagem === 'passagens-anteriores') {
       document.getElementById('btn-passagem-anteriores')?.click();
     } else {
       showPassagemSubMenu();
     }
   },
   dashboard: enterDashboardMode,
   livro: () => {
     if (state.lastModuleState.livro === 'livro') {
       enterLivroMode();
     } else if (state.lastModuleState.livro === 'print') {
       document.getElementById('btn-livro-imprimir')?.click();
     } else {
       showLivroSubMenu();
     }
   },
   escala: enterEscalaMode,
   dashboard_pa: enterDashboardInternacaoMode
 };

  document.getElementById('btn-passagem-lancar')?.addEventListener('click', () => {
    if (!temPermissaoAtiva('passagem', 'lancar_nova_passagem')) {
      showToast('Seu perfil não possui permissão para lançar uma nova passagem.', 'warning');
      return;
    }
    enterPassagemMode();
  });

  document.getElementById('btn-passagem-anteriores')?.addEventListener('click', async () => {
    activateWorkspace('passagens-anteriores', workspacePassagensAnteriores);
    await populatePassagensFilterSetores();
    await loadPassagensAnteriores();
  });

  document.getElementById('btn-passagens-voltar')?.addEventListener('click', showPassagemSubMenu);
  document.getElementById('btn-voltar-passagem-principal')?.addEventListener('click', showPassagemSubMenu);
  document.getElementById('btn-passagem-voltar-header')?.addEventListener('click', showPassagemSubMenu);
  document.getElementById('btn-escala-voltar')?.addEventListener('click', showModeChooser);
  document.getElementById('btn-livro-voltar-home')?.addEventListener('click', showModeChooser);
  document.getElementById('btn-passagem-voltar-home')?.addEventListener('click', showModeChooser);

  document.getElementById('btn-passagens-filtrar')?.addEventListener('click', async () => {
    await loadPassagensAnteriores();
  });

  async function loadPassagensAnteriores() {
    const list = document.getElementById('passagem-history-list');
    const detail = document.getElementById('passagem-history-detail');
    if (!list || !detail) return;
    
    const inputInicio = document.getElementById('passagens-filter-data-inicio');
    const inputFim = document.getElementById('passagens-filter-data-fim');
    
    // Default dates if empty
    if (!inputInicio.value && !inputFim.value) {
      const today = new Date();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(today.getDate() - 3);
      
      inputInicio.value = threeDaysAgo.toISOString().split('T')[0];
      inputFim.value = today.toISOString().split('T')[0];
    }
    
    const setorFilter = document.getElementById('passagens-filter-setor')?.value || '';
    const dtInicio = inputInicio.value;
    const dtFim = inputFim.value;
    
    const queryParams = new URLSearchParams();
    if (setorFilter) queryParams.append('setor', setorFilter);
    if (dtInicio) queryParams.append('dtInicio', dtInicio);
    if (dtFim) queryParams.append('dtFim', dtFim);
    
    const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando passagens...</div>';
    detail.innerHTML = '<div class="loading-placeholder"><i class="bi bi-journal-text"></i> Selecione uma passagem para visualizar.</div>';
    try {
      const result = await api.get(`/api/passagens/anteriores${queryStr}`);
      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
        list.innerHTML = '<div class="loading-placeholder">Nenhuma passagem anterior encontrada para este perfil e filtro.</div>';
        return;
      }
      const passagens = result.data;
      list.innerHTML = passagens.map((item, index) => `
        <button class="passagem-history-item" type="button" data-index="${index}">
          <strong>${escapeHtml(item.ds_setor || `Setor ${item.cd_setor_atendimento || '-'}`)}</strong>
          <span>Ocorrência #${escapeHtml(item.nr_ocorrencia)}</span>
          <small><span><i class="bi bi-clock"></i> ${escapeHtml(formatPrintReleaseDate(item.dt_lancamento))}</span><span><i class="bi bi-person"></i> ${escapeHtml(item.nm_usuario || '-')}</span></small>
        </button>`).join('');
      const renderDetail = index => {
        const item = passagens[index];
        if (!item) return;
        list.querySelectorAll('.passagem-history-item').forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === index));
        detail.innerHTML = `<header><h3>${escapeHtml(item.ds_setor || `Setor ${item.cd_setor_atendimento || '-'}`)}</h3><div class="passagem-history-meta"><span><i class="bi bi-clock"></i> ${escapeHtml(formatPrintReleaseDate(item.dt_lancamento))}</span><span><i class="bi bi-person-check"></i> ${escapeHtml(item.nm_usuario || '-')}</span><span>Ocorrência #${escapeHtml(item.nr_ocorrencia)}</span></div></header><div class="passagem-history-text">${item.ds_ocorrencia || ''}</div>`;
      };
      list.querySelectorAll('.passagem-history-item').forEach(button => button.addEventListener('click', () => renderDetail(Number(button.dataset.index))));
      renderDetail(0);
    } catch (err) {
      list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> Não foi possível carregar as passagens.</div>';
      showToast(err?.message || 'Erro ao carregar passagens anteriores', 'error');
    }
  }

  const topbarHandlers = { ...moduleHandlers, admin: () => { window.location.href = '/admin'; } };

  registerAllModuleHandlers();

 getModulesInGridOrder().forEach(modulo => {
   const topbarBtn = document.getElementById(modulo.topbarButtonId);
   if (topbarBtn && topbarHandlers[modulo.id]) {
     topbarBtn.addEventListener('click', topbarHandlers[modulo.id]);
   }
 });

  // --- Livro Sub-Menu ---
  function showLivroSubMenu() {
    activateWorkspace('livro-submenu', livroSubMenu);
  }

  document.getElementById('btn-livro-lancar')?.addEventListener('click', () => {
    enterLivroMode();
  });

  document.getElementById('btn-livro-imprimir')?.addEventListener('click', () => {
    activateWorkspace('print', workspacePrint);
    const dataInput = document.getElementById('print-data-plantao');
    if (dataInput) dataInput.value = getTodayIsoDate();
    const turnoSelect = document.getElementById('print-turno');
    const setorSelect = document.getElementById('print-setor');
    if (turnoSelect) turnoSelect.value = '';
    if (setorSelect) setorSelect.innerHTML = '<option value="">Todos os setores</option>';
    state.printHtmlBody = null;
    state.printEscalasAll = [];
    state.printEscalasFiltradas = [];
    setTimeout(() => buscarEscalasLiberadas(), 100);
  });

  document.getElementById('btn-livro-voltar')?.addEventListener('click', () => {
    showLivroSubMenu();
  });

  document.getElementById('btn-print-voltar')?.addEventListener('click', () => {
    showLivroSubMenu();
  });

  document.getElementById('btn-print-imprimir')?.addEventListener('click', () => {
    imprimirTodasEscalas();
  });

  document.getElementById('btn-print-buscar')?.addEventListener('click', () => {
    buscarEscalasLiberadas();
  });

  document.getElementById('print-setor')?.addEventListener('change', () => {
    aplicarFiltroSetorImpressao();
  });

  document.getElementById('print-preview')?.addEventListener('click', event => {
    const button = event.target.closest('[data-action="imprimir-escala"]');
    if (!button) return;

    const index = Number(button.dataset.index);
    const escala = state.printEscalasFiltradas[index];
    if (!escala) {
      showToast('Escala não encontrada para impressão', 'warning');
      return;
    }

    imprimirEscalaAssistencial('', buildPrintHtml([escala]));
  });

  async function buscarEscalasLiberadas() {
    const data = document.getElementById('print-data-plantao')?.value;
    const turno = document.getElementById('print-turno')?.value || '';
    if (!data) {
      showToast('Selecione a data do plantão', 'warning');
      return;
    }

    const btn = document.getElementById('btn-print-buscar');
    const preview = document.getElementById('print-preview');
    const btnImprimir = document.getElementById('btn-print-imprimir');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Buscando...'; }

    try {
      const params = new URLSearchParams({ data });
      if (turno) params.set('turno', turno);
      const res = await api.get(`/api/escala-tecnica/todas?${params.toString()}`);

      if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
        state.printHtmlBody = null;
        state.printEscalasAll = [];
        state.printEscalasFiltradas = [];
        preencherSetoresImpressao([]);
        atualizarResumoImpressao([], data, turno);
        if (preview) preview.innerHTML = renderPrintEmptyState('Nenhuma escala liberada para os filtros informados.');
        if (btnImprimir) btnImprimir.classList.add('d-none');
        return;
      }

      state.printEscalasAll = res.data;
      preencherSetoresImpressao(res.data);
      aplicarFiltroSetorImpressao();
    } catch (e) {
      state.printHtmlBody = null;
      state.printEscalasAll = [];
      state.printEscalasFiltradas = [];
      if (btnImprimir) btnImprimir.classList.add('d-none');
      if (preview) preview.innerHTML = renderPrintEmptyState('Não foi possível carregar as escalas neste momento.', 'bi-exclamation-triangle');
      showToast('Erro ao buscar escalas', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-funnel"></i> Aplicar filtros'; }
    }
  }

  function preencherSetoresImpressao(escalas) {
    const select = document.getElementById('print-setor');
    if (!select) return;

    const currentValue = select.value;
    const setores = new Map();
    escalas.forEach(escala => {
      const codigo = String(escala.cd_setor_atendimento ?? '');
      if (!codigo) return;
      setores.set(codigo, escala.ds_setor || `Setor ${codigo}`);
    });

    const options = Array.from(setores.entries())
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'))
      .map(([codigo, descricao]) => `<option value="${escapeHtml(codigo)}">${escapeHtml(descricao)}</option>`)
      .join('');

    select.innerHTML = `<option value="">Todos os setores</option>${options}`;
    if (currentValue && setores.has(currentValue)) select.value = currentValue;
  }

  function aplicarFiltroSetorImpressao() {
    const data = document.getElementById('print-data-plantao')?.value || '';
    const turno = document.getElementById('print-turno')?.value || '';
    const setor = document.getElementById('print-setor')?.value || '';
    const filtradas = setor
      ? state.printEscalasAll.filter(escala => String(escala.cd_setor_atendimento) === setor)
      : [...state.printEscalasAll];

    state.printEscalasFiltradas = filtradas;
    state.printHtmlBody = filtradas.length > 0 ? buildPrintHtml(filtradas) : null;
    renderPrintPreview(filtradas, data, turno);
    atualizarResumoImpressao(filtradas, data, turno);

    document.getElementById('btn-print-imprimir')?.classList.toggle('d-none', filtradas.length === 0);
  }

  function getPrintEscalaTurno(escala, turnoFallback = '') {
    const turno = String(escala?.payload?.turno || turnoFallback || '').trim().toUpperCase();
    if (turno === 'N' || turno === '2') return { value: 'N', label: 'Noturno' };
    if (turno === 'M' || turno === '1') return { value: 'M', label: 'Diurno' };
    return { value: '', label: 'Turno não informado' };
  }

  function formatPrintReleaseDate(value) {
    if (!value) return 'Liberação não informada';
    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function renderPrintEmptyState(message, icon = 'bi-file-earmark-text') {
    return `<div class="print-empty-state">
      <span><i class="bi ${icon}"></i></span>
      <strong>Nenhuma escala encontrada</strong>
      <p>${escapeHtml(message)}</p>
    </div>`;
  }

  function atualizarResumoImpressao(escalas, data, turno) {
    const summary = document.getElementById('print-results-summary');
    if (!summary) return;

    const turnoLabel = turno === 'M'
      ? 'Turno diurno'
      : turno === 'N'
        ? 'Turno noturno'
        : 'Todos os turnos';
    const countLabel = escalas.length === 1 ? '1 escala liberada' : `${escalas.length} escalas liberadas`;

    summary.innerHTML = `<div>
      <strong>${countLabel}</strong>
      <span>${escapeHtml(data || '')} · ${turnoLabel}</span>
    </div>`;
  }

  function renderPrintPreview(escalas, data, turno) {
    const preview = document.getElementById('print-preview');
    if (!preview) return;

    if (!escalas.length) {
      preview.innerHTML = renderPrintEmptyState('Ajuste os filtros para consultar outros registros.');
      return;
    }

    preview.innerHTML = escalas.map((escala, index) => {
      const setor = escala.ds_setor || `Setor ${escala.cd_setor_atendimento}`;
      const escalaTurno = getPrintEscalaTurno(escala, turno);
      const usuario = escala.nm_usuario || 'Usuário não informado';
      const liberacao = formatPrintReleaseDate(escala.dt_liberacao);

      return `<article class="print-scale-card">
        <header class="print-scale-card-header">
          <div class="print-scale-title">
            <span class="print-scale-building"><i class="bi bi-building"></i></span>
            <div>
              <h3>${escapeHtml(setor)}</h3>
              <div class="print-scale-meta">
                <span><i class="bi ${escalaTurno.value === 'N' ? 'bi-moon-stars' : 'bi-sun'}"></i> ${escalaTurno.label}</span>
                <span><i class="bi bi-calendar3"></i> ${escapeHtml(data)}</span>
                <span><i class="bi bi-person-check"></i> ${escapeHtml(usuario)}</span>
                <span><i class="bi bi-clock"></i> ${escapeHtml(liberacao)}</span>
              </div>
            </div>
          </div>
          <div class="print-scale-card-actions">
            <span class="print-release-chip"><i class="bi bi-check-circle-fill"></i> Liberada</span>
            <button class="btn-secondary print-single-button" type="button" data-action="imprimir-escala" data-index="${index}">
              <i class="bi bi-printer"></i> Imprimir
            </button>
          </div>
        </header>
        <div class="print-scale-content">${escala.ds_ocorrencia || ''}</div>
      </article>`;
    }).join('');
  }

  function buildPrintHtml(escalas) {
    let bodyHtml = '';
    for (let i = 0; i < escalas.length; i++) {
      const esc = escalas[i];
      const isLast = (i === escalas.length - 1);
      bodyHtml += `<div class="escala-print-item" style="${isLast ? '' : 'page-break-after: always;'}">
        <div style="font-weight:700;font-size:1.05rem;color:#0754a6;margin-bottom:0.5rem;border-bottom:2px solid #bfdbfe;padding-bottom:0.3rem;">
          ${escapeHtml(esc.ds_setor || 'Setor ' + esc.cd_setor_atendimento)}
        </div>
        <div>${esc.ds_ocorrencia || ''}</div>
      </div>`;
    }
    return bodyHtml;
  }

  function imprimirTodasEscalas() {
    if (!state.printHtmlBody) {
      showToast('Nenhuma escala para imprimir', 'warning');
      return;
    }
    imprimirEscalaAssistencial('', state.printHtmlBody);
  }

  dashboardSetorSelect?.addEventListener('change', onDashboardSetorChange);

  document.getElementById('btn-dashboard-refresh')?.addEventListener('click', () => {

    loadDashboardPacientes(true);

  });

  document.getElementById('btn-dashboard-internacao-refresh')?.addEventListener('click', () => {

    loadDashboardPA(true);

  });

  document.getElementById('modal-internacao-close')?.addEventListener('click', () => {

    closeInternacaoModal();

  });

  document.getElementById('btn-aceitar-internacao')?.addEventListener('click', () => {

    handleInternacaoAcao('aceitar');

  });

  document.getElementById('btn-recusar-internacao')?.addEventListener('click', () => {

    handleInternacaoAcao('recusar');

  });

  document.getElementById('btn-alterar-decisao')?.addEventListener('click', () => {

    enableDecisaoAlteracao();

  });

  document.getElementById('btn-cancelar-alteracao')?.addEventListener('click', () => {

    disableDecisaoAlteracao();

  });

  document.getElementById('dashboard-pa-stats-cards')?.addEventListener('click', e => {
    const button = e.target.closest('[data-pa-tag]');
    if (!button) return;

    const tag = String(button.dataset.paTag || '').trim();
    if (!tag) return;

    if (tag === 'all') {
      state.dashboardPAFiltroEtiqueta = null;
    } else {
      if (state.dashboardPAFiltroEtiqueta === tag) {
        state.dashboardPAFiltroEtiqueta = null;
      } else {
        state.dashboardPAFiltroEtiqueta = tag;
      }
    }

    updatePAStats();
    renderDashboardPAPacientes();
  });



  document.getElementById('dashboard-stats-cards')?.addEventListener('click', e => {
    const button = e.target.closest('[data-tag]');
    if (!button) return;

    const tag = String(button.dataset.tag || '').trim();
    if (!tag) return;

    if (tag === 'all') {
      state.dashboardFiltroEtiquetas = new Set();
    } else {
      const current = state.dashboardFiltroEtiquetas.values().next().value;
      if (current === tag) {
        state.dashboardFiltroEtiquetas = new Set();
      } else {
        state.dashboardFiltroEtiquetas = new Set([tag]);
      }
    }

    updateDashboardStats(state.dashboardResumo || buildDashboardResumo(state.dashboardPacientes));
    renderDashboardPacientes();
  });



  document.getElementById('topbar-brand')?.addEventListener('click', () => {

    if (state.mode !== null) {
      showModeChooser();
    }

  });



  document.getElementById('btn-logout').addEventListener('click', async () => {

    draftSaveTimers.forEach(timer => clearTimeout(timer));
    draftSaveTimers.clear();
    draftDirtyModules.clear();
    sessionStorage.clear();

    stopDashboardRefresh();
    stopDashboardPARefresh();

    await api.post('/api/logout');

    state.usuario = null;
    state.livroLoaded = false;
    state.escalaLoaded = false;

    state.setores = [];
    state.setoresSelecionados = [];
    state.pacientes = [];
    state.savedTexts = {};

    state.mode = null;

    state.cdModulo = null;

    state.livroSetores = [];

    state.livroSetorSelecionado = null;

    state.livroTecnicos = [];

    state.livroPacientes = [];

    state.livroTecnicosSelecionados = [];

    state.livroFaltasFolgas = [];

    state.livroPacienteVinculo = new Map();

    state.livroEnfermeiros = [];

    state.livroEnfermeiroSelecionado = null;

    state.livroAvaliacaoExterna = [];

    state.livroPatio = [];

    state.livroCirculante = [];

    state.escalaSemanalCells = {};
    state.escalaEdicao = null;
    state.escalaPsicologiaItens = [];

    state.dashboardSetores = [];

    state.dashboardSetorSelecionado = null;

    state.dashboardPacientes = [];

    state.dashboardFiltroEtiquetas = new Set();

    state.dashboardResumo = null;

    state.dashboardPA = {
      particularesAlta: [],
      altaMedica: [],
      salaObservacao: [],
      indicacaoInternacao: [],
      decididos: []
    };
    state.dashboardPALoaded = false;

    state.dashboardPATimer = null;

    state.dashboardPAClockTimer = null;

    const select = document.getElementById('setor-select');

    if (select) {

      select.value = '';

      select.classList.remove('d-none');

    }

    showScreen('login');

    inpUsuario.value = '';

    inpSenha.value = '';

    loginError.classList.add('d-none');

    showToast('Sessão encerrada', 'info');

  });



  document.getElementById('btn-clear-patients').addEventListener('click', () => {

    clearModuleDraft('passagem');

    state.pacientes = [];

    state.setoresSelecionados = [];

    state.savedTexts = {};

    document.getElementById('pacientes-list').innerHTML = '';

    document.getElementById('pacientes-list').classList.add('d-none');

    document.getElementById('empty-state').classList.remove('d-none');

    document.getElementById('main-footer').classList.add('d-none');

    document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));

    document.getElementById('pacientes-count').textContent = '0';

    document.getElementById('intercorrencias-count').textContent = '0';

    updateSetoresSelecionados();

    showToast('Lista limpa', 'success');

  });



  const sidebarSetores = document.getElementById('sidebar-setores');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarCollapseBtn = document.getElementById('btn-toggle-setores');
  const sidebarExpandBtn = document.getElementById('btn-expand-sidebar');
  let lastSidebarTrigger = null;
  let sidebarResizeFrame = null;

  function isCompactSidebarViewport() {
    return window.innerWidth <= 1366;
  }

  function setSidebarButtonState(expanded) {
    [sidebarCollapseBtn, sidebarExpandBtn].forEach(button => {
      button?.setAttribute('aria-expanded', String(expanded));
    });

    if (sidebarCollapseBtn) {
      sidebarCollapseBtn.setAttribute('aria-label', expanded ? 'Recolher setores' : 'Expandir setores');
      const icon = sidebarCollapseBtn.querySelector('i');
      if (icon) icon.className = expanded ? 'bi bi-chevron-left' : 'bi bi-chevron-right';
    }
  }

  function openSidebarOverlay(trigger = document.activeElement) {
    if (!sidebarSetores || !isCompactSidebarViewport()) return;

    lastSidebarTrigger = trigger instanceof HTMLElement ? trigger : sidebarExpandBtn;
    sidebarSetores.classList.remove('collapsed');
    sidebarSetores.classList.add('open');
    sidebarSetores.setAttribute('aria-hidden', 'false');
    sidebarBackdrop?.classList.remove('d-none');
    sidebarExpandBtn?.classList.add('d-none');
    document.body.classList.add('sidebar-open');
    setSidebarButtonState(true);
    sidebarCollapseBtn?.focus();
  }

  function closeSidebarOverlay(restoreFocus = true) {
    if (!sidebarSetores || !isCompactSidebarViewport()) return;

    const wasOpen = sidebarSetores.classList.contains('open');
    sidebarSetores.classList.remove('open');
    sidebarSetores.classList.add('collapsed');
    sidebarSetores.setAttribute('aria-hidden', 'true');
    sidebarBackdrop?.classList.add('d-none');
    sidebarExpandBtn?.classList.remove('d-none');
    document.body.classList.remove('sidebar-open');
    setSidebarButtonState(false);

    if (restoreFocus && wasOpen && lastSidebarTrigger instanceof HTMLElement) {
      lastSidebarTrigger.focus();
    }
  }

  function toggleSidebar() {
    if (!sidebarSetores) return;

    if (isCompactSidebarViewport()) {
      if (sidebarSetores.classList.contains('open')) {
        closeSidebarOverlay();
      } else {
        openSidebarOverlay();
      }
      return;
    }

    const collapsed = sidebarSetores.classList.toggle('collapsed');
    setSidebarButtonState(!collapsed);
  }

  function syncSidebarForViewport() {
    if (!sidebarSetores) return;

    if (isCompactSidebarViewport()) {
      closeSidebarOverlay(false);
      return;
    }

    sidebarSetores.classList.remove('open', 'collapsed');
    sidebarSetores.setAttribute('aria-hidden', 'false');
    sidebarBackdrop?.classList.add('d-none');
    sidebarExpandBtn?.classList.add('d-none');
    document.body.classList.remove('sidebar-open');
    setSidebarButtonState(true);
  }

  sidebarCollapseBtn?.addEventListener('click', toggleSidebar);
  sidebarExpandBtn?.addEventListener('click', () => openSidebarOverlay(sidebarExpandBtn));
  sidebarBackdrop?.addEventListener('click', () => closeSidebarOverlay());

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebarSetores?.classList.contains('open')) {
      closeSidebarOverlay();
    }
  });

  window.addEventListener('resize', () => {
    if (sidebarResizeFrame) cancelAnimationFrame(sidebarResizeFrame);
    sidebarResizeFrame = requestAnimationFrame(syncSidebarForViewport);
  });

  syncSidebarForViewport();



  async function checkSession() {

    try {

      const result = await api.get('/api/me');

      if (result.success && result.data && result.data.nm_usuario) {

        sessionStorage.setItem('session_active', '1');
        state.usuario = result.data;

        document.getElementById('user-name').textContent = state.usuario.nome || state.usuario.nm_usuario;

        showScreen('app');

        updateProfileLabels();
        initializeDraftSession();

        await loadModulosFromBackend();
        renderSetorDropdown();

        if (shouldShowModeSelector()) {

          showModeChooser();

        } else {

          enterPassagemMode();

        }

      }

    } catch (err) {}

  }



  fillLivroDefaults();

  inpUsuario.focus();

  document.getElementById('btn-toggle-password')?.addEventListener('click', function () {
    const showing = inpSenha.type === 'text';
    inpSenha.type = showing ? 'password' : 'text';
    this.setAttribute('aria-label', showing ? 'Exibir senha' : 'Ocultar senha');
    this.setAttribute('title', showing ? 'Exibir senha' : 'Ocultar senha');
    const icon = this.querySelector('i');
    if (icon) icon.className = showing ? 'bi bi-eye' : 'bi bi-eye-slash';
  });

  async function loadVersion() {

    try {

      const result = await api.get('/api/ping');

      const el = document.getElementById('app-version-footer');
      const status = document.getElementById('system-status');
      const statusText = document.getElementById('system-status-text');

      if (el && result.version) {
        el.textContent = `v${result.version}`;
      }

      const testBar = document.getElementById('test-environment-bar');
      if (testBar) {
        testBar.classList.toggle('d-none', !result.showTestBar);
        document.documentElement.style.setProperty('--app-environment-height', result.showTestBar ? '25px' : '0px');
      }

      status?.classList.remove('offline');
      if (statusText) statusText.textContent = 'Todos os serviços estão operando normalmente';

    } catch (e) {
      document.getElementById('system-status')?.classList.add('offline');
      const statusText = document.getElementById('system-status-text');
      if (statusText) statusText.textContent = 'Não foi possível confirmar o status dos serviços';
    }

  }

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      window.location.reload();
    }
  });

  loadVersion();

  window.addEventListener('beforeunload', () => {
    flushPendingDrafts();
  });

  checkSession();



  setTimeout(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.getBoundingClientRect().bottom > window.innerHeight) {
        console.log('OVERFLOW:', el.tagName, el.className, el.id, el.getBoundingClientRect().bottom);
      }
    });
  }, 2000);

  async function populatePassagensFilterSetores() {
    const select = document.getElementById('passagens-filter-setor');
    if (!select || select.options.length > 1) return; // already populated
    
    try {
      const result = await api.get('/api/passagens/setores-historico');
      if (result.success && result.data) {
        const setoresHistorico = result.data || [];
        setoresHistorico.sort((a, b) => a.ds_setor_atendimento.localeCompare(b.ds_setor_atendimento));
        
        setoresHistorico.forEach(s => {
          const option = document.createElement('option');
          option.value = s.cd_setor_atendimento;
          option.textContent = s.ds_setor_atendimento;
          select.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Erro ao carregar setores do histórico', err);
    }
  }

})();
