import * as router from './router.js';
import { api } from './api.js';
import { state, MODULOS_META, MODULOS_CONFIG, MODULOS_DEFAULT } from './state.js';
import { setLoading, getTodayIsoDate, escapeHtml, renderNomeCivilPaciente, getPacienteInitials, debounce } from './utils.js';
import { showToast, showModal, showConfirmModal } from './ui.js';
import { showScreen, hideAllAppSections, activateWorkspace, isCurrentWorkspace, showModeChooser } from './router.js';
import { normalizeDraftKey, getDraftStorageKey, getDraftDirtyKey, readDraftEnvelope, writeDraftEnvelope, getModuleDraft, setModuleDraft, clearModuleDraft, discardModuleWork, hasModuleDraft, cloneDraftValue, captureModuleDraft, flushModuleDraft, flushPendingDrafts, markModuleDraftDirty, updateTopbarDraftIndicators, initializeDraftSession } from './draft.js';



let profileChangeSeq = 0;
let activeProfileChangePromise = null;

export async function checkSession() {
  try {
    const result = await api.get('/api/me');

    if (result.success && result.data && result.data.nm_usuario) {
      sessionStorage.setItem('session_active', '1');
      document.documentElement.classList.add('has-session');
      state.usuario = result.data;

      const userNameEl = document.getElementById('user-name');
      if (userNameEl) userNameEl.textContent = state.usuario.nome || state.usuario.nm_usuario;

      showScreen('app');

      updateProfileLabels();
      initializeDraftSession();

      await loadModulosFromBackend();
      renderSetorDropdown();

      if (router.shouldShowModeSelector()) {
        showModeChooser();
      } else {
        router.moduleHandlers?.passagem?.();
      }
    } else {
      sessionStorage.removeItem('session_active');
      document.documentElement.classList.remove('has-session');
      showScreen('login');
    }
  } catch (err) {
    sessionStorage.removeItem('session_active');
    document.documentElement.classList.remove('has-session');
    showScreen('login');
  }
}

export async function loadModulosFromBackend() {
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
      router.rebuildModuleGrid();
    } catch (_) {
      Object.keys(MODULOS_DEFAULT).forEach(key => {
        if (MODULOS_META[key]) {
          MODULOS_META[key].allowedProfiles = MODULOS_DEFAULT[key].map(String);
        }
      });
      Object.assign(MODULOS_CONFIG, MODULOS_META);
    }
  }

export function updateProfileLabels() {
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

export function perfilTemAcessoModulo(perfilId, moduloId) {
    if (!perfilId || !moduloId) return false;
    const modulo = MODULOS_CONFIG[moduloId];
    if (!modulo || !Array.isArray(modulo.allowedProfiles)) return false;
    return modulo.allowedProfiles.map(String).includes(String(perfilId));
  }

export async function trocarPerfil(perfilId) {
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

export async function alterarPerfilSeNecessario(perfilId) {

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

export function getModulosDisponiveis(perfilId) {
    if (!perfilId) return [];
    return Object.values(MODULOS_CONFIG).filter(m => perfilTemAcessoModulo(perfilId, m.id));
  }

export function temPermissaoAtiva(moduloId, permissao) {
  return Array.isArray(state.usuario?.permissoesAtivas?.[moduloId])
    && state.usuario.permissoesAtivas[moduloId].includes(permissao);
}

export function temAcessoEnfermagem() {
  return Boolean(state.usuario?.acesso_enfermagem);
}

export function temAcessoPsicologia() {
  return Boolean(state.usuario?.acesso_psicologia);
}

export function temMultiplosPerfis() {
  const perfis = Array.isArray(state.usuario?.perfisDisponiveis) ? state.usuario.perfisDisponiveis : [];
  return perfis.length > 1;
}

export function getSetorIdByPerfil(perfilId) {
  return null;
}

export function renderSetorDropdown() {
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
      ${isActive ? '<i class="bi bi-check2 check-icon"></i>' : ''}
    </button>`;
  }).join('');

  menuList.querySelectorAll('.user-profile-menu-item').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      const novoPerfil = button.dataset.perfilId;
      closeUserProfileMenu();
      if (novoPerfil && novoPerfil !== String(state.usuario?.perfilAtivo)) {
        await trocarPerfil(novoPerfil);
      }
    });
  });
}

export function toggleUserProfileMenu() {
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

export function closeUserProfileMenu() {
  const menu = document.getElementById('user-profile-menu');
  const userDisplay = document.getElementById('user-display');
  if (menu) menu.classList.add('d-none');
  if (userDisplay) {
    userDisplay.setAttribute('aria-expanded', 'false');
    userDisplay.classList.remove('active');
  }
}

