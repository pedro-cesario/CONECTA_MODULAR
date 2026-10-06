import { api } from '../../core/api.js';
import { state, MODULOS_CONFIG, modeTransitionSeq } from '../../core/state.js';
import { carregarSenhasTriagem } from '../recepcao/recepcao.js';
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
    initTriagemSenhasPA();
    carregarSenhasTriagem(false);
    // renderTriagemPermissions is handled inside initTriagemSenhasPA

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


// ====== LÓGICA DA TRIAGEM E RECEPÇÃO P.A. (SENHAS E MODAL SIMPLES) ======
let triagemSearchTimeout = null;
let isTriagemInit = false;
let senhaAtivaTriagem = null;

export function initTriagemSenhasPA() {
  if (isTriagemInit) return;
  isTriagemInit = true;

  const btnRefresh = document.getElementById('btn-triagem-refresh');
  const searchInput = document.getElementById('triagem-modal-search-input');
  const btnShowCadastro = document.getElementById('btn-triagem-show-cadastro');
  const btnBackBusca = document.getElementById('btn-triagem-back-busca');
  const btnSalvarNovo = document.getElementById('btn-triagem-salvar-paciente');
  const btnBackBuscaConf = document.getElementById('btn-triagem-back-busca-conf');
  const btnConfirmar = document.getElementById('btn-triagem-confirmar-inicio');

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      carregarSenhasTriagem(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(triagemSearchTimeout);
      const termo = e.target.value.trim();
      
      if (termo.length < 3) {
        document.getElementById('triagem-modal-search-results').innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="bi bi-keyboard" style="font-size: 2rem; opacity: 0.3;"></i>
            <p class="mt-2 small">Digite para pesquisar no TASY...</p>
          </div>
        `;
        return;
      }
      
      triagemSearchTimeout = setTimeout(() => buscarPacienteTriagem(termo), 500);
    });
  }

  if (btnShowCadastro) {
    btnShowCadastro.addEventListener('click', () => {
      document.getElementById('triagem-modal-step-busca').classList.add('d-none');
      document.getElementById('triagem-modal-step-confirmacao').classList.add('d-none');
      document.getElementById('triagem-modal-step-cadastro').classList.remove('d-none');
      document.getElementById('btn-triagem-salvar-paciente').classList.remove('d-none');
      if (btnConfirmar) btnConfirmar.classList.add('d-none');
      document.getElementById('form-triagem-novo-paciente').reset();
      
      // Auto fill nome
      const termo = document.getElementById('triagem-modal-search-input')?.value.trim();
      if (termo && !/\d/.test(termo)) {
        document.getElementById('triagem-form-nome').value = termo;
      }
    });
  }

  if (btnBackBusca) {
    btnBackBusca.addEventListener('click', () => {
      document.getElementById('triagem-modal-step-busca').classList.remove('d-none');
      document.getElementById('triagem-modal-step-cadastro').classList.add('d-none');
      document.getElementById('btn-triagem-salvar-paciente').classList.add('d-none');
    });
  }
  
  if (btnBackBuscaConf) {
    btnBackBuscaConf.addEventListener('click', () => {
      document.getElementById('triagem-modal-step-confirmacao').classList.add('d-none');
      document.getElementById('triagem-modal-step-busca').classList.remove('d-none');
      if (btnConfirmar) btnConfirmar.classList.add('d-none');
    });
  }

  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', async () => {
      const cdPf = btnConfirmar.getAttribute('data-cdpf');
      if (cdPf) {
        ui.setLoading(btnConfirmar, true);
        await window.conectaCore.abrirAtendimentoExistenteTriagem(cdPf, true);
        ui.setLoading(btnConfirmar, false);
      }
    });
  }

  if (btnSalvarNovo) {
    btnSalvarNovo.addEventListener('click', salvarENovoAtendimentoTriagem);
  }
}

async function buscarPacienteTriagem(termo) {
  const resultsContainer = document.getElementById('triagem-modal-search-results');
  const permAbrir = auth.temPermissaoAtiva('dashboard_pa', 'abrir_atendimento');

  resultsContainer.innerHTML = `
    <div class="text-center text-muted py-4">
      <div class="spinner-border spinner-border-sm mb-2 text-primary" role="status"></div>
      <p class="fw-bold small">Buscando no TASY...</p>
    </div>
  `;

  try {
    const res = await api.get(`/api/recepcao/pessoas/buscar?q=${encodeURIComponent(termo)}`);
    if (res.success && res.data && res.data.length > 0) {
      const pacientes = res.data.slice(0, 5);
      
      let html = pacientes.map(p => {
        const nome = p.NM_PESSOA_FISICA || 'Sem Nome';
        const cpf = p.NR_CPF || '';
        const nasc = p.DT_NASC_FMT || (p.DT_NASCIMENTO ? utils.formatDateToBr(p.DT_NASCIMENTO) : '');
        const cdPf = p.CD_PESSOA_FISICA || '';
        const mae = p.NM_MAE || '';

        return `
        <div class="card border-0 shadow-sm border mb-2">
          <div class="card-body p-3 d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1 fw-bold text-primary">${utils.escapeHtml(nome)}</h6>
              <div class="text-muted small">
                ${cpf ? `<i class="bi bi-person-vcard"></i> CPF: ${cpf}` : ''}
                ${nasc ? `<span class="ms-2"><i class="bi bi-calendar"></i> Nasc: ${nasc}</span>` : ''}
              </div>
            </div>
            ${permAbrir ? `
              <button class="btn btn-sm btn-outline-success fw-bold" onclick="window.conectaCore.prepararConfirmacaoTriagem('${btoa(encodeURIComponent(JSON.stringify({nome, cpf, nasc, cdPf, mae})))}')">
                <i class="bi bi-check-circle me-1"></i> Selecionar
              </button>
            ` : `
              <span class="badge bg-danger">Sem Permissão</span>
            `}
          </div>
        </div>
      `}).join('');
      
      resultsContainer.innerHTML = html;
    } else {
      resultsContainer.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-person-x" style="font-size: 2rem; opacity: 0.3;"></i>
          <p class="mt-2 fw-bold small">Nenhum paciente encontrado.</p>
        </div>
      `;
    }
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="text-center text-danger py-4">
        <i class="bi bi-exclamation-triangle" style="font-size: 2rem; opacity: 0.5;"></i>
        <p class="mt-2 fw-bold small">Erro ao buscar: ${utils.escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

window.conectaCore = window.conectaCore || {};

window.conectaCore.abrirModalTriagemPA = function(nrSeq, cdFormatado, nomePrevisto) {
  senhaAtivaTriagem = { nrSeq, cdFormatado, nomePrevisto };
  
  // Atualiza Badge
  document.getElementById('triagem-modal-senha-badge').innerHTML = `<i class="bi bi-ticket-perforated-fill"></i> Senha ${cdFormatado}`;
  
  // Limpa Busca
  document.getElementById('triagem-modal-search-input').value = nomePrevisto || '';
  if (nomePrevisto) {
    buscarPacienteTriagem(nomePrevisto);
  } else {
    document.getElementById('triagem-modal-search-results').innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-keyboard" style="font-size: 2rem; opacity: 0.3;"></i>
        <p class="mt-2 small">Digite para pesquisar no TASY...</p>
      </div>
    `;
  }
  
  // Reseta estado UI do modal para Passo 1
  document.getElementById('triagem-modal-step-busca').classList.remove('d-none');
  document.getElementById('triagem-modal-step-cadastro').classList.add('d-none');
  document.getElementById('triagem-modal-step-confirmacao').classList.add('d-none');
  document.getElementById('btn-triagem-salvar-paciente').classList.add('d-none');
  const btnConfirm = document.getElementById('btn-triagem-confirmar-inicio');
  if (btnConfirm) btnConfirm.classList.add('d-none');
  document.getElementById('form-triagem-novo-paciente').reset();

  const modal = new bootstrap.Modal(document.getElementById('modal-triagem-identificacao'));
  modal.show();
};

window.conectaCore.abrirAtendimentoExistenteTriagem = async function(cdPessoaFisica) {
  const btn = event.currentTarget;
  ui.setLoading(btn, true);
  await abrirAtendimentoTriagem(cdPessoaFisica);
  ui.setLoading(btn, false);
};

window.conectaCore.abrirFluxoNativo = function(label, idComponente) {
  const modalId = label.toLowerCase().includes('sinais vitais') ? 'modal-fluxo-sv' :
                  label.toLowerCase().includes('glasgow') ? 'modal-fluxo-glasgow' :
                  label.toLowerCase().includes('alergias') ? 'modal-fluxo-alergias' : null;
  
  if (!modalId) {
     ui.showToast('Fluxo nativo não encontrado para: ' + label, 'warning');
     return;
  }
  
  const modalEl = document.getElementById(modalId);
  if (modalEl) {
     // Store the component ID so we know where to save the data
     modalEl.setAttribute('data-target-id', idComponente);
     
     // Limpar form do modal
     const form = modalEl.querySelector('form');
     if (form) form.reset();

     // Se já houver dados no hidden, preenche o form
     const hiddenVal = document.getElementById('fluxo_' + idComponente)?.value;
     if (hiddenVal && form) {
        try {
           const dados = JSON.parse(hiddenVal);
           for (const key in dados) {
              const input = form.querySelector(`[name="${key}"]`);
              if (input) {
                 if (input.type === 'checkbox' || input.type === 'radio') {
                     if (input.type === 'radio') {
                        const radio = form.querySelector(`[name="${key}"][value="${dados[key]}"]`);
                        if (radio) radio.checked = true;
                     } else {
                        input.checked = !!dados[key];
                     }
                 } else {
                     input.value = dados[key];
                 }
              }
           }
        } catch(e) {}
     }
     
     const m = new bootstrap.Modal(modalEl);
     m.show();
  }
};

window.conectaCore.salvarFluxoNativo = function(modalId) {
  const modalEl = document.getElementById(modalId);
  const targetId = modalEl.getAttribute('data-target-id');
  const form = modalEl.querySelector('form');
  if (!form || !targetId) return;
  
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  
  document.getElementById('fluxo_' + targetId).value = JSON.stringify(payload);
  document.getElementById('display_' + targetId).value = 'Preenchido (Clique para editar)';
  
  const m = bootstrap.Modal.getInstance(modalEl);
  if (m) m.hide();
};

function ensureFluxoModals() {
  if (document.getElementById('modal-fluxo-sv')) return;
  
  const modalsHtml = `
    <!-- Sinais Vitais -->
    <div class="modal fade" id="modal-fluxo-sv" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Sinais Vitais (PEP)</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="form-fluxo-sv">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-bold">PA Sistólica (mmHg)</label>
                  <input type="number" class="form-control" name="QT_PA_SISTOLICA">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-bold">PA Diastólica (mmHg)</label>
                  <input type="number" class="form-control" name="QT_PA_DIASTOLICA">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-bold">Freq. Cardíaca (bpm)</label>
                  <input type="number" class="form-control" name="QT_FREQUENCIA_CARD">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-bold">Freq. Respiratória (rpm)</label>
                  <input type="number" class="form-control" name="QT_FREQUENCIA_RESP">
                </div>
                <div class="col-md-4">
                  <label class="form-label small fw-bold">Temp. (°C)</label>
                  <input type="number" step="0.1" class="form-control" name="QT_TEMPERATURA">
                </div>
                <div class="col-md-4">
                  <label class="form-label small fw-bold">Peso (Kg)</label>
                  <input type="number" step="0.1" class="form-control" name="QT_PESO">
                </div>
                <div class="col-md-4">
                  <label class="form-label small fw-bold">SpO2 (%)</label>
                  <input type="number" class="form-control" name="QT_SAT_O2">
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="window.conectaCore.salvarFluxoNativo('modal-fluxo-sv')">Salvar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Glasgow -->
    <div class="modal fade" id="modal-fluxo-glasgow" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Escala de Coma de Glasgow</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="form-fluxo-glasgow">
              <div class="mb-3">
                <label class="form-label small fw-bold">Abertura Ocular</label>
                <select class="form-select" name="IE_ABERTURA_OCULAR">
                  <option value="">Selecione...</option>
                  <option value="4">4 - Espontânea</option>
                  <option value="3">3 - À voz</option>
                  <option value="2">2 - À dor</option>
                  <option value="1">1 - Nenhuma</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-bold">Resposta Verbal</label>
                <select class="form-select" name="IE_RESPOSTA_VERBAL">
                  <option value="">Selecione...</option>
                  <option value="5">5 - Orientada</option>
                  <option value="4">4 - Confusa</option>
                  <option value="3">3 - Palavras inapropriadas</option>
                  <option value="2">2 - Sons incompreensíveis</option>
                  <option value="1">1 - Nenhuma</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-bold">Resposta Motora</label>
                <select class="form-select" name="IE_RESPOSTA_MOTORA">
                  <option value="">Selecione...</option>
                  <option value="6">6 - Obedece a comandos</option>
                  <option value="5">5 - Localiza a dor</option>
                  <option value="4">4 - Flexão normal (Retirada)</option>
                  <option value="3">3 - Flexão anormal (Decorticação)</option>
                  <option value="2">2 - Extensão (Descerebração)</option>
                  <option value="1">1 - Nenhuma</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="window.conectaCore.salvarFluxoNativo('modal-fluxo-glasgow')">Salvar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Alergias -->
    <div class="modal fade" id="modal-fluxo-alergias" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Alergias (PEP)</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="form-fluxo-alergias">
              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" name="IE_NEGA_ALERGIAS" id="cbNegaAlergias" value="S">
                <label class="form-check-label fw-bold" for="cbNegaAlergias">
                  Nega alergias conhecidas
                </label>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-bold">Observação / Descrição da Alergia</label>
                <textarea class="form-control" name="DS_OBSERVACAO" rows="3" placeholder="Ex: Dipirona, Penicilina, Frutos do mar..."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="window.conectaCore.salvarFluxoNativo('modal-fluxo-alergias')">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalsHtml);
}


window.conectaCore.prepararConfirmacaoTriagem = async function(base64Data) {
  try {
    const paciente = JSON.parse(decodeURIComponent(atob(base64Data)));
    const container = document.getElementById('triagem-confirm-details');
    
    document.getElementById('triagem-modal-step-busca').classList.add('d-none');
    document.getElementById('triagem-modal-step-confirmacao').classList.remove('d-none');

    container.innerHTML = `
      <div class="text-center mb-4">
        <h5 class="fw-bold text-primary">Deseja iniciar a triagem do paciente abaixo?</h5>
        <p class="text-muted small mb-0">Valide os dados do paciente antes de prosseguir.</p>
      </div>
      <div class="card bg-white border shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label small fw-bold text-muted mb-0">Nome Completo</label>
              <div class="fw-bold fs-5 text-dark">${utils.escapeHtml(paciente.nome)}</div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold text-muted mb-0">Data de Nascimento</label>
              <div class="fw-bold text-dark">${utils.escapeHtml(paciente.nasc) || 'Não informado'}</div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold text-muted mb-0">CPF</label>
              <div class="fw-bold text-dark">${utils.escapeHtml(paciente.cpf) || 'Não informado'}</div>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold text-muted mb-0">Nome da Mãe</label>
              <div class="fw-bold text-dark">${utils.escapeHtml(paciente.mae) || 'Não informado'}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const btnConfirmar = document.getElementById('btn-triagem-confirmar-inicio');
    if (btnConfirmar) {
      btnConfirmar.classList.remove('d-none');
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = '<i class="bi bi-file-medical me-1"></i> Iniciar Triagem';
      btnConfirmar.onclick = () => window.conectaCore.carregarTemplateEHR(paciente);
    }
  } catch (err) {
    console.error(err);
    ui.showToast('Erro ao preparar confirmação', 'error');
  }
};

window.conectaCore.carregarTemplateEHR = async function(paciente) {
  ensureFluxoModals();
  try {
    const container = document.getElementById('triagem-confirm-details');
    
    // Mostra loading inicial
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 fw-bold text-muted small">Carregando Template Triagem P.A...</p>
      </div>
    `;
    
    const btnConfirmar = document.getElementById('btn-triagem-confirmar-inicio');
    if (btnConfirmar) {
      btnConfirmar.disabled = true; 
      btnConfirmar.innerHTML = '<i class="bi bi-check-circle me-1"></i> Salvar Triagem';
    }

    // Busca o template configurado no backend
    const res = await api.get('/api/ehr/template/triagem');
    if (!res.success || !res.data) {
       throw new Error(res.message || 'Template não encontrado.');
    }

    const { template, elements } = res.data;

    let html = `
      <h5 class="fw-bold text-primary mb-3"><i class="bi bi-person-fill"></i> ${utils.escapeHtml(paciente.nome)}</h5>
      <hr>
      <h6 class="fw-bold text-secondary mb-3"><i class="bi bi-file-medical"></i> ${utils.escapeHtml(template.DS_TEMPLATE || 'Triagem P.A.')}</h6>
      <form id="form-ehr-triagem" class="row g-3">
    `;

    // Renderiza campos dinamicamente
    elements.forEach(el => {
       const label = el.DS_LABEL || el.DS_LABEL_TELA || el.NM_ELEMENTO;
       if (!label) return; // ignora elementos sem identificação

       if (el.NR_SEQ_ELEMENTO === null || label === el.DS_LABEL) {
          if (!el.IE_COMPONENTE && !el.NR_SEQ_TIPO_DADO) {
            html += `<div class="col-12 mt-3 mb-2 border-bottom"><h6 class="text-primary mb-1">${utils.escapeHtml(label)}</h6></div>`;
            return;
          }
       }

       const isRequired = el.IE_OBRIGATORIO === 'S';
       const isTasyEntity = el.NR_SEQ_TIPO_DADO === 14;
       const isReadonly = el.IE_READONLY === 'S' && !isTasyEntity;
       const tamanho = el.QT_TAMANHO || 200;
       const isCheckbox = el.IE_COMPONENTE === 'cb';
       const isTextarea = tamanho > 100 || el.IE_COMPONENTE === 'me'; 
       
       let fieldHtml = '';
       if (isTasyEntity) {
          fieldHtml = `
            <div class="col-md-12 mb-2">
               <label class="form-label small fw-bold ${isRequired ? 'text-danger' : ''}">${utils.escapeHtml(label)} ${isRequired ? '*' : ''}</label>
               <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-diagram-3"></i></span>
                  <input type="text" class="form-control bg-white" name="elem_${el.NR_SEQUENCIA}_display" id="display_${el.NR_SEQUENCIA}" placeholder="Clique no botão para preencher: ${utils.escapeHtml(label)}" readonly ${isRequired ? 'required' : ''}>
                  <input type="hidden" name="fluxo_${el.NR_SEQUENCIA}" id="fluxo_${el.NR_SEQUENCIA}" value="">
                  <input type="hidden" name="fluxo_tipo_${el.NR_SEQUENCIA}" value="${utils.escapeHtml(label)}">
                  <button class="btn btn-outline-secondary" type="button" onclick="window.conectaCore.abrirFluxoNativo('${utils.escapeHtml(label)}', ${el.NR_SEQUENCIA})"><i class="bi bi-box-arrow-up-right"></i></button>
               </div>
            </div>
          `;
       } else if (isCheckbox) {
          fieldHtml = `
            <div class="col-md-3 col-sm-4 col-6 mb-2">
               <div class="form-check form-switch mt-1">
                  <input class="form-check-input" type="checkbox" name="elem_${el.NR_SEQUENCIA}" value="Sim" id="cb_${el.NR_SEQUENCIA}" ${isReadonly ? 'disabled' : ''}>
                  <label class="form-check-label small" for="cb_${el.NR_SEQUENCIA}">${utils.escapeHtml(label)}</label>
               </div>
            </div>
          `;
       } else if (isTextarea) {
          fieldHtml = `
            <div class="col-md-12 mb-2">
               <label class="form-label small fw-bold ${isRequired ? 'text-danger' : ''}">${utils.escapeHtml(label)} ${isRequired ? '*' : ''}</label>
               <textarea class="form-control" name="elem_${el.NR_SEQUENCIA}" rows="3" ${isRequired ? 'required' : ''} ${isReadonly ? 'readonly' : ''} maxlength="${tamanho}"></textarea>
            </div>
          `;
       } else {
          fieldHtml = `
            <div class="col-md-6 col-lg-4 mb-2">
               <label class="form-label small fw-bold text-truncate w-100 ${isRequired ? 'text-danger' : ''}" title="${utils.escapeHtml(label)}">${utils.escapeHtml(label)} ${isRequired ? '*' : ''}</label>
               <input type="text" class="form-control" name="elem_${el.NR_SEQUENCIA}" ${isRequired ? 'required' : ''} ${isReadonly ? 'readonly' : ''} maxlength="${tamanho}">
            </div>
          `;
       }

       html += fieldHtml;
    });

    html += `</form>`;
    container.innerHTML = html;

    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.onclick = async (e) => {
         e.preventDefault();
         const ehrForm = document.getElementById('form-ehr-triagem');
         if (ehrForm && !ehrForm.checkValidity()) {
            ehrForm.reportValidity();
            return;
         }
         
         const formData = new FormData(ehrForm);
         const payload = Object.fromEntries(formData.entries());

         ui.setLoading(btnConfirmar, true);
         try {
           const result = await api.post('/api/ehr/registro', {
              cd_pessoa_fisica: paciente.cdPf,
              nr_seq_template: template.NR_SEQUENCIA,
              campos: payload
           });
           
           if (result.success) {
              ui.showToast('Triagem salva e evolução gerada com sucesso!', 'success');
              const modalEl = document.getElementById('modal-triagem-identificacao');
              if (modalEl) {
                 const modal = bootstrap.Modal.getInstance(modalEl);
                 if (modal) modal.hide();
              }
              if (typeof carregarDashboard === 'function') carregarDashboard();
           } else {
              ui.showToast(result.message || 'Erro ao salvar EHR', 'error');
           }
         } catch(err) {
            ui.showToast(err.message, 'error');
         } finally {
            ui.setLoading(btnConfirmar, false);
         }
      };
    }
  } catch (err) {
    console.error("Erro ao carregar formulário da Triagem:", err);
    ui.showToast("Erro ao carregar o template clínico.", "error");
  }
};


async function salvarENovoAtendimentoTriagem() {
  const btn = document.getElementById('btn-triagem-salvar-paciente');
  const form = document.getElementById('form-triagem-novo-paciente');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const nome = document.getElementById('triagem-form-nome').value.trim();
  const cpf = document.getElementById('triagem-form-cpf').value.trim();
  const dtNasc = document.getElementById('triagem-form-nascimento').value;
  const sexo = document.getElementById('triagem-form-sexo').value;
  const mae = document.getElementById('triagem-form-mae').value.trim();
  const tel = document.getElementById('triagem-form-telefone').value.trim();

  ui.setLoading(btn, true);

  try {
    const payloadPessoa = {
      nm_pessoa_fisica: nome,
      dt_nascimento: dtNasc,
      ie_sexo: sexo,
      nr_cpf: cpf.replace(/\D/g, ''),
      nm_mae: mae,
      nr_telefone_celular: tel.replace(/\D/g, '')
    };

    const resPessoa = await api.post('/api/recepcao/pessoas', payloadPessoa);
    
    if (resPessoa.success && resPessoa.data && resPessoa.data.cd_pessoa_fisica) {
      ui.showToast('Paciente cadastrado rápido com sucesso!', 'success');
      await abrirAtendimentoTriagem(resPessoa.data.cd_pessoa_fisica);
    } else {
      ui.showToast(resPessoa.message || 'Erro ao cadastrar paciente', 'error');
    }
  } catch (err) {
    ui.showToast(err.message || 'Erro ao salvar paciente', 'error');
  } finally {
    ui.setLoading(btn, false);
  }
}

async function abrirAtendimentoTriagem(cdPessoaFisica) {
  try {
    const maquina = state.usuario?.nm_computador || 'NOTE-CESARIO';
    const payloadAtend = {
      cd_pessoa_fisica: cdPessoaFisica,
      cd_estabelecimento: 1,
      cd_setor_atendimento: 39, // P.A. Geral
      cd_procedencia: 1, // Recepcao Front
      ie_tipo_atendimento: 1, // Ambulatorial / PA
      ie_clinica: 1, 
      cd_motivo_atendimento: 1, 
      nr_seq_pac_senha_fila: senhaAtivaTriagem?.nrSeq || null,
      ds_maquina: maquina
    };

    const resAtend = await api.post('/api/recepcao/atendimentos', payloadAtend);
    
    if (resAtend.success && resAtend.data) {
      ui.showToast(`Triagem iniciada! Atend. ${resAtend.data.nr_atendimento} gerado.`, 'success');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modal-triagem-identificacao'));
      if (modal) modal.hide();

      // Forçar refresh da grade do Dashboard
      const btnRefresh = document.getElementById('btn-dashboard-internacao-refresh');
      if (btnRefresh) btnRefresh.click();
      
      // Forçar refresh das senhas
      carregarSenhasTriagem(false);
    } else {
      ui.showToast(resAtend.message || 'Erro ao abrir triagem', 'error');
    }
  } catch (err) {
    ui.showToast(err.message || 'Erro ao abrir triagem', 'error');
  }
}
