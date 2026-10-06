import { api } from './api.js';
import { state } from './state.js';
import { showToast, showModal, showConfirmModal } from './ui.js';
import { showScreen, hideAllAppSections, activateWorkspace, isCurrentWorkspace, showModeChooser } from './router.js';
import { normalizeDraftKey, getDraftStorageKey, getDraftDirtyKey, readDraftEnvelope, writeDraftEnvelope, getModuleDraft, setModuleDraft, clearModuleDraft, discardModuleWork, hasModuleDraft, cloneDraftValue, captureModuleDraft, flushModuleDraft, flushPendingDrafts, markModuleDraftDirty, updateTopbarDraftIndicators, initializeDraftSession } from './draft.js';
import { checkSession, loadModulosFromBackend, updateProfileLabels, perfilTemAcessoModulo, trocarPerfil, alterarPerfilSeNecessario, getModulosDisponiveis } from './auth.js';
export { getEditorValue, setEditorValue, editorHasContent, getEditorHtmlForSave, buildFormattingToolbar, updateToolbarActiveState, bindFormattingToolbar } from './ui.js';


export function setLoading(btn, loading) {

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

export function getTodayIsoDate() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

export function escapeHtml(text) {

    return String(text || '')

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');

  }

export function renderNomeCivilPaciente(paciente) {
    const nomeCivil = String(paciente?.nome_civil || '').trim();
    return nomeCivil ? `<span class="paciente-nome-civil">${escapeHtml(nomeCivil)}</span>` : '';
  }

export function getPacienteInitials(nome) {
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

export function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

export function formatCancelamentoDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  const dateOnly = String(value).replace(' ', 'T').slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
}

export function formatPrintReleaseDate(value) {
  if (!value) return 'Liberação não informada';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatIsoDatePtBr(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
}

export function addIsoDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonday(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOfWeek);
  return date;
}

export async function loadVersion() {
  try {
    const result = await api.get('/api/version');
    
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Resposta de versão incompatível (tipo inválido)');
    }
    
    if (result.ok !== true) {
      throw new Error('Resposta de versão incompatível (ok !== true)');
    }
    
    if (typeof result.version !== 'string' || result.version.trim() === '') {
      throw new Error('Resposta de versão incompatível (versão ausente)');
    }
    
    if (typeof result.showTestBar !== 'boolean') {
      throw new Error('Resposta de versão incompatível (showTestBar ausente)');
    }

    const version = result.version.trim();

    const el = document.getElementById('app-version-footer');
    const status = document.getElementById('system-status');
    const statusText = document.getElementById('system-status-text');

    if (el) {
      el.textContent = `v${version}`;
    }

    const testBar = document.getElementById('test-environment-bar');
    if (testBar) {
      testBar.classList.toggle('d-none', !result.showTestBar);
      document.documentElement.style.setProperty('--app-environment-height', result.showTestBar ? '25px' : '0px');
    }

    status?.classList.remove('offline');
    if (statusText) statusText.textContent = 'Aplicação disponível';
  } catch (e) {
    document.getElementById('system-status')?.classList.add('offline');
    const statusText = document.getElementById('system-status-text');
    if (statusText) statusText.textContent = 'Serviço temporariamente indisponível';
  }
}

