import { api } from './api.js';
import { state, MODULOS_CONFIG, modeTransitionSeq, incrementModeTransitionSeq } from './state.js';
import { setLoading, getTodayIsoDate, escapeHtml, renderNomeCivilPaciente, getPacienteInitials, debounce } from './utils.js';
import { showToast, showModal, showConfirmModal } from './ui.js';
import { normalizeDraftKey, getDraftStorageKey, getDraftDirtyKey, readDraftEnvelope, writeDraftEnvelope, getModuleDraft, setModuleDraft, clearModuleDraft, discardModuleWork, hasModuleDraft, cloneDraftValue, captureModuleDraft, flushModuleDraft, flushPendingDrafts, markModuleDraftDirty, updateTopbarDraftIndicators, initializeDraftSession } from './draft.js';
import { checkSession, loadModulosFromBackend, updateProfileLabels, perfilTemAcessoModulo, trocarPerfil, alterarPerfilSeNecessario, getModulosDisponiveis } from './auth.js';
import { loadModule } from './moduleLoader.js';

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add('active');
}

export function hideAllAppSections() {
  document.querySelectorAll('#screen-app > section, #screen-app > .app-container').forEach(el => el.classList.add('d-none'));
}

export function activateWorkspace(mode, target) {
  flushPendingDrafts();
  incrementModeTransitionSeq();
  window.conectaCore?.stopDashboardRefresh?.();
  window.conectaCore?.stopDashboardPARefresh?.();
  window.conectaCore?.closeSidebarOverlay?.(false);
  state.mode = mode;
  
  const activeModule = window.conectaCore?.getActiveModuleConfig?.();
  if (activeModule) {
    state.lastModuleState[activeModule.id] = mode;
  }

  hideAllAppSections();
  target?.classList.remove('d-none');
  window.conectaCore?.configureTopbarByMode?.();
  return modeTransitionSeq;
}

export function isCurrentWorkspace(transitionId, mode) {
  return modeTransitionSeq === transitionId && state.mode === mode;
}

export function showModeChooser() {
  const modeSelector = document.getElementById('mode-selector');
  activateWorkspace(null, modeSelector);
  
  const perfilAtivo = state.usuario?.perfilAtivo;

  Object.values(MODULOS_CONFIG).forEach(modulo => {
    const el = document.getElementById(modulo.buttonId);
    if (!el) return;
    const hasAccess = perfilAtivo ? perfilTemAcessoModulo(perfilAtivo, modulo.id) : false;
    el.classList.toggle('d-none', !hasAccess);
  });
}


export const moduleHandlers = {
  passagem: async () => { const m = await loadModule('passagem'); m?.showPassagemSubMenu?.(); },
  dashboard: async () => { const m = await loadModule('dashboard'); m?.enterDashboardMode?.(); },
  livro: async () => { const m = await loadModule('livro'); m?.showLivroSubMenu?.(); },
  escala: async () => { const m = await loadModule('escala'); m?.enterEscalaMode?.(); },
  dashboard_pa: async () => { const m = await loadModule('dashboard'); m?.enterDashboardPAMode?.(); },
  dashboard_internacao: async () => { const m = await loadModule('dashboard'); m?.enterDashboardInternacaoMode?.(); },
  registros: async () => { const m = await loadModule('registros'); m?.showRegistrosMenu?.(); },
  auditorias: async () => { const m = await loadModule('auditorias'); m?.showAuditorias?.(); }
};

export const topbarHandlers = {
  ...moduleHandlers,
  passagem: async () => { const m = await loadModule('passagem'); m?.showPassagemSubMenu?.(); },
  livro: async () => { const m = await loadModule('livro'); m?.showLivroSubMenu?.(); },
  auditorias: async () => { const m = await loadModule('auditorias'); m?.showAuditorias?.(); },
  admin: () => { window.location.href = '/admin'; }
};


export function getModulesInGridOrder() {
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

export function registerAllModuleHandlers() {
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

export function rebuildModuleGrid() {
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

export function getActiveModuleConfig() {
  return Object.values(MODULOS_CONFIG).find(modulo => modulo.activeModes.includes(state.mode)) || null;
}

export function shouldShowModeSelector() {
  const perfilAtivo = state.usuario?.perfilAtivo;
  if (!perfilAtivo) return false;
  return getModulosDisponiveis(perfilAtivo).length > 0;
}

export function reorderTopbarByGrid() {
  const topbarNav = document.getElementById('topbar-nav');
  if (!topbarNav) return;
  const modules = getModulesInGridOrder();
  modules.forEach(modulo => {
    const btn = document.getElementById(modulo.topbarButtonId);
    if (btn) topbarNav.appendChild(btn);
  });
}

export function configureTopbarByMode() {
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
  });

  const adminBtn = document.getElementById('nav-admin');
  if (adminBtn) {
    const gruposAd = state.usuario?.grupos_ad || [];
    const isAdmin = gruposAd.some(g => String(g || '').trim().toUpperCase() === 'API_CONECTA_ADMIN');
    adminBtn.classList.toggle('d-none', !isAdmin);
  }
}

