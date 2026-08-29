import { api } from '../../core/api.js';
import { state, MODULOS_CONFIG, modeTransitionSeq } from '../../core/state.js';
import * as utils from '../../core/utils.js';
import * as ui from '../../core/ui.js';
import * as router from '../../core/router.js';
import * as draft from '../../core/draft.js';
import * as auth from '../../core/auth.js';

export function canAccessDashboard() {
  return auth.perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'dashboard');
}

export function canAccessDashboardInternacao() {
  return auth.perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'dashboard_pa');
}

export const DASHBOARD_ETIQUETAS = [
  { key: 'medicacao_agora', label: 'Prescrição de Agora', color: 'red' },
  { key: 'medicacao_suspensa', label: 'Medicação Suspensa', color: 'orange' },
  { key: 'material_agora', label: 'Material de Agora', color: 'orange' },
  { key: 'checagem_pendente', label: 'Checagem Pendente', color: 'yellow' },
  { key: 'contencao_sn', label: 'Contenção SN', color: 'blue' },
  { key: 'alta_medica_programada', label: 'Alta Médica Liberada', color: 'green' },
  { key: 'sem_alertas', label: 'Sem alertas', color: 'neutral' }
];

export const DASHBOARD_ETIQUETAS_MAP = new Map(
  DASHBOARD_ETIQUETAS.map(item => [item.key, item])
);

export const DASHBOARD_PA_ETIQUETAS = [
  { key: 'particulares_alta', label: 'Particulares com Alta', color: 'orange', icon: 'bi-person-badge' },
  { key: 'alta_medica', label: 'Alta Médica', color: 'green', icon: 'bi-file-earmark-medical' },
  { key: 'sala_observacao', label: 'Sala de Observação', color: 'blue', icon: 'bi-eye' },
  { key: 'indicacao_internacao', label: 'Indicação de Internação', color: 'red', icon: 'bi-hospital' },
  { key: 'decididos', label: 'Decididos', color: 'neutral', icon: 'bi-check2-all' }
];

export const DASHBOARD_PA_ETIQUETAS_MAP = new Map(
  DASHBOARD_PA_ETIQUETAS.map(item => [item.key, item])
);

export const DASHBOARD_REFRESH_MS = 30000;
export const DASHBOARD_PA_REFRESH_MS = 30000;

  export function getDashboardLocalTurno(date = new Date()) {

    const hour = date.getHours();

    return hour >= 7 && hour < 19 ? 'Diurno' : 'Noturno';

  }

  export function formatDashboardDate(date = new Date()) {

    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace('.', '');

  }

  export function updateDashboardClock(turno) {

    const now = new Date();

    const timeEl = document.getElementById('dashboard-clock-time');

    const dateEl = document.getElementById('dashboard-clock-date');

    const turnoEl = document.getElementById('dashboard-turno-label');

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    if (dateEl) {
      dateEl.textContent = formatDashboardDate(now);
    }

    if (turnoEl) {
      turnoEl.textContent = turno?.descricao || getDashboardLocalTurno(now);
    }

  }

  export function startDashboardClock(turno) {

    if (state.dashboardClockTimer) {
      clearInterval(state.dashboardClockTimer);
    }

    updateDashboardClock(turno);

    state.dashboardClockTimer = setInterval(() => updateDashboardClock(turno), 1000);

  }

export function stopDashboardRefresh() {

    if (state.dashboardTimer) {
      clearInterval(state.dashboardTimer);
      state.dashboardTimer = null;
    }

    if (state.dashboardClockTimer) {
      clearInterval(state.dashboardClockTimer);
      state.dashboardClockTimer = null;
    }

  }

  export function stopDashboardPARefresh() {

    if (state.dashboardPATimer) {
      clearInterval(state.dashboardPATimer);
      state.dashboardPATimer = null;
    }

    if (state.dashboardPAClockTimer) {
      clearInterval(state.dashboardPAClockTimer);
      state.dashboardPAClockTimer = null;
    }

  }

  export function startDashboardRefresh() {

    if (state.dashboardTimer) {
      clearInterval(state.dashboardTimer);
    }

    if (!state.dashboardSetorSelecionado) {
      state.dashboardTimer = null;
      return;
    }

    state.dashboardTimer = setInterval(() => {
      loadDashboardPacientes(false);
    }, DASHBOARD_REFRESH_MS);

  }

  export function setDashboardFeedback(message, icon = 'bi-info-circle', type = 'info') {

    const feedback = document.getElementById('dashboard-feedback');

    if (!feedback) return;

    feedback.className = `dashboard-feedback dashboard-feedback-${type}`;

    feedback.innerHTML = `<i class="bi ${icon}"></i><span>${utils.escapeHtml(message)}</span>`;

    feedback.classList.remove('d-none');

  }

  export function hideDashboardFeedback() {

    document.getElementById('dashboard-feedback')?.classList.add('d-none');

  }

  export function buildDashboardResumo(pacientes = []) {
    const etiquetasEmUso = getDashboardEtiquetasEmUso(pacientes);
    const etiquetas = DASHBOARD_ETIQUETAS
      .map(item => ({
        ...item,
        total: etiquetasEmUso.get(item.key) || 0
      }))
      .filter(item => item.total > 0);

    return {
      total: pacientes.length,
      etiquetas
    };
  }

  export function updateDashboardStats(resumo = {}) {
    const statsContainer = document.getElementById('dashboard-stats-cards');
    if (!statsContainer) return;

    if (!state.dashboardSetorSelecionado) {
      statsContainer.innerHTML = '';
      return;
    }

    const total = Number(resumo.total) || 0;
    const etiquetas = Array.isArray(resumo.etiquetas) ? resumo.etiquetas : [];
    const isSemFiltro = state.dashboardFiltroEtiquetas.size === 0;

    const cards = [
      {
        key: 'all',
        label: 'Total Pacientes',
        total,
        color: 'primary',
        active: isSemFiltro
      },
      ...etiquetas.map(item => ({
        key: item.key,
        label: item.label,
        total: item.total,
        color: item.color,
        active: state.dashboardFiltroEtiquetas.has(item.key)
      }))
    ];

    statsContainer.innerHTML = cards.map(card => `
      <button class="dashboard-stat dashboard-stat-${card.color}${card.active ? ' active' : ''}" type="button" data-tag="${utils.escapeHtml(card.key)}">
        <span>${utils.escapeHtml(card.label)}</span>
        <strong>${utils.escapeHtml(card.total)}</strong>
      </button>
    `).join('');
  }

  export function updateDashboardLastUpdate(value) {

    const el = document.getElementById('dashboard-last-update');

    if (!el) return;

    if (!value) {
      el.textContent = 'Aguardando setor...';
      return;
    }

    const date = new Date(value);

    el.textContent = `Atualizado: ${date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;

  }

  export function renderDashboardSetorSelect() {

    if (!document.getElementById('dashboard-setor')) return;

    if (!state.dashboardSetores.length) {
      document.getElementById('dashboard-setor').innerHTML = '<option value="">Nenhum setor disponível</option>';
      document.getElementById('dashboard-setor').disabled = true;
      return;
    }

    document.getElementById('dashboard-setor').innerHTML = '<option value="">Selecione o setor...</option>';

    state.dashboardSetores.forEach(setor => {
      const option = document.createElement('option');
      option.value = String(setor.cd_setor_atendimento);
      option.textContent = setor.ds_setor_atendimento;
      document.getElementById('dashboard-setor').appendChild(option);
    });

    document.getElementById('dashboard-setor').disabled = false;

    if (state.dashboardSetorSelecionado) {
      document.getElementById('dashboard-setor').value = String(state.dashboardSetorSelecionado);
    }

  }

  export async function loadDashboardSetores(transitionId = modeTransitionSeq) {

    if (!document.getElementById('dashboard-setor')) return;

    document.getElementById('dashboard-setor').disabled = true;

    setDashboardFeedback('Carregando setores...', 'bi-arrow-repeat spin', 'loading');

    try {
      const result = await api.get('/api/setores-internacao?modulo=dashboard');

      if (!router.isCurrentWorkspace(transitionId, 'dashboard')) return;

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar setores');
      }

      const previousSetor = Number(state.dashboardSetorSelecionado);
      state.dashboardSetores = Array.isArray(result.data) ? result.data : [];

      const hasPrevious = state.dashboardSetores.some(
        setor => Number(setor.cd_setor_atendimento) === previousSetor
      );

      if (state.dashboardSetores.length === 1) {
        state.dashboardSetorSelecionado = Number(state.dashboardSetores[0].cd_setor_atendimento);
      } else if (!hasPrevious) {
        state.dashboardSetorSelecionado = null;
      }

      renderDashboardSetorSelect();

      if (state.dashboardSetorSelecionado) {
        await loadDashboardPacientes(true, transitionId);
      } else {
        state.dashboardPacientes = [];
        state.dashboardFiltroEtiquetas = new Set();
        state.dashboardResumo = buildDashboardResumo([]);
        document.getElementById('dashboard-pacientes-grid').innerHTML = '';
        updateDashboardStats(state.dashboardResumo);
        updateDashboardLastUpdate(null);
        setDashboardFeedback('Selecione um setor para visualizar os pacientes.', 'bi-building', 'info');
      }
    } catch (err) {
      if (!router.isCurrentWorkspace(transitionId, 'dashboard')) return;
      state.dashboardSetores = [];
      state.dashboardPacientes = [];
      state.dashboardFiltroEtiquetas = new Set();
      state.dashboardResumo = buildDashboardResumo([]);
      renderDashboardSetorSelect();
      updateDashboardStats(state.dashboardResumo);
      setDashboardFeedback(err.message || 'Erro ao carregar setores', 'bi-exclamation-triangle', 'error');
    }

}

  export function getDashboardStatusFlags(paciente = {}) {
    const medicacaoSuspensa = Number(paciente.medicacao_suspensa) > 0;
    const medicacaoAgora = Number(paciente.medicacao_agora) > 0;

    return {
      medicacao_agora: medicacaoAgora,
      medicacao_suspensa: medicacaoSuspensa,
      material_agora: Number(paciente.material_agora) > 0,
      checagem_pendente: Number(paciente.checagem_pendente) > 0,
      contencao_sn: Number(paciente.contencao_sn) > 0,
      alta_medica_programada: Number(paciente.alta_medica_programada) > 0
    };
  }

  export function getDashboardTagKeys(status = {}) {
    const tags = [];
    if (status.medicacao_agora) tags.push('medicacao_agora');
    if (status.medicacao_suspensa) tags.push('medicacao_suspensa');
    if (status.material_agora) tags.push('material_agora');
    if (status.checagem_pendente) tags.push('checagem_pendente');
    if (status.contencao_sn) tags.push('contencao_sn');
    if (status.alta_medica_programada) tags.push('alta_medica_programada');
    return tags.length ? tags : ['sem_alertas'];
  }

  export function getDashboardEtiquetasEmUso(pacientes = []) {
    const contador = new Map();
    pacientes.forEach(paciente => {
      const tags = getDashboardTagKeys(getDashboardStatusFlags(paciente));
      tags.forEach(tag => {
        contador.set(tag, (contador.get(tag) || 0) + 1);
      });
    });
    return contador;
  }

  export function syncDashboardTagFilters() {
    const emUso = getDashboardEtiquetasEmUso(state.dashboardPacientes);
    state.dashboardFiltroEtiquetas.forEach(tag => {
      if (!emUso.has(tag)) {
        state.dashboardFiltroEtiquetas.delete(tag);
      }
    });
  }

  export function getDashboardPacientesFiltrados() {
    if (!state.dashboardFiltroEtiquetas.size) {
      return state.dashboardPacientes;
    }

    return state.dashboardPacientes.filter(paciente => {
      const tagsPaciente = getDashboardTagKeys(getDashboardStatusFlags(paciente));
      return tagsPaciente.some(tag => state.dashboardFiltroEtiquetas.has(tag));
    });
  }

  export function renderDashboardBadges(paciente = {}, status = {}) {
    const badges = [];
    const prescricoesAgora = Array.isArray(paciente.prescricoes_agora)
      ? paciente.prescricoes_agora.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    
    if (status.medicacao_agora) {
      badges.push({
        color: 'red',
        label: 'Prescrição de Agora',
        tooltip: prescricoesAgora.length
          ? `Prescrições de Agora: ${prescricoesAgora.join(' | ')}`
          : ''
      });
    }
    if (status.medicacao_suspensa) {
      badges.push({ color: 'orange', label: 'Medicação Suspensa' });
    }
    if (status.material_agora) {
      badges.push({ color: 'orange', label: 'Material de Agora' });
    }
    if (status.checagem_pendente) {
      badges.push({ color: 'yellow', label: 'Checagem Pendente' });
    }
    if (status.contencao_sn) {
      badges.push({ color: 'blue', label: 'Contenção SN' });
    }
    if (status.alta_medica_programada) {
      badges.push({ color: 'green', label: 'Alta Médica Liberada' });
    }

    if (!badges.length) {
      return '<span class="dashboard-badge dashboard-badge-neutral">Sem alertas</span>';
    }

    return badges
      .map(b => {
        const titleAttr = b.tooltip ? ` title="${utils.escapeHtml(b.tooltip)}"` : '';
        return `<span class="dashboard-badge dashboard-badge-${b.color}"${titleAttr}>${utils.escapeHtml(b.label)}</span>`;
      })
      .join('');
  }

  export function renderDashboardPacientes() {

    const grid = document.getElementById('dashboard-pacientes-grid');

    if (!grid) return;

    const pacientesFiltrados = getDashboardPacientesFiltrados();

    if (!state.dashboardPacientes.length) {
      grid.innerHTML = '';
      setDashboardFeedback('Nenhum paciente encontrado para o setor selecionado.', 'bi-people', 'info');
      return;
    }

    if (!pacientesFiltrados.length) {
      grid.innerHTML = '';
      setDashboardFeedback('Nenhum paciente corresponde ao filtro de etiquetas.', 'bi-funnel', 'info');
      return;
    }

    hideDashboardFeedback();

    grid.innerHTML = pacientesFiltrados.map(paciente => {
      const status = getDashboardStatusFlags(paciente);
      const temMedicacaoAgora = status.medicacao_agora;
      const prioridadeClass = temMedicacaoAgora ? ' dashboard-patient-priority' : '';
      const nrAtendimento = paciente.nr_atendimento || '-';
      const cdUnidadeRaw = paciente.cd_unidade ?? paciente.CD_UNIDADE ?? paciente.unidade;
      const cdUnidade = String(cdUnidadeRaw ?? '').trim() || '-';
      const classificAtendRaw = paciente.classific_atend ?? paciente.CLASSIFIC_ATEND;
      const classificAtend = String(classificAtendRaw ?? '').trim() || '-';
      
      const newsPontuacao = paciente.news_pontuacao;
      const newsResultado = paciente.news_resultado;
      let newsHtml = '';
      if (newsPontuacao !== null && newsPontuacao !== undefined) {
        const resultadoUpper = (newsResultado || '').toUpperCase().trim();
        const newsClass = resultadoUpper === 'ALTO' ? 'news-alto' : (resultadoUpper === 'MÉDIO' || resultadoUpper === 'MEDIO' ? 'news-medio' : 'news-baixo');
        newsHtml = `<span class="dashboard-patient-news ${newsClass}"><i class="bi bi-activity"></i> NEWS: ${utils.escapeHtml(String(newsPontuacao))} - ${utils.escapeHtml(newsResultado || '-')}</span>`;
      }

      return `
        <article class="dashboard-patient-card${prioridadeClass}" data-atendimento="${utils.escapeHtml(String(nrAtendimento))}">
          <div class="dashboard-patient-tags">
            ${renderDashboardBadges(paciente, status)}
          </div>
          <h3>${utils.escapeHtml(paciente.nome || '-')}</h3>
          ${utils.renderNomeCivilPaciente(paciente)}
          <div class="dashboard-patient-meta">
            <span><i class="bi bi-hash"></i> Atendimento: ${utils.escapeHtml(nrAtendimento)}</span>
            <span><i class="bi bi-diagram-3"></i> Unidade: ${utils.escapeHtml(cdUnidade)}</span>
            <span><i class="bi bi-person-vcard"></i> Classificação: ${utils.escapeHtml(classificAtend)}</span>
            ${newsHtml}
          </div>
        </article>`;
    }).join('');

  }

  export async function loadDashboardPacientes(showLoading = true, transitionId = modeTransitionSeq) {

    if (!router.isCurrentWorkspace(transitionId, 'dashboard')) return;

    if (!state.dashboardSetorSelecionado) {
      setDashboardFeedback('Selecione um setor para visualizar os pacientes.', 'bi-building', 'info');
      return;
    }

    const refreshBtn = document.getElementById('btn-dashboard-refresh');

    if (showLoading) {
      setDashboardFeedback('Buscando pacientes...', 'bi-arrow-repeat spin', 'loading');
      const gridEl = document.getElementById('dashboard-pacientes-grid');
      if (gridEl) gridEl.innerHTML = ui.renderDashboardSkeleton(6);
    }

    refreshBtn?.querySelector('i')?.classList.add('spin');

    try {
      const result = await api.post('/api/dashboard/pacientes-setor/' + encodeURIComponent(String(state.dashboardSetorSelecionado)), {});

      if (!router.isCurrentWorkspace(transitionId, 'dashboard')) return;

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar pacientes');
      }

      const pacientes = Array.isArray(result.data) ? result.data : [];
      state.dashboardPacientes = pacientes;
      syncDashboardTagFilters();
      state.dashboardResumo = buildDashboardResumo(pacientes);
      updateDashboardStats(state.dashboardResumo);
      updateDashboardLastUpdate(new Date().toISOString());
      startDashboardClock();
      renderDashboardPacientes();
    } catch (err) {
      if (!router.isCurrentWorkspace(transitionId, 'dashboard')) return;
      setDashboardFeedback(err.message || 'Erro ao carregar pacientes', 'bi-exclamation-triangle', 'error');
    } finally {
      if (router.isCurrentWorkspace(transitionId, 'dashboard')) {
        refreshBtn?.querySelector('i')?.classList.remove('spin');
      }
    }

  }

  export async function onDashboardSetorChange() {
    const transitionId = modeTransitionSeq;

    const cdSetor = Number(document.getElementById('dashboard-setor')?.value);

    state.dashboardSetorSelecionado = Number.isInteger(cdSetor) && cdSetor > 0 ? cdSetor : null;

    if (!state.dashboardSetorSelecionado) {
      state.dashboardPacientes = [];
      state.dashboardResumo = buildDashboardResumo([]);
      state.dashboardFiltroEtiquetas = new Set();
      document.getElementById('dashboard-pacientes-grid').innerHTML = '';
      updateDashboardStats(state.dashboardResumo);
      updateDashboardLastUpdate(null);
      setDashboardFeedback('Selecione um setor para visualizar os pacientes.', 'bi-building', 'info');
      if (router.isCurrentWorkspace(transitionId, 'dashboard')) startDashboardRefresh();
      return;
    }

    const showLoading = !state.dashboardPacientes || state.dashboardPacientes.length === 0;
    await loadDashboardPacientes(showLoading, transitionId);
    if (router.isCurrentWorkspace(transitionId, 'dashboard')) startDashboardRefresh();

  }

  export async function enterDashboardMode() {

    if (!canAccessDashboard()) {
      ui.showToast('Dashboard de pacientes disponível apenas para Enfermagem e Técnicos de Enfermagem', 'warning');
      window.conectaCore.enterPassagemMode();
      return;
    }

    const transitionId = router.activateWorkspace('dashboard', document.getElementById('workspace-dashboard'));

    startDashboardClock();
    
    // Only reset if empty
    if (!state.dashboardResumo) {
      state.dashboardResumo = buildDashboardResumo([]);
      updateDashboardStats(state.dashboardResumo);
    }

    await loadDashboardSetores(transitionId);

    if (router.isCurrentWorkspace(transitionId, 'dashboard')) startDashboardRefresh();

  }

  export function updateDashboardPAClock(turno) {

    const now = new Date();

    const timeEl = document.getElementById('dashboard-internacao-clock-time');

    const dateEl = document.getElementById('dashboard-internacao-clock-date');

    const turnoEl = document.getElementById('dashboard-internacao-turno-label');

    if (timeEl) {

      timeEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    if (dateEl) {

      dateEl.textContent = formatDashboardDate(now);
    }

    if (turnoEl) {

      turnoEl.textContent = turno || getDashboardLocalTurno(now);
    }

  }

  export function startDashboardPAClock(turno) {

    if (state.dashboardPAClockTimer) {
      clearInterval(state.dashboardPAClockTimer);
    }

    updateDashboardPAClock(turno);

    state.dashboardPAClockTimer = setInterval(() => updateDashboardPAClock(turno), 1000);

  }

  export function startDashboardPARefresh() {

    if (state.dashboardPATimer) {
      clearInterval(state.dashboardPATimer);
    }

    state.dashboardPATimer = setInterval(() => {
      loadDashboardPA(false);
    }, DASHBOARD_REFRESH_MS);

  }

  export function setPAFeedback(message, icon = 'bi-info-circle', type = 'info') {

    const feedback = document.getElementById('dashboard-pa-feedback');

    if (!feedback) return;

    feedback.className = `dashboard-feedback dashboard-feedback-${type}`;

    feedback.innerHTML = `<i class="bi ${icon}"></i><span>${utils.escapeHtml(message)}</span>`;

    feedback.classList.remove('d-none');

  }

  export function hidePAFeedback() {

    document.getElementById('dashboard-pa-feedback')?.classList.add('d-none');

  }

  export function updateDashboardPALastUpdate(value) {

    const el = document.getElementById('dashboard-internacao-last-update');

    if (!el) return;

    if (!value) {
      el.textContent = 'Aguardando carregamento...';
      return;
    }

    const date = new Date(value);

    el.textContent = `Atualizado: ${date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;

  }

  export function updatePAStats() {

    const statsContainer = document.getElementById('dashboard-pa-stats-cards');
    if (!statsContainer) return;

    const data = state.dashboardPA;
    const totalCount = (data.particularesAlta?.length || 0) + (data.altaMedica?.length || 0) + (data.salaObservacao?.length || 0) + (data.indicacaoInternacao?.length || 0) + (data.decididos?.length || 0);

    const counts = {
      particulares_alta: data.particularesAlta?.length || 0,
      alta_medica: data.altaMedica?.length || 0,
      sala_observacao: data.salaObservacao?.length || 0,
      indicacao_internacao: data.indicacaoInternacao?.length || 0,
      decididos: data.decididos?.length || 0
    };

    const isSemFiltro = state.dashboardPAFiltroEtiqueta === null;

    const cards = [
      {
        key: 'all',
        label: 'Total Pacientes',
        total: totalCount,
        color: 'primary',
        active: isSemFiltro
      },
      ...DASHBOARD_PA_ETIQUETAS.map(item => ({
        key: item.key,
        label: item.label,
        total: counts[item.key] || 0,
        color: item.color,
        icon: item.icon,
        active: state.dashboardPAFiltroEtiqueta === item.key
      })).filter(item => item.total > 0 || state.dashboardPAFiltroEtiqueta === item.key)
    ];

    statsContainer.innerHTML = cards.map(card => `
      <button class="dashboard-stat dashboard-stat-${card.color}${card.active ? ' active' : ''}" type="button" data-pa-tag="${utils.escapeHtml(card.key)}">
        <span>${card.icon ? `<i class="bi ${card.icon}"></i> ` : ''}${utils.escapeHtml(card.label)}</span>
        <strong>${utils.escapeHtml(String(card.total))}</strong>
      </button>
    `).join('');
  }

  export function getPAFiltroEtiquetaKey(paciente) {
    const data = state.dashboardPA;
    if (data.particularesAlta?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'particulares_alta';
    if (data.altaMedica?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'alta_medica';
    if (data.salaObservacao?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'sala_observacao';
    if (data.indicacaoInternacao?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'indicacao_internacao';
    if (data.decididos?.some(p => p.nr_atendimento === paciente.nr_atendimento)) return 'decididos';
    return null;
  }

  export function renderPAPaciente(paciente, etiquetaKey) {

    const nrAtendimento = paciente.nr_atendimento || '-';
    const cdUnidadeRaw = paciente.cd_unidade ?? paciente.CD_UNIDADE ?? paciente.unidade;
    const cdUnidade = String(cdUnidadeRaw ?? '').trim() || '-';

    let statusClass = '';
    let statusBadge = '';

    const etiqueta = DASHBOARD_PA_ETIQUETAS.find(e => e.key === etiquetaKey);

    if (etiquetaKey === 'decididos') {
      const decisao = paciente.decisao;
      if (decisao === 'aceito' || decisao === 'recusado') {
        statusClass = decisao;
        const badgeClass = decisao === 'aceito' ? 'dashboard-badge-green' : 'dashboard-badge-red';
        const badgeLabel = decisao === 'aceito' ? 'Aceito' : 'Recusado';
        statusBadge = `<span class="dashboard-badge ${badgeClass}"><i class="bi ${decisao === 'aceito' ? 'bi-check-circle' : 'bi-x-circle'}"></i> ${utils.escapeHtml(badgeLabel)}</span>`;
      }
    } else if (etiqueta) {
      statusBadge = `<span class="dashboard-badge dashboard-badge-${etiqueta.color}"><i class="bi ${etiqueta.icon}"></i> ${utils.escapeHtml(etiqueta.label)}</span>`;
    }

    return `
      <article class="dashboard-patient-card ${statusClass}" data-atendimento="${utils.escapeHtml(String(nrAtendimento))}" data-nr-templ="${utils.escapeHtml(String(paciente.nr_seq_templ || ''))}" data-etiqueta="${utils.escapeHtml(etiquetaKey || '')}">
        ${statusBadge ? `<div class="dashboard-patient-tags">${statusBadge}</div>` : ''}
        <h3>${utils.escapeHtml(paciente.nome || '-')}</h3>
        ${utils.renderNomeCivilPaciente(paciente)}
        <div class="dashboard-patient-meta">
          <span><i class="bi bi-hash"></i> ${utils.escapeHtml(nrAtendimento)}</span>
          <span><i class="bi bi-building"></i> ${utils.escapeHtml(paciente.setor || '-')}</span>
          <span><i class="bi bi-diagram-3"></i> ${utils.escapeHtml(cdUnidade)}</span>
          <span><i class="bi bi-credit-card"></i> ${utils.escapeHtml(paciente.convenio || '-')}</span>
        </div>
      </article>`;

  }

  export function renderDashboardPAPacientes() {

    const grid = document.getElementById('dashboard-pa-patients-grid');
    if (!grid) return;

    const data = state.dashboardPA;
    const filtro = state.dashboardPAFiltroEtiqueta;

    const allPacientes = [
      ...data.particularesAlta.map(p => ({ ...p, _etiquetaKey: 'particulares_alta' })),
      ...data.altaMedica.map(p => ({ ...p, _etiquetaKey: 'alta_medica' })),
      ...data.salaObservacao.map(p => ({ ...p, _etiquetaKey: 'sala_observacao' })),
      ...data.indicacaoInternacao.map(p => ({ ...p, _etiquetaKey: 'indicacao_internacao' })),
      ...data.decididos.map(p => ({ ...p, _etiquetaKey: 'decididos' }))
    ];

    const totalCount = allPacientes.length;

    if (totalCount === 0) {
      grid.innerHTML = '';
      setPAFeedback('Nenhum paciente encontrado.', 'bi-people', 'info');
      return;
    }

    const filtered = filtro
      ? allPacientes.filter(p => p._etiquetaKey === filtro)
      : allPacientes;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      setPAFeedback('Nenhum paciente corresponde ao filtro selecionado.', 'bi-funnel', 'info');
      return;
    }

    hidePAFeedback();

    grid.innerHTML = filtered.map(paciente => renderPAPaciente(paciente, paciente._etiquetaKey)).join('');

    grid.querySelectorAll('.dashboard-patient-card').forEach(card => {
      const atendimento = card.getAttribute('data-atendimento');
      const etiqueta = card.getAttribute('data-etiqueta');

      if (etiqueta === 'decididos') {
        card.addEventListener('click', () => {
          openDecididoModal(atendimento);
        });
        card.style.cursor = 'pointer';
        return;
      }

      const internacaoList = state.dashboardPA.indicacaoInternacao || [];
      if (internacaoList.some(p => String(p.nr_atendimento) === String(atendimento))) {
        card.addEventListener('click', () => {
          openInternacaoModal(atendimento);
        });
        card.style.cursor = 'pointer';
      }
    });

  }

  export function renderDashboardPA() {

    const data = state.dashboardPA;

    updatePAStats();
    renderDashboardPAPacientes();

  }

  export async function loadDashboardPA(showLoading = true, transitionId = modeTransitionSeq) {

    if (!router.isCurrentWorkspace(transitionId, 'dashboard-internacao')) return;

    const refreshBtn = document.getElementById('btn-dashboard-internacao-refresh');

    if (showLoading) {
      setPAFeedback('Carregando...', 'bi-arrow-repeat spin', 'loading');
    }

    refreshBtn?.querySelector('i')?.classList.add('spin');

    try {

      const result = await api.get('/api/dashboard/internacao');

      if (!router.isCurrentWorkspace(transitionId, 'dashboard-internacao')) return;

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar dados');
      }

      state.dashboardPA = {
        particularesAlta: result.data.particularesAlta || [],
        altaMedica: result.data.altaMedica || [],
        salaObservacao: result.data.salaObservacao || [],
        indicacaoInternacao: result.data.indicacaoInternacao || [],
        decididos: result.data.decididos || []
      };
      state.dashboardPALoaded = true;

      updateDashboardPALastUpdate(new Date().toISOString());
      startDashboardPAClock(result.data.turno?.descricao);
      renderDashboardPA();

    } catch (err) {
      if (!router.isCurrentWorkspace(transitionId, 'dashboard-internacao')) return;
      setPAFeedback(err.message || 'Erro ao carregar', 'bi-exclamation-triangle', 'error');
    } finally {
      if (router.isCurrentWorkspace(transitionId, 'dashboard-internacao')) {
        refreshBtn?.querySelector('i')?.classList.remove('spin');
      }
    }

  }

  let currentInternacaoNrAtendimento = null;
  let currentInternacaoCdConvenio = null;
  let alterandoDecisao = false;
  let lastDecididoData = null;

  export function openInternacaoModal(nrAtendimento) {

    currentInternacaoNrAtendimento = nrAtendimento;

    const overlay = document.getElementById('modal-internacao-overlay');

    const body = document.getElementById('modal-internacao-body');

    const title = document.getElementById('modal-internacao-title');

    const subtitle = document.getElementById('modal-internacao-subtitle');

    if (overlay) {
      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          closeInternacaoModal();
        }
      };
    }

    if (body) {
      body.innerHTML = `<div class="modal-internacao-loading"><i class="bi bi-arrow-repeat spin"></i><span>Carregando detalhes...</span></div>`;
    }

    if (title) title.textContent = 'Indicação de Internação';

    if (subtitle) subtitle.textContent = `Atendimento ${nrAtendimento}`;

    document.getElementById('btn-aceitar-internacao').classList.remove('d-none');
    document.getElementById('btn-recusar-internacao').classList.remove('d-none');

    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');

    alterandoDecisao = false;
    lastDecididoData = null;

    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');

    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    if (decisaoInfo) {
      decisaoInfo.classList.add('d-none');
      decisaoInfo.innerHTML = '';
    }

    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    if (motivoWrapper) motivoWrapper.classList.remove('d-none');

    loadInternacaoDetalhes(nrAtendimento);
    loadSetorDesejadoOptions();

  }

  export function openDecididoModal(nrAtendimento) {

    const overlay = document.getElementById('modal-internacao-overlay');
    const body = document.getElementById('modal-internacao-body');
    const title = document.getElementById('modal-internacao-title');
    const subtitle = document.getElementById('modal-internacao-subtitle');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');

    if (overlay) {
      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          closeInternacaoModal();
        }
      };
    }

    if (body) {
      body.innerHTML = `<div class="modal-internacao-loading"><i class="bi bi-arrow-repeat spin"></i><span>Carregando detalhes...</span></div>`;
    }

    if (title) title.textContent = 'Decisão de Internação';
    if (subtitle) subtitle.textContent = `Atendimento ${nrAtendimento}`;

    document.getElementById('btn-aceitar-internacao')?.classList.add('d-none');
    document.getElementById('btn-recusar-internacao')?.classList.add('d-none');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');
    if (motivoWrapper) motivoWrapper.classList.add('d-none');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
    if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
    if (decisaoInfo) {
      decisaoInfo.classList.remove('d-none');
      decisaoInfo.innerHTML = `<div class="modal-internacao-loading"><i class="bi bi-arrow-repeat spin"></i><span>Carregando decisão...</span></div>`;
    }

    alterandoDecisao = false;
    lastDecididoData = null;

    loadDecididoDetalhes(nrAtendimento);
    loadSetorDesejadoOptions();

  }

  export async function loadDecididoDetalhes(nrAtendimento) {

    const body = document.getElementById('modal-internacao-body');
    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');

    try {

      const result = await api.get(`/api/dashboard/internacao/detalhes/${nrAtendimento}`);

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar detalhes');
      }

      const d = result.data;

      currentInternacaoNrAtendimento = d.nr_atendimento || nrAtendimento;
      currentInternacaoCdConvenio = d.cd_convenio || null;
      lastDecididoData = d;

      const labelMap = {
        100082: { 289670: 'Parecer' },
        100083: { 289674: 'Parecer' }
      };

      const labels = labelMap[d.nr_seq_templ] || {};

      let detalhesHtml = `<div class="modal-internacao-detalhes">`;
      detalhesHtml += `
        <div class="detail-row">
          <span class="detail-label">Paciente</span>
          <span class="detail-value">${utils.escapeHtml(d.nome || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Setor</span>
          <span class="detail-value">${utils.escapeHtml(d.setor || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Convênio</span>
          <span class="detail-value">${utils.escapeHtml(d.convenio || '-')}</span>
        </div>`;

      if (d.resultado) {
        for (const [key, value] of Object.entries(d.resultado)) {
          const campoNum = parseInt(key.replace('campo_', ''), 10);
          if (!labels[campoNum]) continue;
          detalhesHtml += `
            <div class="detail-row">
              <span class="detail-label">${utils.escapeHtml(labels[campoNum])}</span>
              <span class="detail-value highlight">${utils.escapeHtml(value || '-')}</span>
            </div>`;
        }
      }
      detalhesHtml += `</div>`;

      if (body) body.innerHTML = detalhesHtml;

      if (decisaoInfo) {
        const decisao = d.decisao;
        const isAceito = decisao === 'aceito';
        const badgeClass = isAceito ? 'dashboard-badge-green' : 'dashboard-badge-red';
        const badgeLabel = isAceito ? 'Aceito' : (decisao === 'recusado' ? 'Recusado' : '-');
        const badgeIcon = isAceito ? 'bi-check-circle' : 'bi-x-circle';

        let dtDecisao = '-';
        if (d.dt_decisao) {
          const raw = String(d.dt_decisao).trim();
          const dt = new Date(raw.replace(' ', 'T'));
          if (!isNaN(dt.getTime())) {
            dtDecisao = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          } else if (raw) {
            dtDecisao = raw;
          }
        }

        let decisaoHtml = `<div class="modal-decisao-block">`;
        decisaoHtml += `
          <div class="modal-decisao-status">
            <span class="dashboard-badge ${badgeClass}"><i class="bi ${badgeIcon}"></i> ${utils.escapeHtml(badgeLabel)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Decidido por</span>
            <span class="detail-value">${utils.escapeHtml(d.decidido_por || '-')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Data</span>
            <span class="detail-value">${utils.escapeHtml(dtDecisao)}</span>
          </div>`;

        if (isAceito && d.setor_desejado) {
          decisaoHtml += `
            <div class="detail-row">
              <span class="detail-label">Setor desejado</span>
              <span class="detail-value">${utils.escapeHtml(d.setor_desejado)}</span>
            </div>`;
        }

        if (d.motivo) {
          decisaoHtml += `
            <div class="detail-row detail-row-block">
              <span class="detail-label">Motivo</span>
              <span class="detail-value">${utils.escapeHtml(d.motivo)}</span>
            </div>`;
        }

        decisaoHtml += `</div>`;
        decisaoInfo.innerHTML = decisaoHtml;
      }

      const btnAlterar = document.getElementById('btn-alterar-decisao');
      if (btnAlterar) btnAlterar.classList.remove('d-none');

    } catch (err) {
      if (body) body.innerHTML = `<div class="pa-quadro-feedback pa-quadro-feedback-error"><i class="bi bi-exclamation-triangle"></i><span>${utils.escapeHtml(err.message || 'Erro ao carregar')}</span></div>`;
      if (decisaoInfo) decisaoInfo.innerHTML = '';
    }

  }

  export async function enableDecisaoAlteracao() {

    const d = lastDecididoData;
    if (!d) return;

    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const motivoInput = document.getElementById('modal-internacao-motivo');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');

    if (decisaoInfo) decisaoInfo.classList.add('d-none');
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.remove('d-none');
    if (motivoWrapper) motivoWrapper.classList.remove('d-none');

    if (motivoInput) {
      motivoInput.value = d.motivo || '';
      motivoInput.focus();
    }

    document.getElementById('btn-aceitar-internacao')?.classList.remove('d-none');
    document.getElementById('btn-recusar-internacao')?.classList.remove('d-none');

    const title = document.getElementById('modal-internacao-title');
    if (title) title.textContent = 'Alterar Decisão de Internação';

    alterandoDecisao = true;

    await loadSetorDesejadoOptions();

    const setorSelect = document.getElementById('modal-internacao-setor-desejado');
    if (setorSelect && d.cd_setor_desejado) {
      setorSelect.value = String(d.cd_setor_desejado);
    }

  }

  export function disableDecisaoAlteracao() {

    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');
    const motivoInput = document.getElementById('modal-internacao-motivo');

    if (decisaoInfo) decisaoInfo.classList.remove('d-none');
    if (motivoWrapper) motivoWrapper.classList.add('d-none');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
    if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
    if (btnAlterar) btnAlterar.classList.remove('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');

    if (motivoInput) motivoInput.value = lastDecididoData?.motivo || '';

    document.getElementById('btn-aceitar-internacao')?.classList.add('d-none');
    document.getElementById('btn-recusar-internacao')?.classList.add('d-none');

    const title = document.getElementById('modal-internacao-title');
    if (title) title.textContent = 'Decisão de Internação';

    alterandoDecisao = false;

  }

  export async function loadSetorDesejadoOptions() {
    const select = document.getElementById('modal-internacao-setor-desejado');
    if (!select) return;

    select.innerHTML = '<option value="">Carregando setores...</option>';
    select.disabled = true;

    try {
      const result = await api.get('/api/setores-internacao?modulo=dashboard');
      if (!result.success) throw new Error(result.message || 'Erro ao carregar setores');

      const setores = result.data || [];
      select.innerHTML = '<option value="">Selecione o setor...</option>';

      setores.forEach(s => {
        const option = document.createElement('option');
        option.value = String(s.cd_setor_atendimento);
        option.textContent = s.ds_setor_atendimento;
        select.appendChild(option);
      });

      select.disabled = false;
    } catch (err) {
      select.innerHTML = '<option value="">Erro ao carregar setores</option>';
    }
  }

  export function closeInternacaoModal() {

    const overlay = document.getElementById('modal-internacao-overlay');
    const motivoInput = document.getElementById('modal-internacao-motivo');
    const motivoWrapper = document.getElementById('modal-internacao-motivo-wrapper');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');
    const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
    const decisaoInfo = document.getElementById('modal-internacao-decisao-info');
    const btnAlterar = document.getElementById('btn-alterar-decisao');
    const btnCancelar = document.getElementById('btn-cancelar-alteracao');

    if (overlay) overlay.classList.add('d-none');
    document.body.classList.remove('modal-open');

    if (motivoInput) motivoInput.value = '';

    if (motivoWrapper) motivoWrapper.classList.remove('d-none');
    if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
    if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
    if (decisaoInfo) {
      decisaoInfo.classList.add('d-none');
      decisaoInfo.innerHTML = '';
    }
    if (btnAlterar) btnAlterar.classList.add('d-none');
    if (btnCancelar) btnCancelar.classList.add('d-none');

    currentInternacaoNrAtendimento = null;
    currentInternacaoCdConvenio = null;
    alterandoDecisao = false;
    lastDecididoData = null;

  }

  export async function loadInternacaoDetalhes(nrAtendimento) {

    const body = document.getElementById('modal-internacao-body');

    try {

      const result = await api.get(`/api/dashboard/internacao/detalhes/${nrAtendimento}`);

      if (!result.success) {
        throw new Error(result.message || 'Erro ao carregar detalhes');
      }

      const d = result.data;

      currentInternacaoCdConvenio = d.cd_convenio || null;

      const labelMap = {
        100082: { 289670: 'Parecer' },
        100083: { 289674: 'Parecer' }
      };

      const labels = labelMap[d.nr_seq_templ] || {};

      let detalhesHtml = `<div class="modal-internacao-detalhes">`;

      detalhesHtml += `
        <div class="detail-row">
          <span class="detail-label">Paciente</span>
          <span class="detail-value">${utils.escapeHtml(d.nome || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Setor</span>
          <span class="detail-value">${utils.escapeHtml(d.setor || '-')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Convênio</span>
          <span class="detail-value">${utils.escapeHtml(d.convenio || '-')}</span>
        </div>`;

      if (d.resultado) {
        for (const [key, value] of Object.entries(d.resultado)) {
          const campoNum = parseInt(key.replace('campo_', ''), 10);
          if (!labels[campoNum]) continue;
          detalhesHtml += `
            <div class="detail-row">
              <span class="detail-label">${utils.escapeHtml(labels[campoNum])}</span>
              <span class="detail-value highlight">${utils.escapeHtml(value || '-')}</span>
            </div>`;
        }
      }

      detalhesHtml += `</div>`;

      if (body) body.innerHTML = detalhesHtml;

    } catch (err) {
      if (body) body.innerHTML = `<div class="pa-quadro-feedback pa-quadro-feedback-error"><i class="bi bi-exclamation-triangle"></i><span>${utils.escapeHtml(err.message || 'Erro ao carregar')}</span></div>`;
    }

  }

  export async function handleInternacaoAcao(acao) {

    if (!currentInternacaoNrAtendimento) return;

    const btnAceitar = document.getElementById('btn-aceitar-internacao');
    const btnRecusar = document.getElementById('btn-recusar-internacao');
    const motivoInput = document.getElementById('modal-internacao-motivo');
    const setorDesejadoWrapper = document.getElementById('modal-internacao-setor-desejado-wrapper');

    if (acao === 'aceitar' && setorDesejadoWrapper && setorDesejadoWrapper.classList.contains('d-none')) {
      setorDesejadoWrapper.classList.remove('d-none');
      const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
      if (rodizioWrapper) rodizioWrapper.classList.remove('d-none');
      return;
    }

    const motivoPreview = motivoInput?.value?.trim() || '';

    if (alterandoDecisao && !motivoPreview) {
      ui.showToast('Justifique o motivo da alteração da decisão', 'warning');
      motivoInput?.focus();
      return;
    }

    btnAceitar.disabled = true;
    btnRecusar.disabled = true;

    btnAceitar.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processando...';
    btnRecusar.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processando...';

    try {

      const motivo = motivoPreview;

      const setorDesejadoSelect = document.getElementById('modal-internacao-setor-desejado');
      const cdSetorDesejado = acao === 'aceitar' && setorDesejadoSelect?.value
        ? parseInt(setorDesejadoSelect.value, 10)
        : null;

      const result = await api.post('/api/dashboard/internacao/acao', {
        nr_atendimento: currentInternacaoNrAtendimento,
        acao: acao,
        motivo: motivo,
        cd_setor_desejado: cdSetorDesejado,
        cd_convenio: currentInternacaoCdConvenio
      });

      if (!result.success) {
        throw new Error(result.message || 'Erro ao processar ação');
      }

      const msgSucesso = alterandoDecisao
        ? (acao === 'aceitar' ? 'Decisão alterada para Aceito' : 'Decisão alterada para Recusado')
        : (acao === 'aceitar' ? 'Internação aceita' : 'Internação recusada');
      ui.showToast(result.message || msgSucesso, 'success');

      if (result.warnings && result.warnings.length > 0) {
        setTimeout(() => {
          ui.showToast(result.warnings[0].message, 'warning');
        }, 1500);
      }

      closeInternacaoModal();

      await loadDashboardPA(false);

    } catch (err) {
      ui.showToast(err.message || 'Erro ao processar ação', 'error');
    } finally {
      btnAceitar.disabled = false;
      btnRecusar.disabled = false;
      btnAceitar.innerHTML = '<i class="bi bi-check-circle"></i> Aceitar';
      btnRecusar.innerHTML = '<i class="bi bi-x-circle"></i> Recusar';
      if (setorDesejadoWrapper) setorDesejadoWrapper.classList.add('d-none');
      const rodizioWrapper = document.getElementById('modal-internacao-rodizio-wrapper');
      if (rodizioWrapper) rodizioWrapper.classList.add('d-none');
      alterandoDecisao = false;
    }

  }

  export async function enterDashboardInternacaoMode() {

    if (!canAccessDashboardInternacao()) {
      ui.showToast('Dashboard P.A. disponível apenas para Enfermagem', 'warning');
      window.conectaCore.enterPassagemMode();
      return;
    }

    const transitionId = router.activateWorkspace('dashboard-internacao', document.getElementById('workspace-dashboard-internacao'));

    startDashboardPAClock();
    state.dashboardPAFiltroEtiqueta = null;
    
    // Render from memory immediately only after a successful load.
    if (state.dashboardPALoaded) {
      renderDashboardPA();
    }

    const showLoading = !state.dashboardPALoaded;
    await loadDashboardPA(showLoading, transitionId);

    if (router.isCurrentWorkspace(transitionId, 'dashboard-internacao')) startDashboardPARefresh();

  }

// Event Listeners for Dashboard Internação & P.A.
document.getElementById('dashboard-setor')?.addEventListener('change', onDashboardSetorChange);
document.getElementById('btn-dashboard-refresh')?.addEventListener('click', () => {
  loadDashboardPacientes(true);
});
document.getElementById('btn-dashboard-internacao-refresh')?.addEventListener('click', () => {
  loadDashboardPA(true);
});
document.getElementById('modal-internacao-close')?.addEventListener('click', () => {
  closeInternacaoModal();
});
document.getElementById('btn-aceitar-internacao')?.addEventListener('click', () => {
  handleInternacaoAcao('aceitar');
});
document.getElementById('btn-recusar-internacao')?.addEventListener('click', () => {
  handleInternacaoAcao('recusar');
});
document.getElementById('btn-alterar-decisao')?.addEventListener('click', () => {
  enableDecisaoAlteracao();
});
document.getElementById('btn-cancelar-alteracao')?.addEventListener('click', () => {
  disableDecisaoAlteracao();
});

document.getElementById('dashboard-pa-stats-cards')?.addEventListener('click', e => {
  const button = e.target.closest('[data-pa-tag]');
  if (!button) return;

  const tag = String(button.dataset.paTag || '').trim();
  if (!tag) return;

  if (tag === 'all') {
    state.dashboardPAFiltroEtiqueta = null;
  } else {
    if (state.dashboardPAFiltroEtiqueta === tag) {
      state.dashboardPAFiltroEtiqueta = null;
    } else {
      state.dashboardPAFiltroEtiqueta = tag;
    }
  }

  updatePAStats();
  renderDashboardPAPacientes();
});

document.getElementById('dashboard-stats-cards')?.addEventListener('click', e => {
  const button = e.target.closest('[data-tag]');
  if (!button) return;

  const tag = String(button.dataset.tag || '').trim();
  if (!tag) return;

  if (tag === 'all') {
    state.dashboardFiltroEtiquetas = new Set();
  } else {
    const current = state.dashboardFiltroEtiquetas.values().next().value;
    if (current === tag) {
      state.dashboardFiltroEtiquetas = new Set();
    } else {
      state.dashboardFiltroEtiquetas = new Set([tag]);
    }
  }

  updateDashboardStats(state.dashboardResumo || buildDashboardResumo(state.dashboardPacientes));
  renderDashboardPacientes();
});
