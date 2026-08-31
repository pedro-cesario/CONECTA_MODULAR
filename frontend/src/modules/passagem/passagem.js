import { api } from '../../core/api.js';
import { state, MODULOS_CONFIG, draftHydratingModules, modeTransitionSeq } from '../../core/state.js';
import * as utils from '../../core/utils.js';
import * as ui from '../../core/ui.js';
import * as router from '../../core/router.js';
import * as draft from '../../core/draft.js';
import * as auth from '../../core/auth.js';

export function capturePassagemDraft() {
    const entries = {};
    let hasActualData = false;

    document.querySelectorAll('.intercorrencia-textarea').forEach(textarea => {
      const key = getTextareaKey(textarea);
      if (!key) return;
      if (ui.editorHasContent(textarea)) {
        entries[key] = entries[key] || { text: '', checks: [] };
        entries[key].text = ui.getEditorValue(textarea) || '';
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

export function getSelectedSetoresData() {

    return state.setores.filter(s => state.setoresSelecionados.includes(Number(s.cd_setor_atendimento)));

  }

export function updatePassagemContext() {
    const btnSalvar = document.getElementById('btn-salvar');
    if (document.getElementById('btn-salvar')) {
      if (auth.temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
         document.getElementById('btn-salvar').innerHTML = '<i class="bi bi-check-circle"></i> Salvar / Finalizar Passagem';
      } else {
         document.getElementById('btn-salvar').innerHTML = '<i class="bi bi-check-circle"></i> Finalizar Passagem';
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

export function canAccessPassagem() {
    return auth.perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'passagem');
  }

export async function enterPassagemMode() {
    if (auth.activeProfileChangePromise) {
      await auth.activeProfileChangePromise;
    }

    if (!canAccessPassagem()) {
      ui.showToast('Passagem de Plantão indisponível para o perfil ativo', 'warning');
      router.showModeChooser();
      return;
    }

    renderTurnoOptions();

    const transitionId = router.activateWorkspace('passagem', document.getElementById('workspace-passagem'));
    await loadSetores(transitionId);
    if (ui.isCompactSidebarViewport()) {
      ui.openSidebarOverlay();
    }

  }

export function showPassagemSubMenu() {
    if (!canAccessPassagem()) {
      ui.showToast('Passagem de Plantão indisponível para o perfil ativo', 'warning');
      router.showModeChooser();
      return;
    }
    router.activateWorkspace('passagem-submenu', document.getElementById('passagem-sub-menu'));
    const btnLancar = document.getElementById('btn-passagem-lancar');
    const podeLancar = auth.temPermissaoAtiva('passagem', 'lancar_nova_passagem');
    btnLancar?.classList.toggle('d-none', !podeLancar);
  }

export function renderSetorLivreCard(setor) {

    return `

      <div class="setor-group">

        <div class="setor-group-header"><i class="bi bi-building"></i> ${setor.ds_setor_atendimento}</div>

        <div class="setor-livre-card">

          <div class="setor-livre-header">

            <span class="setor-livre-badge"><i class="bi bi-journal-text"></i> Passagem do setor</span>

            <p>Registre a passagem de plantão do setor mesmo sem pacientes listados.</p>

          </div>

          <div class="intercorrencia-editor-wrap">
            ${ui.buildFormattingToolbar()}
            <div class="paciente-textarea intercorrencia-textarea"
              contenteditable="true" role="textbox" aria-multiline="true"
              data-placeholder="Descreva a passagem de plantão do setor..."
              data-setor="${setor.cd_setor_atendimento}"
              data-setornome="${setor.ds_setor_atendimento}"></div>
          </div>

        </div>

      </div>`;

  }

export async function onSetorChange(transitionId = modeTransitionSeq) {
    let perfilId = state.usuario?.perfilAtivo;

    if (!router.isCurrentWorkspace(transitionId, 'passagem')) return;

    document.getElementById('empty-state')?.classList.remove('d-none');
    document.getElementById('pacientes-list')?.classList.add('d-none');
    document.getElementById('main-footer')?.classList.add('d-none');

    if (!perfilId) {
      state.setoresSelecionados = [];
      state.cdModulo = null;
      document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));
      return;
    }

    const perfilAtualizado = await auth.alterarPerfilSeNecessario(perfilId);
    if (!perfilAtualizado || !router.isCurrentWorkspace(transitionId, 'passagem')) return;

    await loadSetoresInternacao(transitionId);
  }

export async function loadSetoresInternacao(transitionId = modeTransitionSeq) {

    const list = document.getElementById('setores-list');
    if (!list || !router.isCurrentWorkspace(transitionId, 'passagem')) return;

    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando setores...</div>';



    try {

      const result = await api.get('/api/setores-internacao');

      if (!router.isCurrentWorkspace(transitionId, 'passagem')) return;

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

      if (router.isCurrentWorkspace(transitionId, 'passagem')) {
        list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar setores</div>';
      }

    }

  }

export function renderSetoresInternacao(setores) {

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
          if (ui.editorHasContent(ta)) hasUnsaved = true;
        });

        if (hasUnsaved) {
          if (auth.temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
            if (typeof ui.showModal === 'function') {
              await ui.showModal('warning', 'Atenção: Dados Não Salvos', 'Você preencheu informações neste setor. Clique em "Salvar / Finalizar Passagem" e escolha "Salvar e Continuar Passagem" para não perder os dados!');
            }
            const btnSalvar = document.getElementById('btn-salvar');
            if (document.getElementById('btn-salvar')) {
              document.getElementById('btn-salvar').scrollIntoView({ behavior: 'smooth', block: 'center' });
              document.getElementById('btn-salvar').classList.add('btn-save--highlight');
              setTimeout(() => document.getElementById('btn-salvar').classList.remove('btn-save--highlight'), 2400);
            }
            return;
          } else {
            const descartar = await ui.showConfirmModal('Atenção: Dados Não Salvos', 'Você preencheu informações neste setor. Deseja descartar as alterações e trocar de setor?');
            if (!descartar) return;
            state.savedTexts = {};
            draft.clearModuleDraft('passagem');
          }
        }

        list.querySelectorAll('.setor-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        item.querySelector('input[type="radio"]').checked = true;

        updateSetoresSelecionados();
        draft.markModuleDraftDirty('passagem');
        ui.closeSidebarOverlay();
        loadPacientes();

      });

    });

  }

export function highlightSidebarSetor(setorId) {

    document.querySelectorAll('.setor-item').forEach(item => {

      item.classList.toggle('active', parseInt(item.dataset.cd, 10) === setorId);

    });

  }

export async function restorePassagemDraft(draftPayload, transitionId = modeTransitionSeq) {
    if (!draftPayload || !router.isCurrentWorkspace(transitionId, 'passagem')) return;
    draftHydratingModules.add('passagem');

    try {
      const entries = draftPayload.entries && typeof draftPayload.entries === 'object' ? draftPayload.entries : {};

      state.savedTexts = {};
      Object.entries(entries).forEach(([key, entry]) => {
        if (entry?.text) state.savedTexts[key] = String(entry.text);
      });

      const selected = Array.isArray(draftPayload.setoresSelecionados)
        ? draftPayload.setoresSelecionados.map(Number).filter(Number.isInteger)
        : [];

      if (selected.length > 0) {
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

      if (!router.isCurrentWorkspace(transitionId, 'passagem')) return;

      const turno = Number(draftPayload.turno);
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
    } catch (err) {
      console.error('[restorePassagemDraft] Erro ao restaurar dados do rascunho:', err);
    } finally {
      draftHydratingModules.delete('passagem');
      draft.updateTopbarDraftIndicators();
    }
  }

export async function loadSetores(transitionId = modeTransitionSeq) {

    const list = document.getElementById('setores-list');
    if (!list || !router.isCurrentWorkspace(transitionId, 'passagem')) return;
    const passagemDraft = draft.getModuleDraft('passagem');

    list.innerHTML = ui.renderSetoresSkeleton(6);

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

      if (!router.isCurrentWorkspace(transitionId, 'passagem')) return;

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
        auth.renderSetorDropdown();
        renderSetoresInternacao(state.setores);

        if (passagemDraft) {
          try {
            await restorePassagemDraft(passagemDraft, transitionId);
          } catch (restoreErr) {
            console.error('[loadSetores] Erro na hidratação do rascunho:', restoreErr);
          }
        }
      } else {
        list.innerHTML = `<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> ${result.message || 'Erro ao carregar setores'}</div>`;
      }
    } catch (err) {
      console.error('[loadSetores] Erro:', err);
      if (router.isCurrentWorkspace(transitionId, 'passagem')) {
        list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar setores</div>';
      }
    }
  }

export function updateSetoresSelecionados() {

    state.setoresSelecionados = [...document.querySelectorAll('.setor-item.active')]

      .map(el => parseInt(el.dataset.cd, 10));

    if (state.setoresSelecionados.length > 0) {
      state.cdModulo = resolveCdModulo();
    }

    updatePassagemContext();

  }

export function resolveCdModulo() {
  if (state.usuario?.perfilAtivo === 'psicologia') return 4;
  return 1;
}

export async function loadPacientes(transitionId = modeTransitionSeq) {
    if (!Number.isInteger(transitionId)) transitionId = modeTransitionSeq;

    if (state.setoresSelecionados.length === 0) return;

    document.getElementById('empty-state')?.classList.add('d-none');

    const pacListEl = document.getElementById('pacientes-list');
    if (pacListEl) {
      pacListEl.classList.remove('d-none');
      pacListEl.innerHTML = ui.renderPacientesSkeleton(4);
    }




    try {

      const result = await api.post('/api/pacientes', { setores: state.setoresSelecionados });

      if (!router.isCurrentWorkspace(transitionId, 'passagem')) return;

      if (result.success && result.data) {

        state.pacientes = result.data;

        renderPacientes();

        document.getElementById('main-footer').classList.remove('d-none');

        updateFooter();

      } else {

        ui.showToast(result.message || 'Erro ao carregar', 'error');

      }

    } catch (err) {

      ui.showToast('Erro ao carregar pacientes', 'error');

    }

  }

export function renderPacientes() {

    const container = document.getElementById('pacientes-list');

    const emptyState = document.getElementById('empty-state');

    saveTextsBeforeRender();
    updatePassagemContext();



    document.getElementById('pacientes-list').classList.remove('d-none');

    document.getElementById('empty-state').classList.add('d-none');



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

      html += `<div class="setor-group"><div class="setor-group-header"><i class="bi bi-building"></i> ${utils.escapeHtml(group.setor || '-')}</div>`;

      group.pacientes.forEach(p => {

        const initials = utils.getPacienteInitials(p.nome);

        const dtCancelamento = p.dt_cancelamento;

        const setorTexto = dtCancelamento

          ? `Cancelado: ${utils.formatCancelamentoDate(dtCancelamento)}`

          : utils.escapeHtml(p.setor || '-');

        html += `

          <div class="paciente-card">

            <div class="paciente-info">

              <div class="paciente-avatar">${initials}</div>

              <div class="paciente-details">

                <div class="paciente-name">${utils.escapeHtml(p.nome || '-')}</div>
                ${utils.renderNomeCivilPaciente(p)}

                <div class="paciente-meta">

                  <span><i class="bi bi-hash"></i> Atend: ${utils.escapeHtml(p.atendimento)}</span>

                  <span><i class="bi bi-geo-alt"></i> ${setorTexto}</span>

                </div>

              </div>

            </div>

            ${renderCheckboxesIntercorrencia(p.atendimento)}

            <div class="intercorrencia-editor-wrap">
              ${ui.buildFormattingToolbar()}
              <div class="paciente-textarea intercorrencia-textarea"
                contenteditable="true" role="textbox" aria-multiline="true"
                data-placeholder="Descreva a intercorrência..."
                data-atendimento="${utils.escapeHtml(p.atendimento)}"
                data-setor="${utils.escapeHtml(p.cd_setor_atendimento)}"
                data-nome="${utils.escapeHtml(p.nome || '')}"
                data-setornome="${utils.escapeHtml(group.setor || '')}"></div>
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


export function renderLoteChecksNaSidebar() {
  if (!auth.temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
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

export function resetForm() {
  if (state.loteSectors) state.loteSectors.clear();
  if (typeof renderLoteChecksNaSidebar === 'function') renderLoteChecksNaSidebar();

  state.pacientes = [];
  state.turno = null;
  state.savedTexts = {};
  state.cdModulo = resolveCdModulo();

  document.querySelectorAll('input[name="turno"]').forEach(r => r.checked = false);
  document.getElementById('pacientes-list')?.classList.add('d-none');
  const pacList = document.getElementById('pacientes-list');
  if (pacList) pacList.innerHTML = '';
  document.getElementById('empty-state')?.classList.remove('d-none');
  document.getElementById('main-footer')?.classList.add('d-none');
  document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));

  updatePassagemContext();
  updateSetoresSelecionados();
}

export async function loadPassagensAnteriores() {
  const list = document.getElementById('passagem-history-list');
  const detail = document.getElementById('passagem-history-detail');
  if (!list || !detail) return;

  const inputInicio = document.getElementById('passagens-filter-data-inicio');
  const inputFim = document.getElementById('passagens-filter-data-fim');

  if (inputInicio && inputFim && !inputInicio.value && !inputFim.value) {
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 3);

    inputInicio.value = threeDaysAgo.toISOString().split('T')[0];
    inputFim.value = today.toISOString().split('T')[0];
  }

  const setorFilter = document.getElementById('passagens-filter-setor')?.value || '';
  const dtInicio = inputInicio?.value || '';
  const dtFim = inputFim?.value || '';

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
        <strong>${utils.escapeHtml(item.ds_setor || `Setor ${item.cd_setor_atendimento || '-'}`)}</strong>
        <span>Ocorrência #${utils.escapeHtml(item.nr_ocorrencia)}</span>
        <small><span><i class="bi bi-clock"></i> ${utils.escapeHtml(utils.formatPrintReleaseDate(item.dt_lancamento))}</span><span><i class="bi bi-person"></i> ${utils.escapeHtml(item.nm_usuario || '-')}</span></small>
      </button>`).join('');
    const renderDetail = index => {
      const item = passagens[index];
      if (!item) return;
      list.querySelectorAll('.passagem-history-item').forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === index));
      detail.innerHTML = `<header><h3>${utils.escapeHtml(item.ds_setor || `Setor ${item.cd_setor_atendimento || '-'}`)}</h3><div class="passagem-history-meta"><span><i class="bi bi-clock"></i> ${utils.escapeHtml(utils.formatPrintReleaseDate(item.dt_lancamento))}</span><span><i class="bi bi-person-check"></i> ${utils.escapeHtml(item.nm_usuario || '-')}</span><span>Ocorrência #${utils.escapeHtml(item.nr_ocorrencia)}</span></div></header><div class="passagem-history-text">${item.ds_ocorrencia || ''}</div>`;
    };
    list.querySelectorAll('.passagem-history-item').forEach(button => button.addEventListener('click', () => renderDetail(Number(button.dataset.index))));
    renderDetail(0);
  } catch (err) {
    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> Não foi possível carregar as passagens.</div>';
    ui.showToast(err?.message || 'Erro ao carregar passagens anteriores', 'error');
  }
}

export async function populatePassagensFilterSetores() {
  const select = document.getElementById('passagens-filter-setor');
  if (!select || select.options.length > 1) return;

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


export const CHECKBOX_INTERCORRENCIAS = [
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

export const CHECKBOX_INTERCORRENCIAS_MAP = new Map(
  CHECKBOX_INTERCORRENCIAS.map(item => [item.field, item.label])
);

export async function carregarCheckboxesDinamicos() {
  try {
    const res = await api.get('/passagem/checkboxes');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      CHECKBOX_INTERCORRENCIAS.length = 0;
      CHECKBOX_INTERCORRENCIAS_MAP.clear();
      res.data.forEach(item => {
        CHECKBOX_INTERCORRENCIAS.push({
          field: item.chave,
          label: item.label,
          categoria: item.categoria,
          icone: item.icone
        });
        CHECKBOX_INTERCORRENCIAS_MAP.set(item.chave, item.label);
      });
    }
  } catch (err) {
    console.warn('[Passagem] Falha ao carregar checkboxes dinâmicos da API, usando padrão:', err.message);
  }
}

// Inicializa o carregamento dos checkboxes do backend
carregarCheckboxesDinamicos();


export function getTextareaKey(ta) {
  if (ta.dataset.atendimento) return `atendimento_${ta.dataset.atendimento}`;
  if (ta.dataset.setor) return `setor_${ta.dataset.setor}`;
  return null;
}

export function saveTextsBeforeRender() {
  document.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
    const key = getTextareaKey(ta);
    if (key) {
      if (ui.editorHasContent(ta)) {
        state.savedTexts[key] = ui.getEditorValue(ta);
      } else {
        delete state.savedTexts[key];
      }
    }
  });
}

export function restoreTextsAfterRender() {
  document.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
    const key = getTextareaKey(ta);
    if (key && state.savedTexts[key]) {
      ui.setEditorValue(ta, state.savedTexts[key]);
      ta.classList.add('has-text');
    }
  });
}

export function bindTextareaEvents(container) {
  container.querySelectorAll('.intercorrencia-textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      const hasContent = ui.editorHasContent(ta);
      ta.classList.toggle('has-text', hasContent);

      const key = getTextareaKey(ta);
      if (key) {
        if (hasContent) {
          state.savedTexts[key] = ui.getEditorValue(ta);
        } else {
          delete state.savedTexts[key];
        }
      }

      updateFooter();
      draft.markModuleDraftDirty('passagem');
    });

    if (ta.isContentEditable) {
      const wrap = ta.closest('.intercorrencia-editor-wrap');
      const toolbar = wrap && wrap.querySelector('.intercorrencia-toolbar');
      if (toolbar) ui.bindFormattingToolbar(toolbar, ta);
    }
  });
}

export function bindCheckboxEvents(container) {
  container.querySelectorAll('.intercorrencia-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      updateFooter();
      draft.markModuleDraftDirty('passagem');
    });
  });
}

export function renderCheckboxesIntercorrencia(atendimento) {
  const itensAutorizados = CHECKBOX_INTERCORRENCIAS.filter(item => {
    return auth.temPermissaoAtiva('passagem', `campo_${item.field}`) || auth.temPermissaoAtiva('passagem', item.field);
  });

  if (itensAutorizados.length === 0) return '';

  return `<div class="checkboxes-grid">${itensAutorizados
    .map(item => `<label class="checkbox-label"><span>${item.label}</span><input type="checkbox" class="intercorrencia-checkbox" data-field="${item.field}" data-atendimento="${atendimento}"></label>`)
    .join('')}</div>`;
}

export function renderTurnoOptions() {
  const labelDinamico = document.getElementById('turno-label-dinamico');
  const optionsDinamico = document.getElementById('turno-options-dinamico');
  if (!labelDinamico || !optionsDinamico) return;

  const isPeriodo = auth.temPermissaoAtiva('passagem', 'modelo_periodo');
  
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

  // Re-bind change listeners on radio options
  optionsDinamico.querySelectorAll('input[name="turno"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.turno = parseInt(radio.value, 10);
      updateFooter();
      draft.markModuleDraftDirty('passagem');
    });
  });
}

export function updateFooter() {
  const total = state.pacientes ? state.pacientes.length : 0;

  const atendimentosComCheckbox = new Set(
    [...document.querySelectorAll('.intercorrencia-checkbox:checked')]
      .map(cb => cb.dataset.atendimento)
      .filter(Boolean)
  );

  const intercorrencias = [...document.querySelectorAll('.intercorrencia-textarea')]
    .filter(ta => {
      const hasTexto = ui.editorHasContent(ta);
      const hasCheckbox = atendimentosComCheckbox.has(ta.dataset.atendimento);
      return hasTexto || hasCheckbox;
    }).length;

  const pacCount = document.getElementById('pacientes-count');
  if (pacCount) pacCount.textContent = total;

  const interCount = document.getElementById('intercorrencias-count');
  if (interCount) interCount.textContent = intercorrencias;

  const btnSalvar = document.getElementById('btn-salvar');
  if (btnSalvar) btnSalvar.disabled = false;
}

export async function salvarPassagem() {
  const hasTurno = document.querySelector('input[name="turno"]:checked');

  if (!hasTurno) {
    await ui.showModal('error', 'Turno não selecionado', 'Indique o turno atual (Diurno ou Noturno) para finalizar a passagem de plantão.');
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
    ui.showToast('Módulo não definido. Recarregue os setores e tente novamente.', 'warning');
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
    const textoHtml = ui.getEditorHtmlForSave(ta);

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
  const originalHtml = btnSalvar ? btnSalvar.innerHTML : '';
  if (btnSalvar) {
    btnSalvar.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
    btnSalvar.disabled = true;
  }

  try {
    if (auth.temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
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
        const btnOriginalHtml = btnSalvarLocal ? btnSalvarLocal.innerHTML : '';
        if (btnSalvarLocal) {
          btnSalvarLocal.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
          btnSalvarLocal.disabled = true;
        }

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
            
            document.getElementById('pacientes-list')?.classList.add('d-none');
            const pacList = document.getElementById('pacientes-list');
            if (pacList) pacList.innerHTML = '';
            document.getElementById('empty-state')?.classList.remove('d-none');
            document.getElementById('main-footer')?.classList.add('d-none');
            document.querySelectorAll('.setor-item').forEach(el => el.classList.remove('active'));
            
            document.getElementById('sidebar-expand-btn')?.click();
            ui.showToast('Setor salvo no lote. Escolha o próximo setor.', 'success');
          } else {
            throw new Error(result.message || 'Erro ao salvar passagem');
          }
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (btnSalvarLocal) {
            btnSalvarLocal.innerHTML = btnOriginalHtml;
            btnSalvarLocal.disabled = false;
          }
        }
        return; 
      } else if (choice === null) {
        return;
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
      await ui.showModal('success', 'Sucesso!', result.data.inseridos + ' registro(s) salvo(s)');
      draft.clearModuleDraft('passagem');
      resetForm();
    } else {
      await ui.showModal('error', 'Falha ao salvar', result.message || 'Não foi possível salvar.');
    }
  } catch (err) {
    await ui.showModal('error', 'Falha ao salvar', err?.message || 'Erro ao salvar.');
  } finally {
    if (btnSalvar) {
      btnSalvar.innerHTML = originalHtml;
    }
    updateFooter();
  }
}

// Attach Passagem event listeners
document.getElementById('btn-salvar')?.addEventListener('click', salvarPassagem);

document.getElementById('btn-voltar-passagem-principal')?.addEventListener('click', showPassagemSubMenu);
document.getElementById('btn-passagem-voltar-header')?.addEventListener('click', showPassagemSubMenu);
document.getElementById('btn-passagem-voltar-home')?.addEventListener('click', router.showModeChooser);
document.getElementById('btn-passagens-filtrar')?.addEventListener('click', async () => {
  await loadPassagensAnteriores();
});
