import { api } from './api.js';
import { state, MODULOS_CONFIG, draftHydratingModules, DRAFT_STORAGE_VERSION, DRAFT_STORAGE_PREFIX, EDITABLE_DRAFT_MODULES, draftDirtyModules, draftSaveTimers } from './state.js';
import { setLoading, getTodayIsoDate, escapeHtml, renderNomeCivilPaciente, getPacienteInitials, debounce } from './utils.js';
import { showToast, showModal, showConfirmModal } from './ui.js';
import { showScreen, hideAllAppSections, activateWorkspace, isCurrentWorkspace, showModeChooser } from './router.js';
import { checkSession, loadModulosFromBackend, updateProfileLabels, perfilTemAcessoModulo, trocarPerfil, alterarPerfilSeNecessario, getModulosDisponiveis } from './auth.js';


export function normalizeDraftKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  }

export function getDraftStorageKey(profileId = state.usuario?.perfilAtivo) {
    const userId = normalizeDraftKey(state.usuario?.nm_usuario || state.usuario?.usuario || state.usuario?.nome);
    const profile = normalizeDraftKey(profileId);
    if (!userId || !profile) return null;
    return `${DRAFT_STORAGE_PREFIX}:${userId}:${profile}`;
  }

export function getDraftDirtyKey(moduleId, profileId = state.usuario?.perfilAtivo) {
    return `${normalizeDraftKey(profileId)}:${moduleId}`;
  }

export function readDraftEnvelope(profileId = state.usuario?.perfilAtivo) {
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

export function writeDraftEnvelope(envelope, profileId = state.usuario?.perfilAtivo) {
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

export function getModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
    return readDraftEnvelope(profileId).modules[moduleId] || null;
  }

export function setModuleDraft(moduleId, payload, profileId = state.usuario?.perfilAtivo) {
    const envelope = readDraftEnvelope(profileId);
    envelope.modules[moduleId] = {
      ...payload,
      updatedAt: new Date().toISOString()
    };
    writeDraftEnvelope(envelope, profileId);
  }

export function clearModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
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

export function discardModuleWork(moduleId) {
    clearModuleDraft(moduleId);
    draftHydratingModules.add(moduleId);
    try {
      if (moduleId === 'passagem') {
        window.conectaCore?.resetForm?.();
      } else if (moduleId === 'livro') {
        window.conectaCore?.clearLivroForm?.();
      } else if (moduleId === 'escala') {
        state.escalaEdicao = null;
        state.escalaSemanalCells = Object.fromEntries(
          Object.entries(state.escalaSemanalCells || {}).filter(([, escala]) => !escala?.pendente_publicacao)
        );
        state.escalaPsicologiaItens = [];
        const observacoes = document.getElementById('escala-observacoes');
        if (observacoes) observacoes.value = '';
        window.conectaCore?.renderEscalaSemanal?.();
        window.conectaCore?.atualizarBotaoPublicarEscala?.();
      } else if (moduleId === 'registros') {
        if (typeof window.clearRegistrosForm === 'function') {
          window.clearRegistrosForm();
        }
      }
    } finally {
      draftHydratingModules.delete(moduleId);
      updateTopbarDraftIndicators();
    }
  }

export function hasModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
    return Boolean(getModuleDraft(moduleId, profileId)) || draftDirtyModules.has(getDraftDirtyKey(moduleId, profileId));
  }

export function cloneDraftValue(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

export function captureModuleDraft(moduleId) {
    if (moduleId === 'passagem') return window.conectaCore?.capturePassagemDraft?.();
    if (moduleId === 'livro') return window.conectaCore?.captureLivroDraft?.();
    if (moduleId === 'escala') return window.conectaCore?.captureEscalaDraft?.();
    if (moduleId === 'auditorias') return typeof window.captureAuditoriaDraft === 'function' ? window.captureAuditoriaDraft() : null;
    if (moduleId === 'registros') return typeof window.captureRegistrosDraft === 'function' ? window.captureRegistrosDraft() : null;
    return null;
  }

export function flushModuleDraft(moduleId, profileId = state.usuario?.perfilAtivo) {
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

export function flushPendingDrafts(profileId = state.usuario?.perfilAtivo) {
    EDITABLE_DRAFT_MODULES.forEach(moduleId => flushModuleDraft(moduleId, profileId));
  }

export function markModuleDraftDirty(moduleId) {
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

export function updateTopbarDraftIndicators() {
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

export function initializeDraftSession() {
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

