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
  const auditIds = ['auditorias-sub-menu', 'auditoria-higiene-sub-menu', 'workspace-auditoria-higiene-form', 'workspace-auditoria-historico', 'auditoria-processos-sub-menu', 'workspace-auditoria-processos-paciente', 'workspace-auditoria-processos-form', 'workspace-auditoria-processos-historico'];

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

  const modeMap = {
    'auditorias-sub-menu': 'auditorias-submenu',
    'auditoria-higiene-sub-menu': 'auditoria-higiene-submenu',
    'workspace-auditoria-higiene-form': 'auditoria-higiene-form',
    'workspace-auditoria-historico': 'auditoria-historico',
    'auditoria-processos-sub-menu': 'auditoria-processos-submenu',
    'workspace-auditoria-processos-paciente': 'auditoria-processos-paciente',
    'workspace-auditoria-processos-form': 'auditoria-processos-form',
    'workspace-auditoria-processos-historico': 'auditoria-processos-historico'
  };

  function hideAll() { appSections().forEach(section => section.classList.add('d-none')); }
  function show(id) {
    const target = byId(id);
    if (!target) return;
    const mode = modeMap[id] || 'auditorias-submenu';
    if (window.conectaApp && typeof window.conectaApp.activateWorkspace === 'function') {
      window.conectaApp.activateWorkspace(mode, target);
    } else {
      hideAll();
      target.classList.remove('d-none');
    }
    window.scrollTo(0, 0);
  }
  function message(text, type = 'error') {
    const overlay = byId('modal-overlay');
    if (!overlay) {
      alert(text);
      return;
    }
    const iconEl = byId('modal-icon');
    const titleEl = byId('modal-title');
    const msgEl = byId('modal-message');

    if (iconEl) {
      iconEl.className = 'modal-icon ' + type;
      iconEl.style.color = '';
      iconEl.style.background = '';
      if (type === 'success') {
        iconEl.innerHTML = '<i class="bi bi-check-lg"></i>';
      } else if (type === 'warning') {
        iconEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
      } else {
        iconEl.innerHTML = '<i class="bi bi-x-lg"></i>';
      }
    }
    if (titleEl) {
      titleEl.textContent = type === 'success' ? 'Sucesso!' : type === 'warning' ? 'Atenção' : 'Atenção';
    }
    if (msgEl) msgEl.textContent = text;

    overlay.classList.remove('d-none');
    document.body.classList.add('modal-open');
    const close = () => {
      overlay.classList.add('d-none');
      document.body.classList.remove('modal-open');
    };
    const closeBtn = byId('modal-close');
    if (closeBtn) closeBtn.onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
  }
  function clearMessage() {
    byId('auditoria-feedback')?.classList.add('d-none');
    const overlay = byId('modal-overlay');
    if (overlay && !overlay.classList.contains('d-none')) {
      overlay.classList.add('d-none');
      document.body.classList.remove('modal-open');
    }
  }
  function isoToday() { return new Date().toISOString().slice(0, 10); }

  function renderOportunidades() {
    const target = byId('auditoria-oportunidades');
    if (!target) return;
    target.innerHTML = oportunidades.map(([code, label], index) => `<div class="auditoria-oportunidade-card">
      <div class="auditoria-oportunidade-header">
        <span class="auditoria-moment-badge"><i class="bi bi-shield-check"></i> Momento ${index + 1}</span>
        <span class="auditoria-oportunidade-label">${escapeHtml(label)} <span class="required-star">*</span></span>
      </div>
      <div class="livro-turno-options">${[['A', 'Álcool', 'bi-droplet-fill', 'opt-alcool'], ['S', 'Sabonete', 'bi-hand-index-thumb-fill', 'opt-sabonete'], ['P', 'Perdida', 'bi-x-circle-fill', 'opt-perdida']].map(([value, text, icon, cls]) => `<label class="livro-turno-option"><input type="radio" name="auditoria-${code}" value="${value}" class="${cls}"><span><i class="bi ${icon}"></i> ${text}</span></label>`).join('')}</div>
    </div>`).join('');
  }

  function fillSelect(id, rows, placeholder) {
    const select = byId(id);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + rows.map(row => `<option value="${Number(row.CD_SETOR_ATENDIMENTO || row.CD_PESSOA_FISICA)}">${escapeHtml(row.DS_SETOR_ATENDIMENTO || row.NOME || row.NM_USUARIO)}</option>`).join('');
  }

  async function loadOptions() {
    if (optionsLoaded) return;
    const result = await request('/api/auditorias/higiene-maos/opcoes?_=' + Date.now());
    fillSelect('auditoria-setor', result.data.setores || [], 'Selecione...');
    fillSelect('auditoria-avaliador', result.data.avaliadores || [], 'Selecione...');
    const select = byId('auditoria-profissional');
    if (select) {
      select.innerHTML = '<option value="">Selecione...</option>' + (result.data.profissionais || []).map(row => `<option value="${escapeHtml(row.DS_VALOR_DOMINIO)}">${escapeHtml(row.DS_VALOR_DOMINIO)}</option>`).join('');
    }
    optionsLoaded = true;
  }

  function clearForm() {
    byId('auditoria-data').value = isoToday();
    const setor = byId('auditoria-setor');
    if (setor) setor.value = '';
    const avaliador = byId('auditoria-avaliador');
    if (avaliador) avaliador.value = '';
    const prof = byId('auditoria-profissional');
    if (prof) prof.value = '';
    const obs = byId('auditoria-observacoes');
    if (obs) obs.value = '';
    document.querySelectorAll('#auditoria-oportunidades input[type="radio"]').forEach(r => { r.checked = false; });
    window.conectaApp?.clearModuleDraft?.('auditorias');
  }

  async function openForm() {
    show('workspace-auditoria-higiene-form');
    clearMessage();
    renderOportunidades();
    clearForm();
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
      ie_turno: new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'D' : 'N',
      cd_profissional: byId('auditoria-profissional').value,
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
      clearForm();
      message(result.message || 'Auditoria salva com sucesso.', 'success');
    } catch (err) {
      message(err.message || 'Erro ao salvar auditoria.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar';
    }
  }

  function formatPercentual(conformes, total) {
    return total ? Math.round((conformes / total) * 100) : 0;
  }

    function getComplianceBadge(percentual) {
    if (percentual >= 80) return `<span class="auditoria-result-badge compliance-high"><i class="bi bi-check-circle-fill"></i> ${percentual}% Adesão</span>`;
    if (percentual >= 50) return `<span class="auditoria-result-badge compliance-medium"><i class="bi bi-exclamation-triangle-fill"></i> ${percentual}% Adesão</span>`;
    return `<span class="auditoria-result-badge compliance-low"><i class="bi bi-x-circle-fill"></i> ${percentual}% Adesão</span>`;
  }

  async function mostrarDetalheIndividual(id, target) {
    if (!target) return;
    target.innerHTML = '<div class="auditoria-detalhe-loading"><i class="bi bi-arrow-repeat spin"></i> Carregando dados individuais...</div>';
    target.classList.remove('d-none');
    try {
      const result = await request(`/api/auditorias/higiene-maos/${encodeURIComponent(id)}`);
      const auditoria = result.data;
      target.innerHTML = `<div class="auditoria-detalhe-grid"><span><strong>Data:</strong> ${escapeHtml(auditoria.DT_AUDITORIA)}</span><span><strong>Setor:</strong> ${escapeHtml(auditoria.NM_SETOR)}</span><span><strong>Avaliador:</strong> ${escapeHtml(auditoria.NM_AVALIADOR)}</span><span><strong>Profissional:</strong> ${escapeHtml(auditoria.NM_PROFISSIONAL)}</span></div><div class="auditoria-detalhe-oportunidades">${(auditoria.oportunidades || []).map(item => `<span class="${item.conforme ? 'conforme' : 'nao-conforme'}">${escapeHtml(item.oportunidade_label)}<strong>${escapeHtml(item.resultado_label)} · ${item.conforme ? 'Conforme' : 'Não conforme'}</strong></span>`).join('')}</div>${auditoria.DS_OBSERVACAO ? `<p class="auditoria-detalhe-obs"><strong>Observações:</strong> ${escapeHtml(auditoria.DS_OBSERVACAO)}</p>` : ''}`;
    } catch (err) { target.innerHTML = `<div class="auditoria-feedback">${escapeHtml(err.message)}</div>`; }
  }

  function renderHistoricoIndividual(rows, list) {
    list.innerHTML = rows.map(row => {
      const total = Number(row.TOTAL_OPORTUNIDADES || 0); const conformes = Number(row.OPORTUNIDADES_CONFORMES || 0);
      const percentual = formatPercentual(conformes, total);
      const id = Number(row.NR_SEQUENCIA);
      const badgeHtml = getComplianceBadge(percentual);
      return `<article class="auditoria-historico-item"><div class="auditoria-historico-info"><div class="auditoria-historico-meta-header"><span class="auditoria-date-badge"><i class="bi bi-calendar-event"></i> ${escapeHtml(row.DT_AUDITORIA)}</span><span class="auditoria-setor-badge"><i class="bi bi-hospital"></i> ${escapeHtml(row.NM_SETOR)}</span><span class="auditoria-turno-badge"><i class="bi ${row.IE_TURNO === 'N' ? 'bi-moon' : 'bi-sun'}"></i> ${row.IE_TURNO === 'N' ? 'Noite' : 'Dia'}</span></div><small class="auditoria-historico-people"><strong>Avaliador:</strong> ${escapeHtml(row.NM_AVALIADOR)} &nbsp;·&nbsp; <strong>Profissional:</strong> ${escapeHtml(row.NM_PROFISSIONAL)}</small></div><div class="auditoria-historico-actions"><div class="auditoria-result-group">${badgeHtml} <span class="auditoria-count-label">${conformes}/${total} conformes</span></div><div class="auditoria-btn-group"><button class="btn-secondary btn-sm" type="button" data-view="${id}"><i class="bi bi-eye"></i> Detalhes</button><button class="btn-secondary btn-sm" type="button" data-xlsx="${id}"><i class="bi bi-file-earmark-excel"></i> XLSX</button><button class="btn-secondary btn-sm" type="button" data-pdf="${id}"><i class="bi bi-file-earmark-pdf"></i> PDF</button></div></div><div class="auditoria-detalhe d-none" data-detail="${id}"></div></article>`;
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
      const percentual = formatPercentual(conformes, total);
      const badgeHtml = getComplianceBadge(percentual);
      return `<article class="auditoria-historico-item auditoria-historico-consolidado"><div class="auditoria-historico-info"><div class="auditoria-historico-meta-header"><span class="auditoria-date-badge"><i class="bi bi-calendar-event"></i> ${escapeHtml(row.DT_AUDITORIA)}</span><span class="auditoria-setor-badge"><i class="bi bi-hospital"></i> ${escapeHtml(row.NM_SETOR)}</span><span class="auditoria-turno-badge"><i class="bi ${row.IE_TURNO === 'N' ? 'bi-moon' : 'bi-sun'}"></i> ${row.IE_TURNO === 'N' ? 'Noite' : 'Dia'}</span></div><small class="auditoria-historico-people"><strong>Avaliador:</strong> ${escapeHtml(row.NM_AVALIADOR)} &nbsp;·&nbsp; ${Number(row.TOTAL_AUDITORIAS)} auditoria(s)</small></div><div class="auditoria-consolidado-metricas"><span><strong>${total}</strong> ops</span><span><strong>${Number(row.TOTAL_ALCOOL || 0)}</strong> álcool</span><span><strong>${Number(row.TOTAL_SABONETE || 0)}</strong> sabonete</span><span><strong>${Number(row.TOTAL_PERDIDAS || 0)}</strong> perdidas</span>${badgeHtml}</div></article>`;
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

  // --- Sistema de Draft para Auditorias ---
  function captureAuditoriaDraft() {
    // Descobre qual tela está visível no momento
    const activeScreen = auditIds.find(id => !byId(id)?.classList.contains('d-none'));
    if (!activeScreen) return null;

    const draft = { activeScreen, historicoModo };

    // Se o formulário estiver aberto, salva os dados preenchidos
    if (activeScreen === 'workspace-auditoria-higiene-form') {
      draft.form = {
        data: byId('auditoria-data')?.value || '',
        setor: byId('auditoria-setor')?.value || '',
        avaliador: byId('auditoria-avaliador')?.value || '',
        turno: new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'D' : 'N',
        profissional: byId('auditoria-profissional')?.value || '',
        observacoes: byId('auditoria-observacoes')?.value || '',
        oportunidades: oportunidades.map(([code]) => ({
          code,
          value: document.querySelector(`input[name="auditoria-${code}"]:checked`)?.value || ''
        }))
      };
    }
    return draft;
  }

  function hydrateAuditoriaDraft(draft) {
    if (!draft?.activeScreen) return;
    show(draft.activeScreen);

    if (draft.activeScreen === 'workspace-auditoria-higiene-form' && draft.form) {
      const f = draft.form;
      renderOportunidades();
      // Restaura valores básicos
      if (byId('auditoria-data') && f.data) byId('auditoria-data').value = f.data;
      if (byId('auditoria-observacoes')) byId('auditoria-observacoes').value = f.observacoes || '';
      // Restaura seleções (setores/avaliador/profissional podem precisar estar carregados)
      loadOptions().then(() => {
        if (f.setor) byId('auditoria-setor').value = f.setor;
        if (f.avaliador) byId('auditoria-avaliador').value = f.avaliador;
        if (f.profissional) byId('auditoria-profissional').value = f.profissional;
        // turno auto-detectado pelo horário, sem campo visual
        (f.oportunidades || []).forEach(({ code, value }) => {
          if (value) { const el = document.querySelector(`input[name="auditoria-${code}"][value="${value}"]`); if (el) el.checked = true; }
        });
      }).catch(() => {});
    } else if (draft.activeScreen === 'workspace-auditoria-historico') {
      loadHistorico(draft.historicoModo || 'individual');
    }
  }

  // Expõe no window para o app.js usar
  window.captureAuditoriaDraft = captureAuditoriaDraft;
  window.hydrateAuditoriaDraft = hydrateAuditoriaDraft;

  // Ao abrir Auditorias via nav, verifica se há draft e restaura a tela
  function showAuditorias() {
    const draft = typeof window.conectaApp?.getModuleDraft === 'function'
      ? window.conectaApp.getModuleDraft('auditorias')
      : null;
    if (draft?.activeScreen) {
      hydrateAuditoriaDraft(draft);
    } else {
      show('auditorias-sub-menu');
    }
  }

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
  byId('btn-auditorias-voltar-home')?.addEventListener('click', () => { if (window.conectaApp?.showModeChooser) { window.conectaApp.showModeChooser(); } else { hideAll(); byId('mode-selector')?.classList.remove('d-none'); } });
  byId('btn-auditorias-higiene-maos')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-higiene-maos')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-higiene-voltar')?.addEventListener('click', showAuditorias);
  byId('btn-auditoria-nova')?.addEventListener('click', openForm);
  byId('btn-auditoria-historico')?.addEventListener('click', loadHistorico);
  byId('btn-auditoria-visao-individual')?.addEventListener('click', () => loadHistorico('individual'));
  byId('btn-auditoria-visao-consolidada')?.addEventListener('click', () => loadHistorico('consolidado'));
  byId('btn-auditoria-form-voltar')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-ver-historico')?.addEventListener('click', () => loadHistorico());
  byId('btn-auditoria-cancelar')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-salvar')?.addEventListener('click', save);
  byId('btn-auditoria-historico-voltar')?.addEventListener('click', showHigieneMenu);
  byId('btn-auditoria-baixar-xlsx')?.addEventListener('click', () => auditId && download(auditId, 'xlsx'));
  byId('btn-auditoria-baixar-pdf')?.addEventListener('click', () => auditId && download(auditId, 'pdf'));

  // ─── Auditoria de Processos ──────────────────────────────────────────────
  const METAS_PROCESSOS = [
    {
      id: 'M01', label: 'Meta 01 - Identificação do paciente',
      subgrupos: [
        {
          id: 'pulseira', label: 'Pulseira ou etiqueta de identificação',
          itens: [
            { id: 'pulseira_identificacao', label: 'O paciente está com pulseira de identificação?' },
            { id: 'pulseira_extra', label: 'Há 01 uma pulseira extra no prontuário?' }
          ]
        },
        {
          id: 'beira_leito', label: 'Identificação à beira leito',
          itens: [
            { id: 'beira_leito_preenchida', label: 'A identificação à beira leito está preenchida?' }
          ]
        },
        {
          id: 'riscos_identificacao', label: 'Riscos assistenciais (identificação)',
          itens: [
            { id: 'r_alergia_id', label: 'Alergia' },
            { id: 'r_queda_id', label: 'Queda' },
            { id: 'r_autoagressao_id', label: 'Autoagressão ou Heteroagressão' },
            { id: 'r_evasao_id', label: 'Evasão' },
            { id: 'r_autoexterminio_id', label: 'Autoextermínio' },
            { id: 'r_broncoaspiracao_id', label: 'Broncoaspiração' }
          ]
        },
        {
          id: 'riscos_tasy', label: 'Riscos assistenciais gerenciados no alerta do Tasy',
          itens: [
            { id: 'r_alergia_tasy', label: 'Alergia' },
            { id: 'r_queda_tasy', label: 'Queda' },
            { id: 'r_autoagressao_tasy', label: 'Autoagressão ou Heteroagressão' },
            { id: 'r_evasao_tasy', label: 'Evasão' },
            { id: 'r_autoexterminio_tasy', label: 'Autoextermínio' },
            { id: 'r_broncoaspiracao_tasy', label: 'Broncoaspiração' }
          ]
        },
        {
          id: 'interconsulta', label: 'Interconsulta',
          itens: [
            { id: 'snd_interconsulta', label: 'Foi realizada interconsulta com SND?' }
          ]
        }
      ]
    },
    {
      id: 'M02', label: 'Meta 02 - Comunicação efetiva',
      subgrupos: [
        {
          id: 'comunicacao', label: 'Comunicação',
          itens: [
            { id: 'transicao_cuidados', label: 'A transição de cuidados está preenchida no Tasy?' },
            { id: 'qualidade_informacoes', label: 'A qualidade das informações está adequada?' }
          ]
        }
      ]
    },
    {
      id: 'M03', label: 'Meta 03 - Segurança medicamentosa',
      subgrupos: [
        {
          id: 'medicacao', label: 'Medicação',
          itens: [
            { id: 'alerta_alergia', label: 'O alerta de alergia está preenchido no Tasy?' },
            { id: 'medicacoes_checadas', label: 'As medicações estão checadas?' }
          ]
        }
      ]
    },
    {
      id: 'M04', label: 'Meta 04 - Procedimento seguro',
      subgrupos: [
        {
          id: 'ect_info', label: 'ECT',
          itens: [
            { id: 'ect_info_texto', label: 'Auditoria é realizada em FO específico', type: 'info' }
          ]
        }
      ]
    },
    {
      id: 'M05', label: 'Meta 05 - Prevenção de IRAS',
      subgrupos: [
        {
          id: 'iras_info', label: 'IRAS',
          itens: [
            { id: 'iras_info_texto', label: 'Auditoria é realizada em FO específico', type: 'info' }
          ]
        }
      ]
    },
    {
      id: 'M06', label: 'Meta 06 - Prevenção de quedas e lesão por pressão',
      subgrupos: [
        {
          id: 'quedas', label: 'Proteção física',
          itens: [
            { id: 'grades_protecao', label: 'A cama possui grades de proteção?' },
            { id: 'barras_banheiro', label: 'No banheiro há barras de proteção?' },
            { id: 'risco_lpp_tasy', label: 'O paciente possui risco de LPP? Tasy' }
          ]
        }
      ]
    },
    {
      id: 'M07', label: 'Meta 07 - Prevenção de autoextermínio',
      subgrupos: [
        {
          id: 'autoexterm', label: 'Acompanhamento diário in loco e via prontuário',
          itens: [
            { id: 'incidentes_ea', label: 'Durante a internação, houve algum incidentes ou EAs?' }
          ]
        }
      ]
    }
  ];

  function renderMetasProcessos() {
    const container = byId('proc-metas-container');
    if (!container) return;
    container.innerHTML = METAS_PROCESSOS.map(meta => {
      const subgruposHtml = meta.subgrupos.map(sub => {
        const itensHtml = sub.itens.map(item => {
          if (item.type === 'info') {
            return `<div class="auditoria-pergunta-item auditoria-info-item">
              <span class="auditoria-pergunta-texto">${escapeHtml(item.label)}</span>
              <span class="auditoria-info-badge"><i class="bi bi-info-circle"></i> Formulário específico</span>
            </div>`;
          }
          return `<div class="auditoria-pergunta-item">
            <span class="auditoria-pergunta-texto">${escapeHtml(item.label)}</span>
            <div class="livro-turno-options">
              <label class="livro-turno-option"><input type="radio" name="proc-${meta.id}-${item.id}" value="S"><span><i class="bi bi-check-circle"></i> Sim</span></label>
              <label class="livro-turno-option"><input type="radio" name="proc-${meta.id}-${item.id}" value="N"><span><i class="bi bi-x-circle"></i> Não</span></label>
              <label class="livro-turno-option"><input type="radio" name="proc-${meta.id}-${item.id}" value="NA"><span><i class="bi bi-dash-circle"></i> NA</span></label>
            </div>
          </div>`;
        }).join('');
        return `<div class="auditoria-subgrupo">
          <div class="auditoria-subgrupo-label">${escapeHtml(sub.label)}</div>
          ${itensHtml}
        </div>`;
      }).join('');

      // M07 has extra textarea for description
      const extraHtml = meta.id === 'M07' ? `<div class="auditoria-descricao-extra">
        <label for="proc-desc-incidentes">Descrição</label>
        <textarea id="proc-desc-incidentes" rows="3" placeholder="Descreva os incidentes ou EAs observados."></textarea>
      </div>` : '';

      return `<div class="livro-section auditoria-section">
        <div class="livro-section-header"><span><i class="bi bi-flag"></i> ${escapeHtml(meta.label)}</span></div>
        <div class="livro-section-body">${subgruposHtml}${extraHtml}</div>
      </div>`;
    }).join('');
  }

  function calcularIdade(dtNascimento) {
    if (!dtNascimento) return '';
    const nasc = new Date(dtNascimento);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade >= 0 ? idade : '';
  }

  let optionsProcessosLoaded = false;
  let auditProcessosId = null;
  let historicoProcessosModo = 'individual';

  async function loadOptionsProcessos() {
    if (optionsProcessosLoaded) return;
    const result = await request('/api/auditorias/processos/opcoes?_=' + Date.now());
    fillSelect('proc-setor', result.data.setores || [], 'Selecione...');
    fillSelect('proc-avaliador', result.data.avaliadores || [], 'Selecione...');
    optionsProcessosLoaded = true;
  }

  function clearFormProcessos() {
    byId('proc-nm-paciente').value = '';
    byId('proc-dt-nascimento').value = '';
    byId('proc-nr-idade').value = '';
    byId('proc-dt-admissao').value = '';
    byId('proc-unidade-leito').value = '';
    byId('proc-nr-atendimento').value = '';
    byId('proc-dt-auditoria').value = isoToday();
    byId('proc-observacoes').value = '';
    const setor = byId('proc-setor');
    if (setor) setor.value = '';
    const avaliador = byId('proc-avaliador');
    if (avaliador) avaliador.value = '';
    document.querySelectorAll('#workspace-auditoria-processos-form input[type="radio"]').forEach(r => { r.checked = false; });
    const desc = byId('proc-desc-incidentes');
    if (desc) desc.value = '';
    window.conectaApp?.clearModuleDraft?.('auditorias');
  }

  function formatarDataBR(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  }

  function formatarIdade(idade) {
    if (idade == null || idade === '') return '-';
    return `${idade} anos`;
  }

  function renderPacientesOntem(pacientes) {
    const list = byId('proc-pacientes-ontem-list');
    if (!list) return;
    if (!pacientes || pacientes.length === 0) {
      list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-person-x"></i> Nenhum paciente internado ontem encontrado.</div>';
      return;
    }
    list.innerHTML = pacientes.map(p => {
      const nome = escapeHtml(String(p.NM_PACIENTE || '').trim());
      const idade = formatarIdade(p.IDADE);
      const leito = escapeHtml(String(p.UNIDADE_LEITO || '').trim());
      const atendimento = escapeHtml(String(p.NR_ATENDIMENTO || '').trim());
      const admissao = formatarDataBR(p.ADMISSAO);
      return `<div class="auditoria-paciente-card" data-nm="${escapeHtml(p.NM_PACIENTE || '')}" data-dtnasc="${escapeHtml(String(p.DT_NASCIMENTO || '').slice(0, 10))}" data-idade="${p.IDADE != null ? p.IDADE : ''}" data-admissao="${escapeHtml(String(p.ADMISSAO || '').slice(0, 10))}" data-leito="${escapeHtml(p.UNIDADE_LEITO || '')}" data-atend="${escapeHtml(String(p.NR_ATENDIMENTO || ''))}">
        <div class="auditoria-paciente-card-icon"><i class="bi bi-person"></i></div>
        <div class="auditoria-paciente-info">
          <div class="paciente-name">${nome}</div>
          <div class="paciente-meta">
            <span><i class="bi bi-calendar3"></i> ${idade}</span>
            <span><i class="bi bi-hospital"></i> ${leito}</span>
            <span><i class="bi bi-hash"></i> ${atendimento}</span>
            <span><i class="bi bi-calendar-check"></i> Admissão: ${admissao}</span>
          </div>
        </div>
        <i class="bi bi-arrow-up-right" style="color: var(--slate-400); font-size: 1.1rem;"></i>
      </div>`;
    }).join('');
    list.querySelectorAll('.auditoria-paciente-card').forEach(card => {
      card.addEventListener('click', () => {
        preencherFormComPaciente({
          NM_PACIENTE: card.dataset.nm,
          DT_NASCIMENTO: card.dataset.dtnasc,
          IDADE: card.dataset.idade,
          ADMISSAO: card.dataset.admissao,
          UNIDADE_LEITO: card.dataset.leito,
          NR_ATENDIMENTO: card.dataset.atend
        });
      });
    });
  }

  function preencherFormComPaciente(paciente) {
    clearFormProcessos();
    byId('proc-dt-auditoria').value = isoToday();
    if (paciente.NM_PACIENTE) byId('proc-nm-paciente').value = paciente.NM_PACIENTE;
    if (paciente.DT_NASCIMENTO) {
      const dtnasc = String(paciente.DT_NASCIMENTO).slice(0, 10);
      byId('proc-dt-nascimento').value = dtnasc;
    }
    if (paciente.IDADE != null && paciente.IDADE !== '') {
      byId('proc-nr-idade').value = paciente.IDADE;
    } else if (byId('proc-dt-nascimento').value) {
      byId('proc-nr-idade').value = calcularIdade(byId('proc-dt-nascimento').value);
    }
    if (paciente.ADMISSAO) {
      const admissao = String(paciente.ADMISSAO).slice(0, 10);
      byId('proc-dt-admissao').value = admissao;
    }
    if (paciente.UNIDADE_LEITO) byId('proc-unidade-leito').value = paciente.UNIDADE_LEITO;
    if (paciente.NR_ATENDIMENTO) byId('proc-nr-atendimento').value = String(paciente.NR_ATENDIMENTO);
    show('workspace-auditoria-processos-form');
    renderMetasProcessos();
    byId('proc-dt-nascimento')?.addEventListener('change', () => {
      byId('proc-nr-idade').value = calcularIdade(byId('proc-dt-nascimento').value);
    });
    loadOptionsProcessos().catch(() => {});
  }

  async function openFormProcessos() {
    show('workspace-auditoria-processos-paciente');
    clearMessage();
    clearFormProcessos();
    const list = byId('proc-pacientes-ontem-list');
    if (list) list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando pacientes...</div>';
    try {
      const result = await request('/api/auditorias/processos/pacientes-ontem?_=' + Date.now());
      renderPacientesOntem(result.data || []);
    } catch (err) {
      if (list) list.innerHTML = `<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> ${escapeHtml(err.message)}</div>`;
    }
  }

  async function abrirPacienteAleatorio() {
    const list = byId('proc-pacientes-ontem-list');
    try {
      const result = await request('/api/auditorias/processos/paciente-aleatorio?_=' + Date.now());
      if (result.data) {
        preencherFormComPaciente(result.data);
      } else {
        message('Nenhum paciente internado encontrado.', 'warning');
      }
    } catch (err) {
      message(err.message || 'Erro ao buscar paciente.', 'error');
    }
  }

  function collectPayloadProcessos() {
    const respostas = [];
    METAS_PROCESSOS.forEach(meta => {
      meta.subgrupos.forEach(sub => {
        sub.itens.forEach(item => {
          if (item.type === 'info') return;
          const nome = `proc-${meta.id}-${item.id}`;
          const checked = document.querySelector(`input[name="${nome}"]:checked`);
          let ds_descricao = null;
          if (meta.id === 'M07' && item.id === 'incidentes_ea' && checked?.value === 'S') {
            ds_descricao = byId('proc-desc-incidentes')?.value || '';
          }
          respostas.push({
            cd_grupo: meta.id,
            cd_subgrupo: sub.id,
            cd_item: item.id,
            ie_resposta: checked ? checked.value : 'NA',
            ds_descricao
          });
        });
      });
    });
    
    const acompanhanteChecked = document.querySelector('input[name="proc-perg-acompanhante"]:checked');
    const ie_acompanhante = acompanhanteChecked ? acompanhanteChecked.value : 'NA';

    const payload = {
      dt_auditoria: byId('proc-dt-auditoria').value,
      cd_setor_atendimento: Number(byId('proc-setor').value),
      cd_avaliador: Number(byId('proc-avaliador').value),
      ie_turno: new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'D' : 'N',
      ds_observacao: byId('proc-observacoes').value,
      ie_acompanhante,
      nm_paciente: byId('proc-nm-paciente').value,
      dt_nascimento: byId('proc-dt-nascimento').value,
      dt_admissao: byId('proc-dt-admissao').value,
      ds_unidade_leito: byId('proc-unidade-leito').value,
      nr_atendimento: byId('proc-nr-atendimento').value,
      respostas
    };
    if (!payload.dt_auditoria || !payload.cd_setor_atendimento || !payload.cd_avaliador || !payload.nm_paciente) {
      throw new Error('Preencha todos os campos obrigatórios (Data, Setor, Responsável, Nome do Paciente).');
    }
    return payload;
  }

  async function saveProcessos() {
    const button = byId('btn-auditoria-processos-salvar');
    try {
      clearMessage();
      const payload = collectPayloadProcessos();
      button.disabled = true;
      button.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
      const result = await request('/api/auditorias/processos', { method: 'POST', body: JSON.stringify(payload) });
      auditProcessosId = result.data.nr_sequencia;
      clearFormProcessos();
      message(result.message || 'Auditoria de Processos salva com sucesso.', 'success');
    } catch (err) {
      message(err.message || 'Erro ao salvar auditoria.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar';
    }
  }

  function renderHistoricoProcessosIndividual(rows, list) {
    list.innerHTML = rows.map(row => {
      const totalRespostas = Number(row.TOTAL_RESPOSTAS || 0);
      const totalSim = Number(row.TOTAL_SIM || 0);
      const percentual = totalRespostas ? Math.round((totalSim / (totalRespostas - Number(row.TOTAL_NA || 0))) * 100) : 0;
      const id = Number(row.NR_SEQUENCIA);
      let badgeHtml = '';
      if (totalRespostas > 0) {
        if (percentual >= 80) badgeHtml = `<span class="auditoria-result-badge compliance-high"><i class="bi bi-check-circle-fill"></i> ${percentual}% Conformidade</span>`;
        else if (percentual >= 50) badgeHtml = `<span class="auditoria-result-badge compliance-medium"><i class="bi bi-exclamation-triangle-fill"></i> ${percentual}% Conformidade</span>`;
        else badgeHtml = `<span class="auditoria-result-badge compliance-low"><i class="bi bi-x-circle-fill"></i> ${percentual}% Conformidade</span>`;
      }
      return `<article class="auditoria-historico-item"><div class="auditoria-historico-info"><div class="auditoria-historico-meta-header"><span class="auditoria-date-badge"><i class="bi bi-calendar-event"></i> ${escapeHtml(row.DT_AUDITORIA)}</span><span class="auditoria-setor-badge"><i class="bi bi-hospital"></i> ${escapeHtml(row.NM_SETOR)}</span><span class="auditoria-turno-badge"><i class="bi ${row.IE_TURNO === 'N' ? 'bi-moon' : 'bi-sun'}"></i> ${row.IE_TURNO === 'N' ? 'Noite' : row.IE_TURNO === 'D' ? 'Dia' : '-'}</span></div><small class="auditoria-historico-people"><strong>Paciente:</strong> ${escapeHtml(row.NM_PACIENTE)} &nbsp;·&nbsp; <strong>Leito:</strong> ${escapeHtml(row.DS_UNIDADE_LEITO || '-')} &nbsp;·&nbsp; <strong>Resp.:</strong> ${escapeHtml(row.NM_AVALIADOR)}</small></div><div class="auditoria-historico-actions"><div class="auditoria-result-group">${badgeHtml} <span class="auditoria-count-label">${totalSim}/${totalRespostas - Number(row.TOTAL_NA || 0)} conformes</span></div><div class="auditoria-btn-group"><button class="btn-secondary btn-sm" type="button" data-view-proc="${id}"><i class="bi bi-eye"></i> Detalhes</button><button class="btn-secondary btn-sm" type="button" data-xlsx-proc="${id}"><i class="bi bi-file-earmark-excel"></i> XLSX</button><button class="btn-secondary btn-sm" type="button" data-pdf-proc="${id}"><i class="bi bi-file-earmark-pdf"></i> PDF</button></div></div><div class="auditoria-detalhe d-none" data-detail-proc="${id}"></div></article>`;
    }).join('');
    list.querySelectorAll('[data-xlsx-proc]').forEach(button => button.addEventListener('click', () => downloadProcessos(button.dataset.xlsxProc, 'xlsx')));
    list.querySelectorAll('[data-pdf-proc]').forEach(button => button.addEventListener('click', () => downloadProcessos(button.dataset.pdfProc, 'pdf')));
    list.querySelectorAll('[data-view-proc]').forEach(button => button.addEventListener('click', () => {
      const detail = list.querySelector(`[data-detail-proc="${button.dataset.viewProc}"]`);
      if (detail?.classList.contains('d-none')) mostrarDetalheProcessos(button.dataset.viewProc, detail);
      else detail?.classList.add('d-none');
    }));
  }

  async function mostrarDetalheProcessos(id, target) {
    if (!target) return;
    target.innerHTML = '<div class="auditoria-detalhe-loading"><i class="bi bi-arrow-repeat spin"></i> Carregando dados...</div>';
    target.classList.remove('d-none');
    try {
      const result = await request(`/api/auditorias/processos/${encodeURIComponent(id)}`);
      const a = result.data;
      const grupos = (a.respostas || []).reduce((acc, r) => {
        const key = r.CD_GRUPO || 'OUTRO';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {});
      let html = `<div class="auditoria-detalhe-grid"><span><strong>Data:</strong> ${escapeHtml(a.DT_AUDITORIA)}</span><span><strong>Setor:</strong> ${escapeHtml(a.NM_SETOR)}</span><span><strong>Responsável:</strong> ${escapeHtml(a.NM_AVALIADOR)}</span><span><strong>Paciente:</strong> ${escapeHtml(a.NM_PACIENTE)}</span><span><strong>Acompanhante:</strong> ${escapeHtml(a.IE_ACOMPANHANTE || 'NA')}</span></div><div class="auditoria-detalhe-respostas">`;
      for (const [grupo, itens] of Object.entries(grupos)) {
        html += `<div class="auditoria-detalhe-grupo"><strong>${escapeHtml(grupo)}</strong>`;
        itens.forEach(r => {
          const conforme = r.IE_RESPOSTA === 'S';
          let descHtml = r.DS_DESCRICAO ? ` <em style="font-size: 0.85em; color: #64748b; display: block; margin-top: 2px;">(Incidente: ${escapeHtml(r.DS_DESCRICAO)})</em>` : '';
          html += `<span class="${conforme ? 'conforme' : 'nao-conforme'}">${escapeHtml(r.CD_ITEM)} <strong>${escapeHtml(r.resposta_label || r.IE_RESPOSTA)} · ${conforme ? 'Conforme' : r.IE_RESPOSTA === 'NA' ? 'NA' : 'Não conforme'}</strong>${descHtml}</span>`;
        });
        html += '</div>';
      }
      html += '</div>';
      if (a.DS_OBSERVACAO) html += `<p class="auditoria-detalhe-obs"><strong>Observações:</strong> ${escapeHtml(a.DS_OBSERVACAO)}</p>`;
      target.innerHTML = html;
    } catch (err) { target.innerHTML = `<div class="auditoria-feedback">${escapeHtml(err.message)}</div>`; }
  }

  function renderHistoricoProcessosConsolidado(rows, list) {
    list.innerHTML = rows.map(row => {
      const totalRespostas = Number(row.TOTAL_RESPOSTAS || 0);
      const totalSim = Number(row.TOTAL_SIM || 0);
      const naCount = Number(row.TOTAL_NA || 0);
      const avaliaveis = totalRespostas - naCount;
      const percentual = avaliaveis > 0 ? Math.round((totalSim / avaliaveis) * 100) : 0;
      let badgeHtml = '';
      if (avaliaveis > 0) {
        if (percentual >= 80) badgeHtml = `<span class="auditoria-result-badge compliance-high"><i class="bi bi-check-circle-fill"></i> ${percentual}%</span>`;
        else if (percentual >= 50) badgeHtml = `<span class="auditoria-result-badge compliance-medium"><i class="bi bi-exclamation-triangle-fill"></i> ${percentual}%</span>`;
        else badgeHtml = `<span class="auditoria-result-badge compliance-low"><i class="bi bi-x-circle-fill"></i> ${percentual}%</span>`;
      }
      return `<article class="auditoria-historico-item auditoria-historico-consolidado"><div class="auditoria-historico-info"><div class="auditoria-historico-meta-header"><span class="auditoria-date-badge"><i class="bi bi-calendar-event"></i> ${escapeHtml(row.DT_AUDITORIA)}</span><span class="auditoria-setor-badge"><i class="bi bi-hospital"></i> ${escapeHtml(row.NM_SETOR)}</span><span class="auditoria-turno-badge"><i class="bi ${row.IE_TURNO === 'N' ? 'bi-moon' : 'bi-sun'}"></i> ${row.IE_TURNO === 'N' ? 'Noite' : row.IE_TURNO === 'D' ? 'Dia' : '-'}</span></div><small class="auditoria-historico-people"><strong>Resp.:</strong> ${escapeHtml(row.NM_AVALIADOR)} &nbsp;·&nbsp; ${Number(row.TOTAL_AUDITORIAS)} auditoria(s)</small></div><div class="auditoria-consolidado-metricas"><span><strong>${totalSim}</strong> sim</span><span><strong>${Number(row.TOTAL_NAO || 0)}</strong> não</span><span><strong>${naCount}</strong> NA</span>${badgeHtml}</div></article>`;
    }).join('');
  }

  async function loadHistoricoProcessos(modo = historicoProcessosModo) {
    historicoProcessosModo = modo;
    show('workspace-auditoria-processos-historico');
    const list = byId('auditoria-processos-historico-list');
    byId('btn-auditoria-processos-visao-individual')?.classList.toggle('active', modo === 'individual');
    byId('btn-auditoria-processos-visao-consolidada')?.classList.toggle('active', modo === 'consolidado');
    list.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando auditorias...</div>';
    try {
      const result = await request(modo === 'consolidado' ? '/api/auditorias/processos/historico/consolidado' : '/api/auditorias/processos/historico');
      const rows = result.data || [];
      if (!rows.length) { list.innerHTML = '<div class="loading-placeholder">Nenhuma auditoria de Processos encontrada.</div>'; return; }
      if (modo === 'consolidado') renderHistoricoProcessosConsolidado(rows, list);
      else renderHistoricoProcessosIndividual(rows, list);
    } catch (err) { list.innerHTML = `<div class="loading-placeholder"><i class="bi bi-exclamation-triangle"></i> ${escapeHtml(err.message)}</div>`; }
  }

  function downloadProcessos(id, extension) { window.location.assign(`/api/auditorias/processos/${encodeURIComponent(id)}/${extension}`); }

  // ─── Processos Draft ──────────────────────────────────────────────────────
  function captureProcessosDraft() {
    const activeScreen = auditIds.find(id => !byId(id)?.classList.contains('d-none'));
    if (!activeScreen) return null;
    const draft = { activeScreen, historicoModo: historicoProcessosModo };
    if (activeScreen === 'workspace-auditoria-processos-form') {
      const respostas = {};
      document.querySelectorAll('#proc-metas-container input[type="radio"]:checked').forEach(r => { respostas[r.name] = r.value; });
      const acompanhanteChecked = document.querySelector('input[name="proc-perg-acompanhante"]:checked');
      
      draft.form = {
        nm_paciente: byId('proc-nm-paciente')?.value || '',
        dt_nascimento: byId('proc-dt-nascimento')?.value || '',
        dt_admissao: byId('proc-dt-admissao')?.value || '',
        ds_unidade_leito: byId('proc-unidade-leito')?.value || '',
        nr_atendimento: byId('proc-nr-atendimento')?.value || '',
        observacoes: byId('proc-observacoes')?.value || '',
        ie_acompanhante: acompanhanteChecked ? acompanhanteChecked.value : '',
        ds_incidentes: byId('proc-desc-incidentes')?.value || '',
        respostas
      };
    }
    return draft;
  }

  function hydrateProcessosDraft(draft) {
    if (!draft?.activeScreen) return;
    show(draft.activeScreen);
    if (draft.activeScreen === 'workspace-auditoria-processos-form' && draft.form) {
      const f = draft.form;
      renderMetasProcessos();
      byId('proc-dt-auditoria').value = isoToday();
      if (f.nm_paciente) byId('proc-nm-paciente').value = f.nm_paciente;
      if (f.dt_nascimento) byId('proc-dt-nascimento').value = f.dt_nascimento;
      if (f.dt_admissao) byId('proc-dt-admissao').value = f.dt_admissao;
      if (f.ds_unidade_leito) byId('proc-unidade-leito').value = f.ds_unidade_leito;
      if (f.nr_atendimento) byId('proc-nr-atendimento').value = f.nr_atendimento;
      if (f.observacoes) byId('proc-observacoes').value = f.observacoes;
      
      if (f.ie_acompanhante) {
        const rad = document.querySelector(`input[name="proc-perg-acompanhante"][value="${f.ie_acompanhante}"]`);
        if (rad) rad.checked = true;
      }
      if (f.respostas) {
        for (const [name, val] of Object.entries(f.respostas)) {
          const rad = document.querySelector(`input[name="${name}"][value="${val}"]`);
          if (rad) rad.checked = true;
        }
      }
      if (f.ds_incidentes && byId('proc-desc-incidentes')) {
        byId('proc-desc-incidentes').value = f.ds_incidentes;
      }
      
      loadOptionsProcessos().catch(() => {});
    } else if (draft.activeScreen === 'workspace-auditoria-processos-paciente') {
      openFormProcessos().catch(() => {});
    } else if (draft.activeScreen === 'workspace-auditoria-processos-historico') {
      loadHistoricoProcessos(draft.historicoModo || 'individual');
    }
  }

  window.captureProcessosDraft = captureProcessosDraft;
  window.hydrateProcessosDraft = hydrateProcessosDraft;

  function showProcessosMenu() { show('auditoria-processos-sub-menu'); }

  byId('btn-auditorias-processos')?.addEventListener('click', showProcessosMenu);
  byId('btn-auditoria-processos-voltar')?.addEventListener('click', showAuditorias);
  byId('btn-auditoria-processos-nova')?.addEventListener('click', openFormProcessos);
  byId('btn-auditoria-processos-historico')?.addEventListener('click', loadHistoricoProcessos);
  byId('btn-auditoria-processos-paciente-voltar')?.addEventListener('click', showProcessosMenu);
  byId('btn-auditoria-processos-aleatorio')?.addEventListener('click', abrirPacienteAleatorio);
  byId('btn-auditoria-processos-form-voltar')?.addEventListener('click', openFormProcessos);
  byId('btn-auditoria-processos-cancelar')?.addEventListener('click', showProcessosMenu);
  byId('btn-auditoria-processos-salvar')?.addEventListener('click', saveProcessos);
  byId('btn-auditoria-processos-historico-voltar')?.addEventListener('click', showProcessosMenu);
  byId('btn-auditoria-processos-ver-historico')?.addEventListener('click', () => loadHistoricoProcessos());
  byId('btn-auditoria-processos-visao-individual')?.addEventListener('click', () => loadHistoricoProcessos('individual'));
  byId('btn-auditoria-processos-visao-consolidada')?.addEventListener('click', () => loadHistoricoProcessos('consolidado'));

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.id.includes('auditoria') || button.id === 'btn-abrir-auditorias' || button.id === 'nav-auditorias') return;
    if (button.closest('#topbar-nav') || button.closest('.mode-grid') || button.id === 'topbar-brand') auditIds.forEach(id => byId(id)?.classList.add('d-none'));
  });
  document.addEventListener('click', event => { if (event.target.closest('#user-profile-menu')) setTimeout(refreshAccess, 250); });

  // Marca draft como sujo ao interagir com o formulário (ativa o amarelinho no topbar)
  const auditForm = document.getElementById('workspace-auditoria-higiene-form');
  if (auditForm) {
    auditForm.addEventListener('input', () => {
      window.conectaApp?.markModuleDraftDirty?.('auditorias');
    });
    auditForm.addEventListener('change', () => {
      window.conectaApp?.markModuleDraftDirty?.('auditorias');
    });
  }

  setTimeout(refreshAccess, 250);
})();
