/**
 * Conecta Assistencial — Módulo: Painel de Senhas (Monitor de TV)
 * Focado em abrir a tela do monitor da TV associado a esta máquina através
 * da configuração de Painéis de TV Cadastrados no Admin.
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import * as ui from '../../core/ui.js';
import { escapeHtml } from '../../core/utils.js';

let painelSenhasState = {
  nmMaquina: '',
  painelAtivo: null,
  paineisDisponiveis: []
};

export async function enterPainelSenhasMode() {
  const ws = document.getElementById('workspace-painel-senhas');
  const appContainers = document.querySelectorAll('#screen-app > section, #screen-app > .app-container');
  appContainers.forEach(el => el.classList.add('d-none'));
  ws?.classList.remove('d-none');
  state.mode = 'painel_senhas';

  if (window.conectaCore?.configureTopbarByMode) {
    window.conectaCore.configureTopbarByMode();
  }

  window.conectaCore = window.conectaCore || {};
  window.conectaCore.abrirMonitorTv = abrirMonitorTv;
  window.conectaCore.toggleMonitorFullscreen = toggleMonitorFullscreen;
  window.conectaCore.recarregarMonitorTv = recarregarMonitorTv;
  window.conectaCore.carregarMonitorTv = () => carregarMonitorTv(true);

  await carregarMonitorTv(false);
}

export async function carregarMonitorTv(forceReload = false) {
  const loadingEl = document.getElementById('psenhas-loading');
  const containerTv = document.getElementById('psenhas-tv-container');
  const emptyEl = document.getElementById('psenhas-empty-state');
  const frameEl = document.getElementById('psenhas-tv-frame');
  const tituloEl = document.getElementById('psenhas-tv-title');
  const subtituloEl = document.getElementById('psenhas-tv-subtitle');
  const btnNovaAba = document.getElementById('btn-psenhas-nova-aba');

  // Se o iframe já estiver carregado com sucesso e não for recarga forçada, preserva o estado
  if (!forceReload && frameEl && frameEl.getAttribute('src') && containerTv && !containerTv.classList.contains('d-none')) {
    return;
  }

  if (loadingEl) loadingEl.classList.remove('d-none');
  if (containerTv) containerTv.classList.add('d-none');
  if (emptyEl) emptyEl.classList.add('d-none');

  try {
    const maquinaSalva = localStorage.getItem('conecta_ds_maquina');
    const query = maquinaSalva ? `?maquina=${encodeURIComponent(maquinaSalva)}` : '';
    const res = await api.get(`/api/painel/minha-tv${query}`);

    if (loadingEl) loadingEl.classList.add('d-none');

    if (res && res.success && res.data) {
      const { nm_maquina, painel, url, paineisDisponiveis } = res.data;
      painelSenhasState.nmMaquina = nm_maquina;
      painelSenhasState.paineisDisponiveis = paineisDisponiveis || [];
      painelSenhasState.painelAtivo = painel;

      if (painel) {
        // Máquina vinculada a um painel de TV!
        if (tituloEl) tituloEl.textContent = painel.nome || 'Painel Conecta TV';
        if (subtituloEl) subtituloEl.innerHTML = `<i class="bi bi-display text-primary me-1"></i> Monitor configurado para <strong>${escapeHtml(nm_maquina)}</strong>`;
        const targetUrl = url || `/painel.html?painel=${encodeURIComponent(painel.id)}`;
        if (btnNovaAba) btnNovaAba.href = targetUrl;

        if (frameEl) {
          if (forceReload || !frameEl.getAttribute('src') || !frameEl.src.includes(targetUrl)) {
            frameEl.src = targetUrl;
          }
        }
        if (containerTv) containerTv.classList.remove('d-none');
      } else {
        // Nenhuma máquina vinculada a este painel nas configurações
        renderizarSelecaoManual(nm_maquina, paineisDisponiveis);
        if (emptyEl) emptyEl.classList.remove('d-none');
      }
    } else {
      if (emptyEl) emptyEl.classList.remove('d-none');
    }
  } catch (err) {
    console.error('[Painel Senhas] Erro ao carregar monitor:', err);
    if (loadingEl) loadingEl.classList.add('d-none');
    if (emptyEl) emptyEl.classList.remove('d-none');
  }
}

function renderizarSelecaoManual(nmMaquina, paineis) {
  const nomeMaquinaEl = document.getElementById('psenhas-empty-maquina-nome');
  const botoesContainer = document.getElementById('psenhas-empty-botoes');

  if (nomeMaquinaEl) {
    nomeMaquinaEl.textContent = nmMaquina || 'Não identificada';
  }

  if (botoesContainer) {
    if (!paineis || paineis.length === 0) {
      botoesContainer.innerHTML = `<div class="text-muted">Nenhum Painel de TV cadastrado no sistema.</div>`;
      return;
    }

    botoesContainer.innerHTML = paineis.map(p => `
      <button class="btn btn-outline-primary btn-lg fw-bold d-flex align-items-center gap-2 px-4 py-3 shadow-sm" type="button" onclick="window.conectaCore.abrirMonitorTv('${escapeHtml(p.id)}')">
        <i class="bi bi-tv fs-3"></i>
        <div class="text-start">
          <div class="fw-bold fs-6">${escapeHtml(p.nome)}</div>
          <small class="text-muted fw-normal">${escapeHtml(p.descricao || 'Painel de Senhas')}</small>
        </div>
      </button>
    `).join('');
  }
}

export function abrirMonitorTv(painelId) {
  const containerTv = document.getElementById('psenhas-tv-container');
  const emptyEl = document.getElementById('psenhas-empty-state');
  const frameEl = document.getElementById('psenhas-tv-frame');
  const tituloEl = document.getElementById('psenhas-tv-title');
  const subtituloEl = document.getElementById('psenhas-tv-subtitle');
  const btnNovaAba = document.getElementById('btn-psenhas-nova-aba');

  const p = painelSenhasState.paineisDisponiveis.find(x => x.id === painelId);
  const nome = p ? p.nome : painelId;
  const url = `/painel.html?painel=${encodeURIComponent(painelId)}`;

  if (tituloEl) tituloEl.textContent = nome;
  if (subtituloEl) subtituloEl.innerHTML = `<i class="bi bi-tv text-primary me-1"></i> Exibindo monitor <strong>${escapeHtml(nome)}</strong>`;
  if (btnNovaAba) btnNovaAba.href = url;

  if (frameEl) {
    frameEl.src = url;
  }

  if (emptyEl) emptyEl.classList.add('d-none');
  if (containerTv) containerTv.classList.remove('d-none');
}

export function toggleMonitorFullscreen() {
  const frameEl = document.getElementById('psenhas-tv-frame');
  if (!frameEl) return;

  if (!document.fullscreenElement) {
    if (frameEl.requestFullscreen) {
      frameEl.requestFullscreen();
    } else if (frameEl.webkitRequestFullscreen) {
      frameEl.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

export function recarregarMonitorTv() {
  const frameEl = document.getElementById('psenhas-tv-frame');
  if (frameEl && frameEl.src) {
    frameEl.src = frameEl.src;
  } else {
    carregarMonitorTv(true);
  }
}
