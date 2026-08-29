import { api } from '../../core/api.js';
import { state, MODULOS_CONFIG, draftHydratingModules, modeTransitionSeq } from '../../core/state.js';
import * as utils from '../../core/utils.js';
import * as ui from '../../core/ui.js';
import * as router from '../../core/router.js';
import * as draft from '../../core/draft.js';
import * as auth from '../../core/auth.js';
import { showJustificativaModal } from '../livro/livro.js';

export let escalasPsicologiaLiberadas = [];

export function canAccessEscala() {
  return auth.perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'escala');
}

  export function captureEscalaDraft() {
    const pendingCells = {};
    Object.entries(state.escalaSemanalCells || {}).forEach(([key, value]) => {
      if (value?.pendente_publicacao) pendingCells[key] = draft.cloneDraftValue(value, null);
    });
    return {
      month: document.getElementById('escala-mes')?.value || '',
      pendingCells,
      editor: draft.cloneDraftValue(state.escalaEdicao, null)
    };
  }


  export function restoreEscalaDraft(draftPayload) {
    if (!draftPayload) return;
    draftHydratingModules.add('escala');
    try {
      const monthInput = document.getElementById('escala-mes');
      if (monthInput && draftPayload.month) monthInput.value = draftPayload.month;
      state.escalaSemanalCells = {
        ...(state.escalaSemanalCells || {}),
        ...(draft.cloneDraftValue(draftPayload.pendingCells, {}) || {})
      };
      state.escalaEdicao = draft.cloneDraftValue(draftPayload.editor, null);
      renderEscalaSemanal();
      atualizarBotaoPublicarEscala();
    } finally {
      draftHydratingModules.delete('escala');
      draft.updateTopbarDraftIndicators();
    }
  }

  export async function enterEscalaMode() {
    router.activateWorkspace('escala', document.getElementById('workspace-escala'));
    const escalaDraft = draft.getModuleDraft('escala');
    
    // Atualizar UI caso haja ou não permissão de edição
    const btnPublicar = document.getElementById('btn-escala-publicar');
    const btnSalvar = document.getElementById('btn-escala-salvar');
    const observacaoInput = document.getElementById('escala-observacoes');
    const btnAddPsi = document.getElementById('btn-add-psicologo');
    
    // Verifica capability no frontend
    const canEdit = auth.temPermissaoAtiva('escala', 'editar_publicar_escala');
    
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
        dataInput.value = utils.getTodayIsoDate();
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

  export function getHolidays(year) {
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

  export function getFeriado(date) {
    const year = date.getFullYear();
    const formatted = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const holidays = getHolidays(year);
    return holidays[formatted] || null;
  }

  export function getMonday(date) {
    const value = new Date(`${date}T12:00:00`);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  export function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  export function formatShortDate(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  export async function initializeEscalaSemanal() {
    const monthInput = document.getElementById('escala-mes');
    if (!monthInput.value) monthInput.value = utils.getTodayIsoDate().slice(0, 7);
    state.escalaSemanaInicial = getMonday(utils.getTodayIsoDate());
    state.escalaSemanasPassadas = 0;
    state.escalaSemanasVisiveis = 2;
    await loadEscalaSemanal();
  }

  export async function loadEscalaSemanal() {
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
      ui.showToast('Erro ao carregar escalas do período.', 'error');
    }
  }

  export function renderEscalaSemanal() {
    const list = document.getElementById('escala-week-list');
    const query = (document.getElementById('escala-filtro-profissional')?.value || '').trim().toLowerCase();
    const turnoFiltro = document.querySelector('.escala-turno-filter button.active')?.dataset.turno || '';
    const canEdit = auth.temPermissaoAtiva('escala', 'editar_publicar_escala');
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
            return !query || nome.toLowerCase().includes(query) ? `<span class="escala-chip" title="${utils.escapeHtml(nome)}"><i class="bi bi-person"></i><span class="escala-chip-name">${utils.escapeHtml(nome)}</span>${editing ? `<button class="escala-chip-remove" data-cd-pessoa="${cdPessoa}" type="button" aria-label="Remover profissional"><i class="bi bi-x"></i></button>` : ''}</span>` : '';
          }).join('');
          const editControls = editing ? `<div class="escala-cell-editor"><select class="escala-profissional-select" aria-label="Adicionar profissional"><option value="">Selecione...</option>${(state.profissionaisPsicologia || []).filter(p => !profissionais.includes(Number(p.cd_pessoa_fisica))).map(p => { const total = Number(p.plantoes_ultimas_4_semanas || 0); return `<option value="${p.cd_pessoa_fisica}">${utils.escapeHtml(p.nome)} — ${total} ${total === 1 ? 'Plantão' : 'Plantões'}</option>`; }).join('')}</select><button class="escala-cell-save" type="button"><i class="bi bi-check-lg"></i></button><button class="escala-cell-cancel" type="button"><i class="bi bi-x-lg"></i></button></div>` : '';
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
      draft.markModuleDraftDirty('escala');
      renderEscalaSemanal();
    }));
    list.querySelectorAll('.escala-chip-remove').forEach(button => button.addEventListener('click', event => {
      const cdPessoa = Number(event.currentTarget.dataset.cdPessoa);
      state.escalaEdicao.profissionais = state.escalaEdicao.profissionais.filter(id => id !== cdPessoa);
      draft.markModuleDraftDirty('escala');
      renderEscalaSemanal();
    }));
    list.querySelectorAll('.escala-cell-cancel').forEach(button => button.addEventListener('click', () => {
      state.escalaEdicao = null;
      const hasPending = Object.values(state.escalaSemanalCells || {}).some(item => item?.pendente_publicacao);
      if (hasPending) draft.markModuleDraftDirty('escala');
      else draft.clearModuleDraft('escala');
      renderEscalaSemanal();
    }));
    list.querySelectorAll('.escala-cell-save').forEach(button => button.addEventListener('click', event => {
      const cell = event.currentTarget.closest('.escala-cell');
      saveEscalaCell(cell.dataset.date, cell.dataset.turno);
    }));
  }

  export async function editEscalaCell(dataPlantao, turno) {
    try {
      const result = await api.get(`/api/profissionais-psicologia?data_referencia=${encodeURIComponent(dataPlantao)}`);
      if (result.success && Array.isArray(result.data)) state.profissionaisPsicologia = result.data;
    } catch (err) {
      ui.showToast('Não foi possível atualizar a contagem de plantões.', 'warning');
    }
    const escala = state.escalaSemanalCells?.[`${dataPlantao}-${turno}`] || null;
    state.escalaEdicao = {
      key: `${dataPlantao}-${turno}`,
      profissionais: (escala?.profissionais || []).map(item => Number(item.cd_pessoa_fisica))
    };
    renderEscalaSemanal();
  }

  export async function saveEscalaCell(dataPlantao, turno) {
    const escala = state.escalaSemanalCells?.[`${dataPlantao}-${turno}`] || null;
    const profissionais = state.escalaEdicao?.profissionais || [];
    if (profissionais.length === 0) return ui.showToast('Adicione ao menos um profissional.', 'warning');
    const payload = { tipo_escala: 'PSICOLOGIA', cd_modulo: 4, cd_setor_atendimento: 4, data_plantao: dataPlantao, turno, profissionais: profissionais.map(cd_pessoa_fisica => ({ cd_pessoa_fisica })), observacoes: escala?.observacoes || '' };
    state.escalaSemanalCells[`${dataPlantao}-${turno}`] = { ...payload, nr_versao: escala?.nr_versao || null, pendente_publicacao: true };
    state.escalaEdicao = null;
    draft.markModuleDraftDirty('escala');
    renderEscalaSemanal();
    atualizarBotaoPublicarEscala();
    ui.showToast('Alteração incluída. Clique em Salvar/Publicar escala para concluir.', 'success');
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
  export function setEscalaPublicacaoFeedback(message = '', type = '') {
    const feedback = document.getElementById('escala-publicacao-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `escala-publicacao-feedback ${type}`;
  }

  export function atualizarBotaoPublicarEscala() {
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
    if (!await ui.showConfirmModal('Limpar alterações', 'Deseja descartar todas as alterações ainda não publicadas?')) return;
    state.escalaEdicao = null;
    state.escalaSemanalCells = Object.fromEntries(
      Object.entries(state.escalaSemanalCells || {}).filter(([, escala]) => !escala?.pendente_publicacao)
    );
    await loadEscalaSemanal();
    draft.clearModuleDraft('escala');
    atualizarBotaoPublicarEscala();
    setEscalaPublicacaoFeedback('Alterações locais descartadas.', 'info');
  });

  document.getElementById('btn-escala-publicar')?.addEventListener('click', async () => {
    const pendentes = Object.values(state.escalaSemanalCells || {}).filter(escala => escala?.pendente_publicacao);
    if (pendentes.length === 0) {
      setEscalaPublicacaoFeedback('Não há alterações pendentes para publicar.', 'warning');
      ui.showToast('Não há alterações pendentes para publicar.', 'info');
      return;
    }
    setEscalaPublicacaoFeedback(`Publicando ${pendentes.length} alteração(ões)...`, 'info');

    const existentes = pendentes.filter(escala => escala.nr_versao);
    let justificativa = '';
    if (existentes.length > 0) {
      justificativa = await showJustificativaModal();
      if (!justificativa?.trim()) {
        setEscalaPublicacaoFeedback('A justificativa é obrigatória para publicar alterações.', 'warning');
        ui.showToast('A justificativa é obrigatória para editar uma escala publicada.', 'warning');
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
      draft.clearModuleDraft('escala');
      renderEscalaSemanal();
      atualizarBotaoPublicarEscala();
      ui.showToast('Escala publicada com sucesso.', 'success');
      await ui.showModal('success', 'Sucesso!', 'Escala publicada na semana selecionada.');
    } catch (err) {
      ui.showToast(err.message || 'Não foi possível publicar a escala.', 'error');
      await ui.showModal('error', 'Falha ao publicar', err.message || 'Não foi possível publicar a escala.');
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar/Publicar escala';
    }
  });

  export function fecharModalImpressaoEscala() {
    document.getElementById('modal-escala-print-overlay')?.classList.add('d-none');
    document.body.classList.remove('modal-open');
  }

  export async function carregarSemanasLiberadasParaImpressao() {
    const mes = document.getElementById('escala-print-mes')?.value || utils.getTodayIsoDate().slice(0, 7);
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
          <span><strong>${utils.escapeHtml(formatIsoDatePtBr(item.semana_inicio))} a ${utils.escapeHtml(formatIsoDatePtBr(item.semana_fim))}</strong><small> Liberada por ${utils.escapeHtml(item.nm_usuario || '-')} em ${utils.escapeHtml(utils.formatPrintReleaseDate(item.dt_liberacao))}</small></span>
        </label>`).join('');
      if (confirmar) confirmar.disabled = false;
    } catch (err) {
      container.innerHTML = '<div class="loading-placeholder">Não foi possível carregar as semanas liberadas.</div>';
      ui.showToast(err?.message || 'Erro ao buscar escalas liberadas', 'error');
    }
  }

  export function formatIsoDatePtBr(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
  }

  export function formatCancelamentoDate(value) {
    if (!value) return '';
    if (value instanceof Date) {
      return value.toLocaleDateString('pt-BR');
    }
    const dateOnly = String(value).replace(' ', 'T').slice(0, 10);
    return formatIsoDatePtBr(dateOnly);
  }

  export function addIsoDays(value, days) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  export function buildEscalaPsicologiaPrintPage(item) {
    const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const datas = diasSemana.map((_, index) => addIsoDays(item.semana_inicio, index));
    const celula = (data, turno) => {
      const escala = (item.escalas || []).find(row => row.data_plantao === data && row.turno === turno);
      const nomes = (escala?.profissionais || []).map(profissional => profissional.nome).filter(Boolean);
      const observacao = String(escala?.observacoes || '').trim();
      return `<td>${nomes.length ? nomes.map(nome => `<div class="nome">${utils.escapeHtml(nome)}</div>`).join('') : '<span class="vazio">Sem profissional</span>'}${observacao ? `<div class="obs">${utils.escapeHtml(observacao)}</div>` : ''}</td>`;
    };
    return `<div class="week-section"><div class="week-title">Semana de ${utils.escapeHtml(formatIsoDatePtBr(item.semana_inicio))} a ${utils.escapeHtml(formatIsoDatePtBr(item.semana_fim))} <span style="float:right;font-size:9px;font-weight:normal;color:#52627a">Liberada por ${utils.escapeHtml(item.nm_usuario || '-')} em ${utils.escapeHtml(utils.formatPrintReleaseDate(item.dt_liberacao))}</span></div><table><thead><tr><th>Turno</th>${datas.map((data, index) => `<th>${diasSemana[index]}<small>${formatIsoDatePtBr(data)}</small></th>`).join('')}</tr></thead><tbody><tr><th>Manhã</th>${datas.map(data => celula(data, 'M')).join('')}</tr><tr><th>Tarde</th>${datas.map(data => celula(data, 'N')).join('')}</tr></tbody></table></div>`;
  }

  export function imprimirSemanasPsicologia(semanas) {
    const popup = window.open('', '_blank', 'width=1200,height=850');
    if (!popup) return ui.showToast('Libere pop-ups no navegador para imprimir.', 'warning');
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
    if (mes) mes.value = document.getElementById('escala-mes')?.value || utils.getTodayIsoDate().slice(0, 7);
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
    if (!selecionadas.length) return ui.showToast('Selecione ao menos uma semana.', 'warning');
    fecharModalImpressaoEscala();
    imprimirSemanasPsicologia(selecionadas);
  });

  export function renderEscalaPsicologiaList() {
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
        options += `<option value="${p.cd_pessoa_fisica}" data-nome="${utils.escapeHtml(p.nome)}" ${sel}>${utils.escapeHtml(p.nome)}</option>`;
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
      ui.showToast('Selecione a data do plantão', 'warning');
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
        ui.showToast(escala ? 'Escala carregada com sucesso' : 'Nenhuma escala encontrada para este plantão', escala ? 'success' : 'info');
      }
    } catch (err) {
      console.error('Erro ao consultar escala psicologia', err);
      ui.showToast('Erro ao consultar escala', 'error');
    }
  });
  
  document.getElementById('btn-escala-salvar')?.addEventListener('click', async () => {
    const dataInput = document.getElementById('escala-data-plantao');
    const turnoManha = document.querySelector('input[name="escala-turno"][value="M"]');
    
    if (!dataInput || !dataInput.value) {
      ui.showToast('Selecione a data do plantão', 'warning');
      return;
    }
    
    const validos = state.escalaPsicologiaItens.filter(i => !!i.cd_pessoa_fisica);
    if (validos.length === 0 && !document.getElementById('escala-observacoes').value.trim()) {
      ui.showToast('A escala está vazia. Insira profissionais ou uma observação.', 'warning');
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
          ui.showToast('A justificativa é obrigatória para editar uma escala publicada.', 'warning');
          return;
        }
        payload.ds_justificativa = justificativa.trim();
      }
      const btn = document.getElementById('btn-escala-salvar');
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-hourglass-split spin"></i> Salvando...';
      
      const res = await api.put('/api/escala-ativa', payload);
      if (!res.success) {
        ui.showToast('Erro: ' + res.message, 'error');
        return;
      }
      const publicacao = await api.post('/api/escala-psicologia/publicar', payload);
      if (publicacao.success) {
        ui.showToast('Escala salva e publicada com sucesso', 'success');
      } else {
        ui.showToast('Escala salva, mas não foi possível publicar: ' + publicacao.message, 'warning');
      }
    } catch (e) {
      ui.showToast('Erro de comunicação', 'error');
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
    ui.showToast('Formulário limpo', 'success');
  });

  document.getElementById('btn-escala-voltar')?.addEventListener('click', () => {
    router.showModeChooser();
  });
