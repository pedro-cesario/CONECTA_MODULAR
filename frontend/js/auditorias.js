(() => {
  'use strict';

  const oportunidades = [
    ['ANTES_CONTATO_PACIENTE', 'Antes de contato com o paciente'],
    ['ANTES_PROCEDIMENTO_ASSEPTICO', 'Antes de procedimento asséptico'],
    ['APOS_FLUIDOS', 'Após contato com fluidos'],
    ['APOS_CONTATO_PACIENTE', 'Após contato com o paciente'],
    ['APOS_CONTATO_AMBIENTE', 'Após contato com o ambiente']
  ];
  let optionsLoaded = false;
  let auditId = null;
  let historicoModo = 'individual';

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  const appSections = () => document.querySelectorAll('.mode-selector, .livro-sub-menu, .livro-workspace, .app-container, .dashboard-workspace');
  const auditIds = ['auditorias-sub-menu', 'auditoria-higiene-sub-menu', 'workspace-auditoria-higiene-form', 'workspace-auditoria-historico'];

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) throw new Error(body.message || 'Não foi possível concluir a operação.');
    return body;
  }

  function hideAll() { appSections().forEach(section => section.classList.add('d-none')); }
  function show(id) { hideAll(); byId(id)?.classList.remove('d-none'); window.scrollTo(0, 0); }
  function message(text, type = 'error') {
    const feedback = byId('auditoria-feedback');
    if (!feedback) return;
    feedback.textContent = text;
    feedback.className = `auditoria-feedback ${type}`;
    feedback.classList.remove('d-none');
  }
  function clearMessage() { byId('auditoria-feedback')?.classList.add('d-none'); }
  function isoToday() { return new Date().toISOString().slice(0, 10); }

  function renderOportunidades() {
    const target = byId('auditoria-oportunidades');
    if (!target) return;
    target.innerHTML = oportunidades.map(([code, label]) => `<div class="auditoria-oportunidade">
      <span class="auditoria-oportunidade-label">${escapeHtml(label)} <span class="required-star">*</span></span>
      <div class="livro-turno-options">${[['A', 'Álcool', 'bi-droplet'], ['S', 'Sabonete', 'bi-hand-index-thumb'], ['P', 'Perdida', 'bi-x-circle']].map(([value, text, icon]) => `<label class="livro-turno-option"><input type="radio" name="auditoria-${code}" value="${value}"><span><i class="bi ${icon}"></i> ${text}</span></label>`).join('')}</div>
    </div>`).join('');
  }

  function fillSelect(id, rows, placeholder) {
    const select = byId(id);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + rows.map(row => `<option value="${Number(row.CD_SETOR_ATENDIMENTO || row.CD_PESSOA_FISICA)}">${escapeHtml(row.DS_SETOR_ATENDIMENTO || row.NOME || row.NM_USUARIO)}</option>`).join('');
  }

  async function loadOptions() {
    if (optionsLoaded) return;
    const result = await request('/api/auditorias/higiene-maos/opcoes');
    fillSelect('auditoria-setor', result.data.setores || [], 'Selecione...');
    fillSelect('auditoria-avaliador', result.data.avaliadores || [], 'Selecione...');
    fillSelect('auditoria-profissional', result.data.profissionais || [], 'Selecione...');
    optionsLoaded = true;
  }

  async function openForm() {
    show('workspace-auditoria-higiene-form');
    clearMessage();
    byId('auditoria-save-feedback')?.classList.add('d-none');
    byId('auditoria-data').value = isoToday();
    renderOportunidades();
    try { await loadOptions(); } catch (err) { message(err.message); }
  }

  function collectPayload() {
    const oportunidadesPayload = oportunidades.map(([code]) => ({
      ie_tipo_oportunidade: code,
      ie_resultado: document.querySelector(`input[name="auditoria-${code}"]:checked`)?.value || ''
    }));
    const payload = {
      dt_auditoria: byId('auditoria-data').value,
      cd_setor_atendimento: Number(byId('auditoria-setor').value),
      cd_avaliador: Number(byId('auditoria-avaliador').value),
      ie_turno: document.querySelector('input[name="auditoria-turno"]:checked')?.value || '',
      cd_profissional: Number(byId('auditoria-profissional').value),
      ds_observacao: byId('auditoria-observacoes').value,
      oportunidades: oportunidadesPayload
    };
    if (!payload.dt_auditoria || !payload.cd_setor_atendimento || !payload.cd_avaliador || !payload.ie_turno || !payload.cd_profissional || oportunidadesPayload.some(item => !item.ie_resultado)) {
      throw new Error('Preencha todos os campos obrigatórios e as cinco oportunidades.');
    }
    return payload;
  }

  async function save() {
    const button = byId('btn-auditoria-salvar');
    try {
      clearMessage();
      const payload = collectPayload();
      button.disabled = true;
      button.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
      const result = await request('/api/auditorias/higiene-maos', { method: 'POST', body: JSON.stringify(payload) });
      auditId = result.data.nr_sequencia;
      byId('auditoria-save-feedback')?.classList.remove('d-none');
      message(result.message || 'Auditoria salva com sucesso.', 'success');
    } catch (err) { message(err.message); }
    finally { button.disabled = false; button.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar'; }
  }

  function formatPercentual(conformes, total) {
    return total ? Math.round((conformes / total) * 100) : 0;
  }

  async function mostrarDetalheIndividual(id, target) {
    if (!target) return;
    target.innerHTML = '<div class="auditoria-detalhe-loading"><i class="bi bi-arrow-repeat spin"></i> Carregando dados individuais...</div>';
    target.classList.remove('d-none');
    try {
      const result = await request(`/api/auditorias/higiene-maos/${encodeURIComponent(id)}`);
      const auditoria = result.data;
      target.innerHTML = `<div class="auditoria-detalhe-grid"><span><strong>Data:</strong> ${escapeHtml(auditoria.DT_AUDITORIA)}</span><span><strong>Setor:</strong> ${escapeHtml(auditoria.NM_SETOR)}</span><span><strong>Avaliador:</strong> ${escapeHtml(auditoria.NM_AVALIADOR)}</span><span><strong>Profissional:</strong> ${escapeHtml(auditoria.NM_PROFISSIONAL)}</span></div><div class="auditoria-detalhe-oportunidades">${(auditoria.oportunidades || []).map(item => `<span>${escapeHtml(item.oportunidade_label)}<strong>${escapeHtml(item.resultado_label)} · ${item.conforme ? 'Conforme' : 'Não conforme'}</strong></span>`).join('')}</div>${auditoria.DS_OBSERVACAO ? `<p class="auditoria-detalhe-obs"><strong>Observações:</strong> ${escapeHtml(auditoria.DS_OBSERVACAO)}</p>` : ''}`;
    } catch (err) { target.innerHTML = `<div class="auditoria-feedback">${escapeHtml(err.message)}</div>`; }
  }

  function renderHistoricoIndividual(rows, list) {
    list.innerHTML = rows.map(row => {
      const total = Number(row.TOTAL_OPORTUNIDADES || 0); const conformes = Number(row.OPORTUNIDADES_CONFORMES || 0);
      const percentual = formatPercentual(conformes, total);
      const id = Number(row.NR_SEQUENCIA);
      return `<article class="auditoria-historico-item"><div><strong>${escapeHtml(row.DT_AUDITORIA)}</strong><span>${escapeHtml(row.NM_SETOR)}</span><small>Avaliador: ${escapeHtml(row.NM_AVALIADOR)} · Profissional: ${escapeHtml(row.NM_PROFISSIONAL)} · ${row.IE_TURNO === 'N' ? 'Noite' : 'Dia'}</small></div><div class="auditoria-historico-actions"><span class="auditoria-result">${conformes}/${total} conformes · ${percentual}%</span><button class="btn-secondary" type="button" data-view="${id}"><i class="bi bi-eye"></i> Ver dados</button><button class="btn-secondary" type="button" data-xlsx="${id}"><i class="bi bi-file-earmark-excel"></i> XLSX</button><button class="btn-secondary" type="button" data-pdf="${id}"><i class="bi bi-file-earmark-pdf"></i> PDF</button></div><div class="auditoria-detalhe d-none" data-detail="${id}"></div></article>`;
    }).join('');
    list.querySelectorAll('[data-xlsx]').forEach(button => button.addEventListener('click', () => download(button.dataset.xlsx, 'xlsx')));
    list.querySelectorAll('[data-pdf]').forEach(button => button.addEventListener('click', () => download(button.dataset.pdf, 'pdf')));
    list.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      const detail = list.querySelector(`[data-detail="${button.dataset.view}"]`);
      if (detail?.classList.contains('d-none')) mostrarDetalheIndividual(button.dataset.view, detail);
      else detail?.classList.add('d-none');
    }));
  }

  function renderHistoricoConsolidado(rows, list) {
    list.innerHTML = rows.map(row => {
      const total = Number(row.TOTAL_OPORTUNIDADES || 0); const conformes = Number(row.OPORTUNIDADES_CONFORMES || 0);
      return `<article class="auditoria-historico-item auditoria-historico-consolidado"><div><strong>${escapeHtml(row.DT_AUDITORIA)} · ${escapeHtml(row.NM_SETOR)}</strong><small>Avaliador: ${escapeHtml(row.NM_AVALIADOR)} · ${row.IE_TURNO === 'N' ? 'Noite' : 'Dia'} · ${Number(row.TOTAL_AUDITORIAS)} auditoria(s)</small></div><div class="auditoria-consolidado-metricas"><span><strong>${total}</strong> oportunidades</span><span><strong>${Number(row.TOTAL_ALCOOL || 0)}</strong> álcool</span><span><strong>${Number(row.TOTAL_SABONETE || 0)}</strong> sabonete</span><span><strong>${Number(row.TOTAL_PERDIDAS || 0)}</strong> perdidas</span><span class="auditoria-result"><strong>${formatPercentual(conformes, total)}%</strong> adesão</span></div></article>`;
    }).join('');
  }

  async function loadHistorico(modo = historicoModo) {
    historicoModo = modo;
    show('workspace-auditoria-historico');
    const list = byId('auditoria-historico-list');
    byId('btn-auditoria-visao-individual')?.classList.toggle('active', modo === 'individual');
    byId('btn-auditoria-visao-consolidada')?.classList.toggle('active', modo === 'consolidado');
    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando auditorias...</div>';
    try {
      const result = await request(modo === 'consolidado' ? '/api/auditorias/higiene-maos/historico/consolidado' : '/api/auditorias/higiene-maos/historico');
      const rows = result.data || [];
      if (!rows.length) { list.innerHTML = '<div class="loading-placeholder">Nenhuma auditoria de Higiene de Mãos encontrada.</div>'; return; }
      if (modo === 'consolidado') renderHistoricoConsolidado(rows, list);
      else renderHistoricoIndividual(rows, list);
    } catch (err) { list.innerHTML = `<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> ${escapeHtml(err.message)}</div>`; }
  }

  function download(id, extension) { window.location.assign(`/api/auditorias/higiene-maos/${encodeURIComponent(id)}/${extension}`); }
  function showAuditorias() { show('auditorias-sub-menu'); }
  function showHigieneMenu() { show('auditoria-higiene-sub-menu'); }

  async function refreshAccess() {
    try {
      const [me, modules] = await Promise.all([request('/api/me'), request('/api/modulos')]);
      const perfil = me.data?.perfilAtivo || me.data?.usuario?.perfilAtivo;
      const module = (modules.data || []).find(item => item.id === 'auditorias');
      const allowed = Boolean(module?.perfisPermitidos?.map(String).includes(String(perfil)));
      byId('btn-abrir-auditorias')?.classList.toggle('d-none', !allowed);
      byId('nav-auditorias')?.classList.toggle('d-none', !allowed);
    } catch (_) { byId('btn-abrir-auditorias')?.classList.add('d-none'); byId('nav-auditorias')?.classList.add('d-none'); }
  }

  byId('btn-abrir-auditorias')?.addEventListener('click', showAuditorias);
  byId('nav-auditorias')?.addEventListener('click', showAuditorias);
  byId('btn-auditorias-voltar-home')?.addEventListener('click', () => { hideAll(); byId('mode-selector')?.classList.remove('d-none'); });
  byId('btn-auditorias-higiene-maos')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-higiene-voltar')?.addEventListener('click', showAuditorias);
  byId('btn-auditoria-nova')?.addEventListener('click', openForm);
  byId('btn-auditoria-historico')?.addEventListener('click', loadHistorico);
  byId('btn-auditoria-visao-individual')?.addEventListener('click', () => loadHistorico('individual'));
  byId('btn-auditoria-visao-consolidada')?.addEventListener('click', () => loadHistorico('consolidado'));
  byId('btn-auditoria-form-voltar')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-cancelar')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-salvar')?.addEventListener('click', save);
  byId('btn-auditoria-historico-voltar')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-baixar-xlsx')?.addEventListener('click', () => auditId && download(auditId, 'xlsx'));
  byId('btn-auditoria-baixar-pdf')?.addEventListener('click', () => auditId && download(auditId, 'pdf'));

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.id.includes('auditoria') || button.id === 'btn-abrir-auditorias' || button.id === 'nav-auditorias') return;
    if (button.closest('#topbar-nav') || button.closest('.mode-grid') || button.id === 'topbar-brand') auditIds.forEach(id => byId(id)?.classList.add('d-none'));
  });
  document.addEventListener('click', event => { if (event.target.closest('#user-profile-menu')) setTimeout(refreshAccess, 250); });
  setTimeout(refreshAccess, 250);
})();
