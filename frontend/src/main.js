/**
 * Conecta Assistencial — Main Entry Point (ES Modules)
 * 100% Modular Native Architecture with Dynamic Lazy Loading
 */

import { api } from './core/api.js';
import { state, MODULOS_CONFIG } from './core/state.js';
import * as utils from './core/utils.js';
import * as ui from './core/ui.js';
import * as auth from './core/auth.js';
import * as router from './core/router.js';
import * as draft from './core/draft.js';
import { loadModule } from './core/moduleLoader.js';

// Expose global bridge for backwards compatibility
window.conectaCore = {
  ...router,
  ...draft,
  ...auth,
  ...ui,
  ...utils,
  loadModule,
  api,
  state,
  MODULOS_CONFIG
};
window.conectaApp = window.conectaCore;

// Global error handlers
window.addEventListener('error', function(e) {
  console.error('[Global Error]', e);
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('[Unhandled Promise Rejection]', e);
});

async function initApp() {
  console.log('[Conecta Assistencial] Inicializando aplicação modular com Lazy Loading...');

  // 1. Sidebar Setup
  const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
  const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarSetores = document.getElementById('sidebar-setores');

  sidebarCollapseBtn?.addEventListener('click', ui.toggleSidebar);
  sidebarExpandBtn?.addEventListener('click', () => ui.openSidebarOverlay(sidebarExpandBtn));
  sidebarBackdrop?.addEventListener('click', () => ui.closeSidebarOverlay());

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebarSetores?.classList.contains('open')) {
      ui.closeSidebarOverlay();
    }
  });

  let sidebarResizeFrame = null;
  window.addEventListener('resize', () => {
    if (sidebarResizeFrame) cancelAnimationFrame(sidebarResizeFrame);
    sidebarResizeFrame = requestAnimationFrame(ui.syncSidebarForViewport);
  });
  ui.syncSidebarForViewport();

  // 2. User Profile Dropdown
  document.getElementById('user-display')?.addEventListener('click', (e) => {
    e.stopPropagation();
    auth.toggleUserProfileMenu();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-dropdown-container')) {
      auth.closeUserProfileMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      auth.closeUserProfileMenu();
    }
  });

  // 3. Navigation & Brand
  document.getElementById('topbar-brand')?.addEventListener('click', () => {
    router.showModeChooser();
  });
  document.getElementById('btn-modo-chooser')?.addEventListener('click', () => {
    router.showModeChooser();
  });
  document.getElementById('btn-profile-voltar')?.addEventListener('click', () => {
    router.showModeChooser();
  });

  // 4. Auth (Login & Logout)
  const formLogin = document.getElementById('form-login');
  const inpUsuario = document.getElementById('inp-usuario');
  const inpSenha = document.getElementById('inp-senha');
  const btnLogin = document.getElementById('btn-login');
  const loginError = document.getElementById('login-error');

  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loginError) loginError.textContent = '';
    const usuario = inpUsuario ? inpUsuario.value.trim() : '';
    const senha = inpSenha ? inpSenha.value : '';

    if (!usuario || !senha) {
      if (loginError) loginError.textContent = 'Informe usuário e senha';
      return;
    }

    if (btnLogin) ui.setLoading(btnLogin, true);

    try {
      const result = await api.post('/api/login', { nm_usuario: usuario, senha });
      if (result.success && result.data) {
        state.usuario = result.data;
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = state.usuario.nome || state.usuario.nm_usuario;
        router.showScreen('app');
        auth.updateProfileLabels();
        draft.initializeDraftSession();
        await auth.loadModulosFromBackend();
        auth.renderSetorDropdown();

        if (router.shouldShowModeSelector()) {
          router.showModeChooser();
        } else {
          const mod = await loadModule('passagem');
          mod.enterPassagemMode();
        }
      } else {
        if (loginError) loginError.textContent = result.message || 'Credenciais inválidas';
      }
    } catch (err) {
      if (loginError) loginError.textContent = err?.message || 'Erro ao comunicar com o servidor';
    } finally {
      if (btnLogin) ui.setLoading(btnLogin, false);
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const ok = await ui.showConfirmModal('Encerrar Sessão', 'Deseja realmente sair do sistema?');
    if (!ok) return;
    draft.flushPendingDrafts();
    try {
      await api.post('/api/logout');
    } catch (_) {}
    state.usuario = null;
    sessionStorage.removeItem('session_active');
    router.showScreen('login');
    if (inpSenha) inpSenha.value = '';
  });

  // 5. Passagem de Plantão Submenu & History Navigation
  document.getElementById('btn-passagem-lancar')?.addEventListener('click', async () => {
    const mod = await loadModule('passagem');
    mod.enterPassagemMode();
  });
  document.getElementById('btn-passagem-anteriores')?.addEventListener('click', async () => {
    const mod = await loadModule('passagem');
    router.activateWorkspace('passagens-anteriores', document.getElementById('workspace-passagens-anteriores'));
    mod.loadPassagensAnteriores();
    mod.populatePassagensFilterSetores();
  });
  document.getElementById('btn-passagens-voltar')?.addEventListener('click', async () => {
    const mod = await loadModule('passagem');
    mod.showPassagemSubMenu();
  });
  document.getElementById('btn-passagens-filter-buscar')?.addEventListener('click', async () => {
    const mod = await loadModule('passagem');
    mod.loadPassagensAnteriores();
  });

  // 6. Livro Administrativo Submenu & Print Navigation
  document.getElementById('btn-livro-lancar')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.enterLivroMode();
  });
  document.getElementById('btn-livro-imprimir')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    router.activateWorkspace('print', document.getElementById('workspace-print'));
    const dataInput = document.getElementById('print-data-plantao');
    if (dataInput) dataInput.value = utils.getTodayIsoDate();
    const turnoSelect = document.getElementById('print-turno');
    const setorSelect = document.getElementById('print-setor');
    if (turnoSelect) turnoSelect.value = '';
    if (setorSelect) setorSelect.innerHTML = '<option value="">Todos os setores</option>';
    state.printHtmlBody = null;
    state.printEscalasAll = [];
    state.printEscalasFiltradas = [];
    setTimeout(() => mod.buscarEscalasLiberadas(), 100);
  });
  document.getElementById('btn-livro-voltar')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.showLivroSubMenu();
  });
  document.getElementById('btn-print-voltar')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.showLivroSubMenu();
  });
  document.getElementById('btn-print-imprimir')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.imprimirTodasEscalas();
  });
  document.getElementById('btn-print-buscar')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.buscarEscalasLiberadas();
  });
  document.getElementById('print-setor')?.addEventListener('change', async () => {
    const mod = await loadModule('livro');
    mod.aplicarFiltroSetorImpressao();
  });

  // 7. Dashboard PA & Internacao Navigation
  document.getElementById('btn-pa-voltar')?.addEventListener('click', () => {
    router.showModeChooser();
  });
  document.getElementById('btn-dashboard-internacao-voltar')?.addEventListener('click', () => {
    router.showModeChooser();
  });
  document.getElementById('btn-dashboard-voltar')?.addEventListener('click', () => {
    router.showModeChooser();
  });

  // 8. Grid Buttons Direct Handlers (Lazy Loaded)
  document.getElementById('btn-abrir-passagem')?.addEventListener('click', async () => {
    const mod = await loadModule('passagem');
    mod.enterPassagemMode();
  });
  document.getElementById('btn-abrir-dashboard')?.addEventListener('click', async () => {
    const mod = await loadModule('dashboard');
    mod.enterDashboardMode();
  });
  document.getElementById('btn-abrir-livro')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.showLivroSubMenu();
  });
  document.getElementById('btn-abrir-escala')?.addEventListener('click', async () => {
    const mod = await loadModule('escala');
    mod.enterEscalaMode();
  });
  document.getElementById('btn-abrir-dashboard-internacao')?.addEventListener('click', async () => {
    const mod = await loadModule('dashboard');
    mod.enterDashboardInternacaoMode();
  });
  document.getElementById('btn-abrir-registros')?.addEventListener('click', async () => {
    const mod = await loadModule('registros');
    mod.showRegistrosMenu();
  });
  document.getElementById('btn-abrir-auditorias')?.addEventListener('click', async () => {
    const mod = await loadModule('auditorias');
    mod.showAuditorias();
  });

  // 9. Topbar Buttons Direct Handlers (Lazy Loaded)
  document.getElementById('nav-passagem')?.addEventListener('click', async () => {
    const mod = await loadModule('passagem');
    mod.showPassagemSubMenu();
  });
  document.getElementById('nav-dashboard')?.addEventListener('click', async () => {
    const mod = await loadModule('dashboard');
    mod.enterDashboardMode();
  });
  document.getElementById('nav-livro')?.addEventListener('click', async () => {
    const mod = await loadModule('livro');
    mod.showLivroSubMenu();
  });
  document.getElementById('nav-escala')?.addEventListener('click', async () => {
    const mod = await loadModule('escala');
    mod.enterEscalaMode();
  });
  document.getElementById('nav-dashboard-pa')?.addEventListener('click', async () => {
    const mod = await loadModule('dashboard');
    mod.enterDashboardInternacaoMode();
  });
  document.getElementById('nav-registros')?.addEventListener('click', async () => {
    const mod = await loadModule('registros');
    mod.showRegistrosMenu();
  });
  document.getElementById('nav-auditorias')?.addEventListener('click', async () => {
    const mod = await loadModule('auditorias');
    mod.showAuditorias();
  });
  document.getElementById('nav-admin')?.addEventListener('click', () => { window.location.href = '/admin'; });

  // 10. Lifecycle Draft Flushing
  window.addEventListener('beforeunload', () => {
    draft.flushPendingDrafts();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      draft.flushPendingDrafts();
    }
  });

  // 11. Startup Ping & Session Check
  await utils.loadVersion();
  await auth.checkSession();
  window.dispatchEvent(new Event('conectaCore:ready'));
  console.log('[Conecta Assistencial] Sistema carregado e pronto com Lazy Loading!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
