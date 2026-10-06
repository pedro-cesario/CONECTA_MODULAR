import { api } from './api.js';
import { state } from './state.js';
import { setLoading, getTodayIsoDate, escapeHtml, renderNomeCivilPaciente, getPacienteInitials, debounce } from './utils.js';
import { showScreen, hideAllAppSections, activateWorkspace, isCurrentWorkspace, showModeChooser } from './router.js';
import { normalizeDraftKey, getDraftStorageKey, getDraftDirtyKey, readDraftEnvelope, writeDraftEnvelope, getModuleDraft, setModuleDraft, clearModuleDraft, discardModuleWork, hasModuleDraft, cloneDraftValue, captureModuleDraft, flushModuleDraft, flushPendingDrafts, markModuleDraftDirty, updateTopbarDraftIndicators, initializeDraftSession } from './draft.js';
import { checkSession, loadModulosFromBackend, updateProfileLabels, perfilTemAcessoModulo, trocarPerfil, alterarPerfilSeNecessario, getModulosDisponiveis } from './auth.js';

export { setLoading } from './utils.js';

export function showToast(message, type = 'info') {

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

export function showModal(type, title, message) {

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

export function showConfirmModal(title, message) {
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

export function getEditorValue(el) {
  return el.isContentEditable ? el.innerHTML : el.value;
}

export function setEditorValue(el, val) {
  if (el.isContentEditable) el.innerHTML = val || '';
  else el.value = val || '';
}

export function editorHasContent(el) {
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

export function getEditorHtmlForSave(el) {
  if (!el) return '';
  if (!editorHasContent(el)) return '';
  if (!el.isContentEditable) return el.value.trim();
  const inner = el.innerHTML.trim();
  return `<html tasy="html5"><body>${inner}</body></html>`;
}

export function buildFormattingToolbar() {
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

export function updateToolbarActiveState(toolbar) {
  ['bold', 'italic', 'underline'].forEach(fmt => {
    const btn = toolbar.querySelector(`[data-fmt="${fmt}"]`);
    if (btn) btn.classList.toggle('active', document.queryCommandState(fmt));
  });
}

export function bindFormattingToolbar(toolbar, editor) {
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
      }
      group.querySelector('.fmt-color-picker')?.classList.add('d-none');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

let lastSidebarTrigger = null;

export function isCompactSidebarViewport() {
  return window.innerWidth <= 1366;
}

export function setSidebarButtonState(expanded) {
  const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
  const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
  [sidebarCollapseBtn, sidebarExpandBtn].forEach(button => {
    button?.setAttribute('aria-expanded', String(expanded));
  });

  if (sidebarCollapseBtn) {
    sidebarCollapseBtn.setAttribute('aria-label', expanded ? 'Recolher setores' : 'Expandir setores');
    const icon = sidebarCollapseBtn.querySelector('i');
    if (icon) icon.className = expanded ? 'bi bi-chevron-left' : 'bi bi-chevron-right';
  }
}

export function openSidebarOverlay(trigger = document.activeElement) {
  const sidebarSetores = document.getElementById('sidebar-setores');
  const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
  const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
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

export function closeSidebarOverlay(restoreFocus = true) {
  const sidebarSetores = document.getElementById('sidebar-setores');
  const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
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

export function toggleSidebar() {
  const sidebarSetores = document.getElementById('sidebar-setores');
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

export function syncSidebarForViewport() {
  const sidebarSetores = document.getElementById('sidebar-setores');
  const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
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

export function renderSetoresSkeleton(count = 6) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-setor-item skeleton-shimmer"></div>
  `).join('');
}

export function renderPacientesSkeleton(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar skeleton-shimmer"></div>
        <div style="flex: 1;">
          <div class="skeleton-title skeleton-shimmer"></div>
          <div class="skeleton-subtitle skeleton-shimmer"></div>
        </div>
      </div>
      <div class="skeleton-body skeleton-shimmer"></div>
    </div>
  `).join('');
}

export function renderDashboardSkeleton(count = 8) {
  return Array.from({ length: count }, () => `
    <article class="dashboard-patient-card skeleton-dashboard-card-wrap">
      <div class="dashboard-patient-tags" style="margin-bottom: 0.5rem; display: flex; gap: 0.35rem;">
        <span class="skeleton-shimmer" style="width: 65px; height: 18px; border-radius: 999px; display: inline-block;"></span>
        <span class="skeleton-shimmer" style="width: 50px; height: 18px; border-radius: 999px; display: inline-block;"></span>
      </div>
      <div class="skeleton-shimmer" style="height: 18px; width: 75%; margin-bottom: 0.65rem; border-radius: 4px;"></div>
      <div class="dashboard-patient-meta" style="display: flex; flex-direction: column; gap: 0.35rem;">
        <div class="skeleton-shimmer" style="height: 12px; width: 65%; border-radius: 3px;"></div>
        <div class="skeleton-shimmer" style="height: 12px; width: 55%; border-radius: 3px;"></div>
        <div class="skeleton-shimmer" style="height: 12px; width: 70%; border-radius: 3px;"></div>
      </div>
    </article>
  `).join('');
}


