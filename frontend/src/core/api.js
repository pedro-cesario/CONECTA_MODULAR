import { state } from './state.js';
import { setLoading, getTodayIsoDate, escapeHtml, renderNomeCivilPaciente, getPacienteInitials, debounce } from './utils.js';
import { showToast, showModal, showConfirmModal } from './ui.js';
import { showScreen, hideAllAppSections, activateWorkspace, isCurrentWorkspace, showModeChooser } from './router.js';
import { normalizeDraftKey, getDraftStorageKey, getDraftDirtyKey, readDraftEnvelope, writeDraftEnvelope, getModuleDraft, setModuleDraft, clearModuleDraft, discardModuleWork, hasModuleDraft, cloneDraftValue, captureModuleDraft, flushModuleDraft, flushPendingDrafts, markModuleDraftDirty, updateTopbarDraftIndicators, initializeDraftSession } from './draft.js';
import { checkSession, loadModulosFromBackend, updateProfileLabels, perfilTemAcessoModulo, trocarPerfil, alterarPerfilSeNecessario, getModulosDisponiveis } from './auth.js';


// Extraído de app.js
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export const api = {
  async request(url, options = {}) {
    const requestId = generateRequestId();
    const headers = {
      'X-Request-Id': requestId,
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const timeoutMs = options.timeout || 25000;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        credentials: 'include'
      });
      clearTimeout(timeoutTimer);

      const responseRequestId = res.headers.get('x-request-id') || requestId;
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = json?.message || `Erro na requisição (${res.status})`;
        const errorObj = {
          message: errorMsg,
          status: res.status,
          requestId: responseRequestId,
          data: json
        };
        throw errorObj;
      }

      if (json && typeof json === 'object') {
        json.requestId = responseRequestId;
      }

      return json;
    } catch (err) {
      clearTimeout(timeoutTimer);
      if (err.name === 'AbortError') {
        throw {
          message: `Tempo limite de resposta (${timeoutMs / 1000}s) excedido. Verifique sua conexão.`,
          status: 408,
          requestId,
          isTimeout: true
        };
      }
      if (err && typeof err === 'object' && !err.requestId) {
        err.requestId = requestId;
      }
      throw err;
    }
  },

  get(url, headers = {}) {
    return this.request(url, { method: 'GET', headers });
  },

  post(url, data, headers = {}) {
    return this.request(url, { method: 'POST', body: data, headers });
  },

  put(url, data, headers = {}) {
    return this.request(url, { method: 'PUT', body: data, headers });
  },

  delete(url, headers = {}) {
    return this.request(url, { method: 'DELETE', headers });
  }
};

