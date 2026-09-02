import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import * as ui from '../../core/ui.js';
import { escapeHtml } from '../../core/utils.js';

/**
 * Módulo de Recepção & Acolhimento — Conecta HEAL 2.0
 * Padrão Conecta: Fila de Espera (Guichê) + Histórico de Atendimentos do Dia (GED) + Modal Wizard
 */

let recepcaoState = {
  abaAtiva: 'senhas', // 'senhas' | 'historico'
  filaSelecionada: 9, // PA - NORMAL por padrão
  senhaAtiva: null,
  pessoaSelecionada: null,
  atendimentoCriado: null,
  passoAtual: 1, // 1: Identificação, 2: Endereço, 3: Convênio, 4: Atendimento, 5: Relatórios/GED
  filasDisponiveis: [],
  senhasFila: [],
  atendimentosHoje: [],
  relatorios: [],
  documentosGED: []
};

let queuePollInterval = null;

export function enterRecepcaoMode() {
  const ws = document.getElementById('workspace-recepcao');
  const appContainers = document.querySelectorAll('#screen-app > section, #screen-app > .app-container');
  appContainers.forEach(el => el.classList.add('d-none'));
  ws?.classList.remove('d-none');
  state.mode = 'recepcao';
  if (window.conectaCore?.configureTopbarByMode) {
    window.conectaCore.configureTopbarByMode();
  }
  initRecepcao();
}

export function stopQueuePolling() {
  if (queuePollInterval) {
    clearInterval(queuePollInterval);
    queuePollInterval = null;
  }
}

export function startQueuePolling() {
  stopQueuePolling();
  queuePollInterval = setInterval(() => {
    if (state.mode === 'recepcao') {
      if (recepcaoState.abaAtiva === 'senhas') {
        carregarSenhas();
      } else {
        carregarAtendimentosHoje();
      }
    } else {
      stopQueuePolling();
    }
  }, 8000);
}

export async function initRecepcao() {
  window.conectaCore = window.conectaCore || {};
  window.conectaCore.irParaPasso = irParaPasso;
  window.conectaCore.selecionarSenhaFila = selecionarSenhaFila;
  window.conectaCore.selecionarPaciente = selecionarPaciente;
  window.conectaCore.novoPaciente = novoPaciente;
  window.conectaCore.imprimirRelatorio = imprimirRelatorio;
  window.conectaCore.abrirModalAtendimento = abrirModalAtendimento;
  window.conectaCore.trocarAbaRecepcao = trocarAbaRecepcao;
  window.conectaCore.abrirDocumentosAtendimento = abrirDocumentosAtendimento;

  bindRecepcaoEvents();
  await carregarFilas();
  await carregarSenhas();
  await carregarAtendimentosHoje();
  await carregarSetoresAtendimento();
  await carregarConvenios();
  await carregarClassificacoesAtendimento();
  startQueuePolling();
}

function bindRecepcaoEvents() {
  const selectFila = document.getElementById('recepcao-select-fila');
  if (selectFila && !selectFila.dataset.bound) {
    selectFila.dataset.bound = '1';
    selectFila.addEventListener('change', (e) => {
      recepcaoState.filaSelecionada = e.target.value;
      carregarSenhas();
    });
  }

  const selectConv = document.getElementById('recepcao-convenio');
  if (selectConv && !selectConv.dataset.bound) {
    selectConv.dataset.bound = '1';
    selectConv.addEventListener('change', (e) => {
      carregarCategoriasConvenio(e.target.value);
    });
  }

  // Ações do Topo do Painel
  document.getElementById('btn-recepcao-refresh')?.addEventListener('click', () => {
    carregarSenhas(true);
    carregarAtendimentosHoje(true);
  });
  document.getElementById('btn-recepcao-chamar-proximo')?.addEventListener('click', chamarProximaSenha);
  document.getElementById('btn-recepcao-rechamar')?.addEventListener('click', rechamarSenha);
  document.getElementById('btn-recepcao-novo-avulso')?.addEventListener('click', iniciarAtendimentoAvulso);

  // Filtros de busca
  document.getElementById('recepcao-search-senha')?.addEventListener('input', (e) => {
    filtrarGridSenhas(e.target.value);
  });
  document.getElementById('recepcao-search-historico')?.addEventListener('input', (e) => {
    filtrarTabelaAtendimentosHoje(e.target.value);
  });

  // Modal Stepper Navigation
  document.querySelectorAll('.modal-step-item').forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.dataset.step, 10);
      if (step) irParaPasso(step);
    });
  });

  // Modal Footer Navigation
  document.getElementById('modal-btn-voltar-passo')?.addEventListener('click', voltarPassoModal);
  document.getElementById('modal-btn-avancar-passo')?.addEventListener('click', avancarPassoModal);

  // Busca de Paciente no Modal
  const inputBusca = document.getElementById('recepcao-busca-paciente');
  let searchTimeout = null;
  inputBusca?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      buscarPacientes(e.target.value);
    }, 300);
  });

  document.getElementById('btn-recepcao-novo-paciente')?.addEventListener('click', novoPaciente);
  document.getElementById('btn-recepcao-limpar-paciente')?.addEventListener('click', limparPaciente);

  // Autocomplete CEP
  const inputCep = document.getElementById('recepcao-cep');
  inputCep?.addEventListener('blur', (e) => {
    consultarCep(e.target.value);
  });

  // Abertura de Atendimento
  document.getElementById('btn-recepcao-abrir-atendimento')?.addEventListener('click', abrirAtendimento);

  // GED Upload
  document.getElementById('btn-recepcao-upload-ged')?.addEventListener('click', abrirUploadGED);
}

// ============================================================================
// 1. ALTERNÂNCIA DE ABAS NO PADRÃO CONECTA
// ============================================================================

export function trocarAbaRecepcao(aba) {
  recepcaoState.abaAtiva = aba;

  const btnSenhas = document.getElementById('tab-btn-senhas');
  const btnHistorico = document.getElementById('tab-btn-historico');
  const paneSenhas = document.getElementById('pane-recepcao-senhas');
  const paneHistorico = document.getElementById('pane-recepcao-historico');

  if (aba === 'senhas') {
    btnSenhas?.classList.add('active');
    btnHistorico?.classList.remove('active');
    paneSenhas?.classList.remove('d-none');
    paneHistorico?.classList.add('d-none');
    carregarSenhas();
  } else {
    btnSenhas?.classList.remove('active');
    btnHistorico?.classList.add('active');
    paneSenhas?.classList.add('d-none');
    paneHistorico?.classList.remove('d-none');
    carregarAtendimentosHoje();
  }
}

// ============================================================================
// 2. CARREGAMENTO E RENDERIZAÇÃO DO BOARD DE SENHAS
// ============================================================================

export async function carregarFilas() {
  const select = document.getElementById('recepcao-select-fila');
  try {
    const res = await api.get('/api/recepcao/filas');
    if (res && res.success && Array.isArray(res.data)) {
      recepcaoState.filasDisponiveis = res.data;
      if (select) {
        select.innerHTML = res.data.map(f => {
          const seq = f.NR_SEQUENCIA ?? f.nr_sequencia;
          const nome = f.DS_FILA ?? f.ds_fila ?? `Fila ${seq}`;
          const isSelected = seq === 9 || String(seq) === '9';
          return `<option value="${seq}" ${isSelected ? 'selected' : ''}>${escapeHtml(nome)}</option>`;
        }).join('') + '<option value="">Todas as Filas Ativas</option>';
      }
      recepcaoState.filaSelecionada = 9;
    } else if (select) {
      select.innerHTML = '<option value="9" selected>PA - NORMAL</option><option value="">Todas as Filas Ativas</option>';
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar filas:', err);
    if (select) {
      select.innerHTML = '<option value="9" selected>PA - NORMAL</option><option value="">Todas as Filas Ativas</option>';
    }
  }
}

export async function carregarSenhas(showFeedback = false) {
  const container = document.getElementById('recepcao-senhas-grid');
  try {
    const fila = recepcaoState.filaSelecionada || '';
    const res = await api.get(`/api/recepcao/senhas?fila=${fila}`);
    if (res && res.success && Array.isArray(res.data)) {
      recepcaoState.senhasFila = res.data;
      renderizarBoardSenhas();
      if (showFeedback) {
        ui.showToast('Fila de senhas atualizada!', 'info');
      }
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar senhas:', err);
    if (container && (!recepcaoState.senhasFila || recepcaoState.senhasFila.length === 0)) {
      container.innerHTML = `
        <div class="col-12 p-5 text-center text-muted">
          <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
          <h5 class="fw-bold">Nenhuma senha aguardando no momento</h5>
          <p class="small text-muted">Novas senhas emitidas no totem aparecerão automaticamente aqui.</p>
        </div>`;
    }
  }
}

function renderizarBoardSenhas(listaFiltrada = null) {
  const container = document.getElementById('recepcao-senhas-grid');
  const countBadge = document.getElementById('recepcao-queue-count');
  const tabBadge = document.getElementById('tab-badge-espera');
  const kpiTotal = document.getElementById('kpi-total-espera');
  if (!container) return;

  const lista = listaFiltrada !== null ? listaFiltrada : recepcaoState.senhasFila;

  if (countBadge) countBadge.textContent = lista.length;
  if (tabBadge) tabBadge.textContent = lista.length;
  if (kpiTotal) kpiTotal.textContent = recepcaoState.senhasFila.length;

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="col-12 p-5 text-center text-muted w-100" style="grid-column: 1 / -1;">
        <i class="bi bi-inbox fs-1 d-block mb-2 text-primary opacity-50"></i>
        <h5 class="fw-bold">Nenhuma senha aguardando atendimento</h5>
        <p class="small text-muted mb-3">O guichê está livre. Clique em "Chamar Próxima Senha" ou "Atendimento Avulso" para iniciar.</p>
        <button class="btn btn-sm btn-outline-primary" type="button" onclick="window.conectaCore.abrirModalAtendimento()">
          <i class="bi bi-person-plus"></i> Abrir Atendimento Avulso
        </button>
      </div>`;
    return;
  }

  container.innerHTML = lista.map(s => {
    const nrSeq = s.NR_SEQUENCIA ?? s.nr_sequencia;
    const cdSenha = s.CD_SENHA_GERADA ?? s.cd_senha_gerada;
    const dsPrioridade = s.DS_PRIORIDADE ?? s.ds_prioridade ?? 'Normal';
    const dsFila = s.DS_FILA ?? s.ds_fila ?? 'Recepção';
    const nrPrioridade = s.NR_PRIORIDADE ?? s.nr_prioridade;
    const minEspera = s.MINUTOS_ESPERA ?? s.minutos_espera ?? 0;
    const hrGeracao = s.HR_GERACAO ?? s.hr_geracao ?? '';

    let prioridadeClasse = 'normal';
    let badgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
    if (nrPrioridade === 1) {
      prioridadeClasse = 'urgente';
      badgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
    } else if (nrPrioridade === 2) {
      prioridadeClasse = 'preferencial';
      badgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    }

    return `
      <div class="senha-ticket-card ${prioridadeClasse}" onclick="window.conectaCore.selecionarSenhaFila(${nrSeq})">
        <div class="senha-ticket-header">
          <div class="senha-ticket-number">#${escapeHtml(cdSenha)}</div>
          <span class="senha-ticket-badge ${badgeClass}">${escapeHtml(dsPrioridade)}</span>
        </div>

        <div class="senha-ticket-meta">
          <div><i class="bi bi-diagram-3"></i> <strong>${escapeHtml(dsFila)}</strong></div>
          <div><i class="bi bi-clock"></i> Chegada: ${escapeHtml(hrGeracao)}</div>
        </div>

        <div class="senha-ticket-footer">
          <span class="senha-ticket-wait-time">
            <i class="bi bi-hourglass-split"></i> Espera: <strong>${minEspera} min</strong>
          </span>
          <button class="btn btn-sm btn-primary fw-bold px-3" type="button">
            Atender <i class="bi bi-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filtrarGridSenhas(termo) {
  if (!termo || termo.trim() === '') {
    renderizarBoardSenhas();
    return;
  }
  const q = termo.toLowerCase().trim();
  const filtradas = recepcaoState.senhasFila.filter(s => {
    const cd = String(s.CD_SENHA_GERADA ?? s.cd_senha_gerada ?? '').toLowerCase();
    const prio = String(s.DS_PRIORIDADE ?? s.ds_prioridade ?? '').toLowerCase();
    const fila = String(s.DS_FILA ?? s.ds_fila ?? '').toLowerCase();
    return cd.includes(q) || prio.includes(q) || fila.includes(q);
  });
  renderizarBoardSenhas(filtradas);
}

// ============================================================================
// 3. CARREGAMENTO E RENDERIZAÇÃO DE ATENDIMENTOS DE HOJE (HISTÓRICO + GED)
// ============================================================================

export async function carregarAtendimentosHoje(showFeedback = false) {
  const tbody = document.getElementById('recepcao-historico-tbody');
  try {
    const res = await api.get('/api/recepcao/atendimentos/hoje');
    if (res && res.success && Array.isArray(res.data)) {
      recepcaoState.atendimentosHoje = res.data;
      renderizarTabelaAtendimentosHoje();
      if (showFeedback) {
        ui.showToast('Histórico de atendimentos atualizado!', 'info');
      }
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar atendimentos de hoje:', err);
    if (tbody && (!recepcaoState.atendimentosHoje || recepcaoState.atendimentosHoje.length === 0)) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">
            <i class="bi bi-exclamation-circle text-danger me-1"></i> Erro ao carregar atendimentos de hoje: ${escapeHtml(err.message)}
          </td>
        </tr>`;
    }
  }
}

function renderizarTabelaAtendimentosHoje(listaFiltrada = null) {
  const tbody = document.getElementById('recepcao-historico-tbody');
  const countBadge = document.getElementById('recepcao-hoje-count');
  const tabBadge = document.getElementById('tab-badge-hoje');
  const kpiHoje = document.getElementById('kpi-total-hoje');
  if (!tbody) return;

  const lista = listaFiltrada !== null ? listaFiltrada : recepcaoState.atendimentosHoje;

  if (countBadge) countBadge.textContent = lista.length;
  if (tabBadge) tabBadge.textContent = lista.length;
  if (kpiHoje) kpiHoje.textContent = recepcaoState.atendimentosHoje.length;

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="bi bi-folder-x fs-2 d-block mb-2 text-secondary"></i>
          <strong>Nenhum atendimento realizado hoje até o momento</strong>
          <p class="small text-muted mb-0">Os atendimentos gerados aparecerão automaticamente nesta lista.</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = lista.map(item => {
    const atend = item.NR_ATENDIMENTO ?? item.nr_atendimento;
    const hr = item.HR_ENTRADA ?? item.hr_entrada ?? '--:--';
    const cdPf = item.CD_PESSOA_FISICA ?? item.cd_pessoa_fisica;
    const nome = item.NM_PESSOA_FISICA ?? item.nm_pessoa_fisica ?? 'Não informado';
    const cpf = item.NR_CPF ?? item.nr_cpf ?? '-';
    const senha = item.CD_SENHA_GERADA ?? item.cd_senha_gerada;
    const conv = item.DS_CONVENIO ?? item.ds_convenio ?? 'Particular / SUS';
    const setor = item.DS_SETOR ?? item.ds_setor ?? 'P.A.';
    const qtdGed = item.QTD_GED ?? item.qtd_ged ?? 0;

    const badgeGed = qtdGed > 0 
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-paperclip"></i> ${qtdGed} doc(s)</span>`
      : `<span class="badge bg-light text-muted border"><i class="bi bi-file-earmark"></i> 0 docs</span>`;

    const senhaPill = senha 
      ? `<span class="senha-pill-sm">#${escapeHtml(senha)}</span>` 
      : `<span class="text-muted small">Avulso</span>`;

    return `
      <tr>
        <td><strong>${escapeHtml(hr)}</strong></td>
        <td>${senhaPill}</td>
        <td>
          <div class="fw-bold text-dark">${escapeHtml(nome)}</div>
          <small class="text-muted">Cód TASY: ${cdPf}</small>
        </td>
        <td><small class="text-secondary">${escapeHtml(cpf)}</small></td>
        <td><span class="atend-badge-numero">#${atend}</span></td>
        <td>
          <div class="small fw-semibold">${escapeHtml(conv)}</div>
          <small class="text-muted">${escapeHtml(setor)}</small>
        </td>
        <td>${badgeGed}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary fw-bold" type="button" onclick="window.conectaCore.abrirDocumentosAtendimento(${atend}, '${cdPf}', '${escapeHtml(nome)}', '${senha || ''}')">
            <i class="bi bi-printer-fill me-1"></i> Documentos & GED
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filtrarTabelaAtendimentosHoje(termo) {
  if (!termo || termo.trim() === '') {
    renderizarTabelaAtendimentosHoje();
    return;
  }
  const q = termo.toLowerCase().trim();
  const filtrados = recepcaoState.atendimentosHoje.filter(item => {
    const nome = String(item.NM_PESSOA_FISICA ?? item.nm_pessoa_fisica ?? '').toLowerCase();
    const cpf = String(item.NR_CPF ?? item.nr_cpf ?? '').toLowerCase();
    const atend = String(item.NR_ATENDIMENTO ?? item.nr_atendimento ?? '').toLowerCase();
    const senha = String(item.CD_SENHA_GERADA ?? item.cd_senha_gerada ?? '').toLowerCase();
    const conv = String(item.DS_CONVENIO ?? item.ds_convenio ?? '').toLowerCase();
    return nome.includes(q) || cpf.includes(q) || atend.includes(q) || senha.includes(q) || conv.includes(q);
  });
  renderizarTabelaAtendimentosHoje(filtrados);
}

/**
 * Abertura Direta do Modal na Etapa 5 (Documentos Oficiais TasyReports & GED)
 */
export async function abrirDocumentosAtendimento(nrAtendimento, cdPessoaFisica, nmPaciente, cdSenha = '') {
  recepcaoState.atendimentoCriado = nrAtendimento;
  recepcaoState.pessoaSelecionada = {
    CD_PESSOA_FISICA: cdPessoaFisica,
    NM_PESSOA_FISICA: nmPaciente
  };
  recepcaoState.senhaAtiva = cdSenha ? { cd_senha_gerada: cdSenha } : null;

  // Atualiza badge de senha no header do modal
  const badgeEl = document.getElementById('modal-atend-senha-badge');
  if (badgeEl) {
    badgeEl.innerHTML = `<i class="bi bi-folder-fill text-info me-1"></i> Atendimento: <strong>#${nrAtendimento}</strong> (${escapeHtml(nmPaciente)})`;
  }

  const numAtendEl = document.getElementById('recepcao-atendimento-numero');
  if (numAtendEl) numAtendEl.textContent = nrAtendimento;

  // Carrega os relatórios oficiais e documentos GED vinculados
  await carregarRelatorios();
  await carregarDocumentosGED();

  // Abre direto no Passo 5 (Relatórios & GED)
  irParaPasso(5);

  const modalEl = document.getElementById('modal-atendimento-recepcao');
  if (modalEl && window.bootstrap?.Modal) {
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}

// ============================================================================
// 4. CHAMADA DE GUICHÊ & ABERTURA DO MODAL
// ============================================================================

export async function chamarProximaSenha() {
  const btn = document.getElementById('btn-recepcao-chamar-proximo');
  if (btn) ui.setLoading(btn, true);

  try {
    const fila = recepcaoState.filaSelecionada || (recepcaoState.filasDisponiveis[0]?.NR_SEQUENCIA);
    const res = await api.post('/api/recepcao/senhas/chamar', {
      nr_seq_fila_senha: fila,
      ds_maquina: 'GUICHE-' + (state.usuario?.nm_usuario || '1')
    });

    if (res.success && res.proxima && res.data) {
      recepcaoState.senhaAtiva = res.data;
      atualizarDisplaySenha(res.data.cd_senha_gerada, 'Chamado');
      ui.showToast(`Senha #${res.data.cd_senha_gerada} chamada no guichê!`, 'success');
      await carregarSenhas();
      abrirModalAtendimento(res.data);
    } else {
      ui.showToast(res.message || 'Nenhuma senha aguardando nesta fila.', 'info');
    }
  } catch (err) {
    ui.showToast('Erro ao chamar próxima senha: ' + err.message, 'error');
  } finally {
    if (btn) ui.setLoading(btn, false);
  }
}

export async function rechamarSenha() {
  if (!recepcaoState.senhaAtiva) {
    ui.showToast('Nenhuma senha ativa no guichê para rechamar.', 'warning');
    return;
  }
  try {
    await api.post('/api/recepcao/senhas/rechamar', {
      nr_sequencia: recepcaoState.senhaAtiva.nr_sequencia,
      ds_maquina: 'GUICHE-' + (state.usuario?.nm_usuario || '1')
    });
    ui.showToast(`Senha #${recepcaoState.senhaAtiva.cd_senha_gerada} rechamada no painel!`, 'info');
  } catch (err) {
    ui.showToast('Erro ao rechamar senha: ' + err.message, 'error');
  }
}

export function selecionarSenhaFila(nrSequencia) {
  const senha = recepcaoState.senhasFila.find(s => s.NR_SEQUENCIA === nrSequencia);
  if (senha) {
    recepcaoState.senhaAtiva = {
      nr_sequencia: senha.NR_SEQUENCIA,
      cd_senha_gerada: senha.CD_SENHA_GERADA,
      ds_prioridade: senha.DS_PRIORIDADE
    };
    atualizarDisplaySenha(senha.CD_SENHA_GERADA, senha.DS_PRIORIDADE);
    abrirModalAtendimento(recepcaoState.senhaAtiva);
  }
}

export function iniciarAtendimentoAvulso() {
  recepcaoState.senhaAtiva = null;
  atualizarDisplaySenha(null, 'Atendimento Avulso');
  abrirModalAtendimento(null);
}

export function abrirModalAtendimento(senhaObj = null) {
  // Configura badge de senha no header do modal
  const badgeEl = document.getElementById('modal-atend-senha-badge');
  if (badgeEl) {
    if (senhaObj && senhaObj.cd_senha_gerada) {
      badgeEl.innerHTML = `<i class="bi bi-ticket-perforated-fill text-warning me-1"></i> Senha: <strong>#${escapeHtml(senhaObj.cd_senha_gerada)}</strong>`;
    } else {
      badgeEl.innerHTML = `<i class="bi bi-person-fill me-1"></i> Atendimento Avulso (Sem Senha)`;
    }
  }

  // Reseta estado para novo fluxo
  recepcaoState.pessoaSelecionada = null;
  recepcaoState.atendimentoCriado = null;
  limparFormularioPaciente();
  document.getElementById('card-paciente-selecionado')?.classList.add('d-none');
  document.getElementById('recepcao-search-results').innerHTML = '';
  document.getElementById('recepcao-busca-paciente').value = '';

  // Abre na Etapa 1 (Identificação)
  irParaPasso(1);

  // Instancia e abre o Modal Bootstrap
  const modalEl = document.getElementById('modal-atendimento-recepcao');
  if (modalEl && window.bootstrap?.Modal) {
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}

function atualizarDisplaySenha(numero, tipo) {
  const numEl = document.getElementById('guiche-active-number');
  const typeEl = document.getElementById('guiche-active-type');
  if (numEl) numEl.textContent = numero ? `#${numero}` : '---';
  if (typeEl) typeEl.textContent = tipo || 'Nenhuma senha chamada';
}

// ============================================================================
// 5. NAVEGAÇÃO ENTRE ETAPAS DO MODAL (STEPPER)
// ============================================================================

export function irParaPasso(passo) {
  recepcaoState.passoAtual = passo;

  // Atualiza indicadores do Stepper no Modal
  document.querySelectorAll('.modal-step-item').forEach(item => {
    const s = parseInt(item.dataset.step, 10);
    item.classList.toggle('active', s === passo);
    item.classList.toggle('completed', s < passo);
  });

  // Exibe o painel do passo correspondente
  document.querySelectorAll('.modal-step-pane').forEach(panel => {
    const s = parseInt(panel.dataset.step, 10);
    panel.classList.toggle('d-none', s !== passo);
  });

  // Atualiza botões do Footer do Modal
  const btnVoltar = document.getElementById('modal-btn-voltar-passo');
  const btnAvancar = document.getElementById('modal-btn-avancar-passo');
  const btnFechar = document.getElementById('modal-btn-fechar-atendimento');

  if (btnVoltar) {
    btnVoltar.disabled = (passo === 1 || passo === 5);
  }

  if (btnAvancar && btnFechar) {
    if (passo === 5) {
      btnAvancar.classList.add('d-none');
      btnFechar.classList.remove('d-none');
    } else {
      btnAvancar.classList.remove('d-none');
      btnFechar.classList.add('d-none');

      if (passo === 4) {
        btnAvancar.innerHTML = '<i class="bi bi-check2-circle"></i> Abrir Atendimento no TASY';
        btnAvancar.className = 'btn btn-success fw-bold';
      } else {
        btnAvancar.innerHTML = 'Avançar <i class="bi bi-arrow-right"></i>';
        btnAvancar.className = 'btn btn-primary';
      }
    }
  }
}

export function voltarPassoModal() {
  if (recepcaoState.passoAtual > 1) {
    irParaPasso(recepcaoState.passoAtual - 1);
  }
}

export async function avancarPassoModal() {
  const p = recepcaoState.passoAtual;

  if (p === 1) {
    const nome = document.getElementById('recepcao-nome-completo')?.value?.trim();
    if (!nome) {
      ui.showToast('Informe o nome completo do paciente ou selecione um cadastro.', 'warning');
      document.getElementById('recepcao-nome-completo')?.focus();
      return;
    }
    irParaPasso(2);
  } else if (p === 2) {
    await salvarPessoaEEndereco();
  } else if (p === 3) {
    const conv = document.getElementById('recepcao-convenio')?.value;
    if (!conv) {
      ui.showToast('Selecione o Convênio do paciente.', 'warning');
      document.getElementById('recepcao-convenio')?.focus();
      return;
    }
    irParaPasso(4);
  } else if (p === 4) {
    await abrirAtendimento();
  }
}

// ============================================================================
// 6. CADASTRO DE PESSOA FÍSICA & BUSCA TASY
// ============================================================================

export async function buscarPacientes(termo) {
  const container = document.getElementById('recepcao-search-results');
  if (!container) return;

  if (!termo || termo.trim().length < 2) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<div class="p-2 text-center text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Buscando no TASY...</div>';

  try {
    const res = await api.get(`/api/recepcao/pessoas/buscar?q=${encodeURIComponent(termo)}`);
    if (res.success && Array.isArray(res.data)) {
      if (res.data.length === 0) {
        container.innerHTML = `
          <div class="p-3 text-center text-muted border rounded">
            Nenhum paciente localizado com "${escapeHtml(termo)}".
            <button class="btn btn-sm btn-outline-primary ms-2" type="button" onclick="window.conectaCore.novoPaciente()">
              <i class="bi bi-person-plus"></i> Preencher Novo Cadastro
            </button>
          </div>`;
        return;
      }

      container.innerHTML = res.data.map(p => `
        <div class="paciente-result-item" onclick="window.conectaCore.selecionarPaciente('${p.CD_PESSOA_FISICA}')">
          <div>
            <strong>${escapeHtml(p.NM_PESSOA_FISICA)}</strong> ${p.NM_SOCIAL ? `<small class="text-muted">(${escapeHtml(p.NM_SOCIAL)})</small>` : ''}
            <div class="text-muted small">
              CPF: ${escapeHtml(p.NR_CPF || 'Não informado')} • Nasc: ${escapeHtml(p.DT_NASC_FMT || '-')} • Mãe: ${escapeHtml(p.NM_MAE || '-')}
            </div>
          </div>
          <button class="btn btn-sm btn-primary" type="button">
            Selecionar <i class="bi bi-arrow-right"></i>
          </button>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="p-2 text-danger small">Erro ao buscar pacientes: ' + err.message + '</div>';
  }
}

export async function selecionarPaciente(cdPessoaFisica) {
  try {
    const res = await api.get(`/api/recepcao/pessoas/${cdPessoaFisica}`);
    if (res.success && res.data) {
      recepcaoState.pessoaSelecionada = res.data;
      preencherFormularioPaciente(res.data);
      exibirCardPacienteSelecionado(res.data);
      document.getElementById('recepcao-search-results').innerHTML = '';
      await carregarUltimoConvenioPaciente(cdPessoaFisica);
      ui.showToast('Cadastro carregado do TASY!', 'success');
    }
  } catch (err) {
    ui.showToast('Erro ao carregar dados do paciente: ' + err.message, 'error');
  }
}

export function novoPaciente() {
  recepcaoState.pessoaSelecionada = null;
  limparFormularioPaciente();
  document.getElementById('recepcao-search-results').innerHTML = '';
  document.getElementById('card-paciente-selecionado')?.classList.add('d-none');
  document.getElementById('recepcao-nome-completo')?.focus();
}

export function limparPaciente() {
  recepcaoState.pessoaSelecionada = null;
  limparFormularioPaciente();
  document.getElementById('card-paciente-selecionado')?.classList.add('d-none');
}

function preencherFormularioPaciente(p) {
  document.getElementById('recepcao-cd-pessoa').value = p.CD_PESSOA_FISICA || '';
  document.getElementById('recepcao-nome-completo').value = p.NM_PESSOA_FISICA || '';
  document.getElementById('recepcao-nome-social').value = p.NM_SOCIAL || '';
  document.getElementById('recepcao-dt-nascimento').value = p.DT_NASC_ISO || '';
  document.getElementById('recepcao-sexo').value = p.IE_SEXO || 'M';
  document.getElementById('recepcao-cpf').value = p.NR_CPF || '';
  document.getElementById('recepcao-rg').value = p.NR_IDENTIDADE || '';
  document.getElementById('recepcao-nome-mae').value = p.NM_MAE || '';
  document.getElementById('recepcao-nome-pai').value = p.NM_PAI || '';
  document.getElementById('recepcao-cns').value = p.NR_CNS || '';
  document.getElementById('recepcao-celular').value = p.NR_TELEFONE_CELULAR || '';
  document.getElementById('recepcao-email').value = p.DS_EMAIL || '';

  // Endereço
  document.getElementById('recepcao-cep').value = p.CD_CEP || '';
  document.getElementById('recepcao-logradouro').value = p.DS_ENDERECO || '';
  document.getElementById('recepcao-numero').value = p.NR_ENDERECO || '';
  document.getElementById('recepcao-complemento').value = p.DS_COMPLEMENTO || '';
  document.getElementById('recepcao-bairro').value = p.DS_BAIRRO || '';
  document.getElementById('recepcao-cidade').value = p.DS_MUNICIPIO || '';
  document.getElementById('recepcao-uf').value = p.SG_ESTADO || '';
}

function limparFormularioPaciente() {
  document.getElementById('recepcao-cd-pessoa').value = '';
  document.getElementById('recepcao-nome-completo').value = '';
  document.getElementById('recepcao-nome-social').value = '';
  document.getElementById('recepcao-dt-nascimento').value = '';
  document.getElementById('recepcao-sexo').value = 'M';
  document.getElementById('recepcao-cpf').value = '';
  document.getElementById('recepcao-rg').value = '';
  document.getElementById('recepcao-nome-mae').value = '';
  document.getElementById('recepcao-nome-pai').value = '';
  document.getElementById('recepcao-cns').value = '';
  document.getElementById('recepcao-celular').value = '';
  document.getElementById('recepcao-email').value = '';

  document.getElementById('recepcao-cep').value = '';
  document.getElementById('recepcao-logradouro').value = '';
  document.getElementById('recepcao-numero').value = '';
  document.getElementById('recepcao-complemento').value = '';
  document.getElementById('recepcao-bairro').value = '';
  document.getElementById('recepcao-cidade').value = '';
  document.getElementById('recepcao-uf').value = '';
}

function exibirCardPacienteSelecionado(p) {
  const card = document.getElementById('card-paciente-selecionado');
  const nomeEl = document.getElementById('paciente-sel-nome');
  const detailsEl = document.getElementById('paciente-sel-details');

  if (card && nomeEl && detailsEl) {
    nomeEl.textContent = p.NM_PESSOA_FISICA;
    detailsEl.textContent = `CPF: ${p.NR_CPF || '-'} | Nasc: ${p.DT_NASC_FMT || '-'} | Cód TASY: ${p.CD_PESSOA_FISICA}`;
    card.classList.remove('d-none');
  }
}

// ============================================================================
// 7. ENDEREÇO & CONVÊNIO
// ============================================================================

export async function consultarCep(cepRaw) {
  const cep = String(cepRaw || '').replace(/\D/g, '');
  if (cep.length !== 8) return;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (!data.erro) {
      document.getElementById('recepcao-logradouro').value = data.logradouro || '';
      document.getElementById('recepcao-bairro').value = data.bairro || '';
      document.getElementById('recepcao-cidade').value = data.localidade || '';
      document.getElementById('recepcao-uf').value = data.uf || '';
      document.getElementById('recepcao-numero')?.focus();
      ui.showToast('Endereço preenchido automaticamente pelo CEP!', 'info');
    }
  } catch (e) {
    console.warn('[Recepção] Falha ao consultar ViaCEP:', e.message);
  }
}

export async function salvarPessoaEEndereco() {
  const btnAvancar = document.getElementById('modal-btn-avancar-passo');
  if (btnAvancar) ui.setLoading(btnAvancar, true);

  try {
    const payload = {
      cd_pessoa_fisica: document.getElementById('recepcao-cd-pessoa').value || null,
      nm_pessoa_fisica: document.getElementById('recepcao-nome-completo').value,
      nm_social: document.getElementById('recepcao-nome-social').value,
      dt_nascimento: document.getElementById('recepcao-dt-nascimento').value,
      ie_sexo: document.getElementById('recepcao-sexo').value,
      nr_cpf: document.getElementById('recepcao-cpf').value,
      nr_identidade: document.getElementById('recepcao-rg').value,
      nm_mae: document.getElementById('recepcao-nome-mae').value,
      nm_pai: document.getElementById('recepcao-nome-pai').value,
      nr_cns: document.getElementById('recepcao-cns').value,
      nr_telefone_celular: document.getElementById('recepcao-celular').value,
      ds_email: document.getElementById('recepcao-email').value,

      // Endereço
      cd_cep: document.getElementById('recepcao-cep').value,
      ds_endereco: document.getElementById('recepcao-logradouro').value,
      nr_endereco: document.getElementById('recepcao-numero').value,
      ds_complemento: document.getElementById('recepcao-complemento').value,
      ds_bairro: document.getElementById('recepcao-bairro').value,
      ds_municipio: document.getElementById('recepcao-cidade').value,
      sg_estado: document.getElementById('recepcao-uf').value
    };

    if (!payload.nm_pessoa_fisica || !payload.dt_nascimento) {
      ui.showToast('Nome completo e data de nascimento são obrigatórios.', 'warning');
      irParaPasso(1);
      return;
    }

    const res = await api.post('/api/recepcao/pessoas', payload);
    if (res.success && res.data) {
      document.getElementById('recepcao-cd-pessoa').value = res.data.cd_pessoa_fisica;
      recepcaoState.pessoaSelecionada = {
        ...payload,
        CD_PESSOA_FISICA: res.data.cd_pessoa_fisica,
        NM_PESSOA_FISICA: payload.nm_pessoa_fisica
      };
      exibirCardPacienteSelecionado(recepcaoState.pessoaSelecionada);
      ui.showToast('Dados cadastrais sincronizados no TASY!', 'success');
      irParaPasso(3); // Avança para convênio
    }
  } catch (err) {
    ui.showToast('Erro ao salvar paciente: ' + err.message, 'error');
  } finally {
    if (btnAvancar) ui.setLoading(btnAvancar, false);
  }
}

export async function carregarSetoresAtendimento() {
  const select = document.getElementById('recepcao-setor-atend');
  if (!select) return;

  try {
    const res = await api.get('/api/recepcao/setores');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      select.innerHTML = res.data.map(s => {
        const cd = s.CD_SETOR_ATENDIMENTO ?? s.cd_setor_atendimento;
        const nome = s.DS_SETOR_ATENDIMENTO ?? s.ds_setor_atendimento;
        const isSel = cd === 39 || String(cd) === '39';
        return `<option value="${cd}" ${isSel ? 'selected' : ''}>${cd} - ${escapeHtml(nome)}</option>`;
      }).join('');
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar setores:', err);
  }
}

export async function carregarConvenios() {
  const select = document.getElementById('recepcao-convenio');
  if (!select) return;

  try {
    const res = await api.get('/api/recepcao/convenios');
    if (res && res.success && Array.isArray(res.data)) {
      select.innerHTML = '<option value="">Selecione o convênio...</option>' +
        res.data.map(c => {
          const cd = c.CD_CONVENIO ?? c.cd_convenio;
          const nome = c.DS_CONVENIO ?? c.ds_convenio;
          const isSus = cd === 3 || String(cd) === '3';
          return `<option value="${cd}" ${isSus ? 'selected' : ''}>${escapeHtml(nome)}</option>`;
        }).join('');
      
      carregarCategoriasConvenio(3);
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar convênios:', err);
  }
}

export async function carregarClassificacoesAtendimento() {
  const select = document.getElementById('recepcao-classificacao');
  if (!select) return;

  try {
    const res = await api.get('/api/recepcao/classificacoes');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      select.innerHTML = res.data.map(c => {
        const seq = c.NR_SEQUENCIA ?? c.nr_sequencia;
        const nome = c.DS_CLASSIFICACAO ?? c.ds_classificacao;
        const isSel = seq === 2 || String(seq) === '2';
        return `<option value="${seq}" ${isSel ? 'selected' : ''}>${seq} - ${escapeHtml(nome)}</option>`;
      }).join('');
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar classificações:', err);
  }
}

export async function carregarCategoriasConvenio(cdConvenio, selectedCat = null) {
  const select = document.getElementById('recepcao-categoria');
  if (!select) return;

  if (!cdConvenio) {
    select.innerHTML = '<option value="">Selecione o convênio primeiro...</option>';
    return;
  }

  try {
    const res = await api.get(`/api/recepcao/convenios/${cdConvenio}/categorias`);
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      select.innerHTML = res.data.map(cat => {
        const cd = cat.CD_CATEGORIA ?? cat.cd_categoria;
        const nome = cat.DS_CATEGORIA ?? cat.ds_categoria;
        const isSel = selectedCat && String(cd) === String(selectedCat);
        return `<option value="${cd}" ${isSel ? 'selected' : ''}>${escapeHtml(nome)}</option>`;
      }).join('');
    } else {
      select.innerHTML = '<option value="1" selected>Padrão / Geral</option>';
    }
  } catch (err) {
    select.innerHTML = '<option value="1" selected>Padrão / Geral</option>';
  }
}

export async function carregarUltimoConvenioPaciente(cdPessoaFisica) {
  if (!cdPessoaFisica) return;

  try {
    const res = await api.get(`/api/recepcao/pessoas/${cdPessoaFisica}/ultimo-convenio`);
    if (res && res.success && res.data) {
      const conv = res.data;
      const selectConv = document.getElementById('recepcao-convenio');
      const inputCart = document.getElementById('recepcao-carteirinha');

      if (selectConv && conv.CD_CONVENIO) {
        selectConv.value = conv.CD_CONVENIO;
        await carregarCategoriasConvenio(conv.CD_CONVENIO, conv.CD_CATEGORIA);
      }
      if (inputCart && conv.CD_USUARIO_CONVENIO) {
        inputCart.value = conv.CD_USUARIO_CONVENIO;
      }
      ui.showToast(`Convênio anterior (${conv.DS_CONVENIO || ''}) recuperado automaticamente!`, 'info');
    }
  } catch (err) {
    console.warn('[Recepção] Sem convênio prévio para este paciente:', err);
  }
}

// ============================================================================
// 8. ABERTURA DE ATENDIMENTO OFICIAL NO TASY
// ============================================================================

export async function abrirAtendimento() {
  const cdPf = document.getElementById('recepcao-cd-pessoa').value || recepcaoState.pessoaSelecionada?.CD_PESSOA_FISICA;
  if (!cdPf) {
    ui.showToast('Nenhum paciente identificado para abrir atendimento.', 'warning');
    irParaPasso(1);
    return;
  }

  const convVal = document.getElementById('recepcao-convenio')?.value;
  if (!convVal) {
    ui.showToast('Selecione o Convênio para abrir o atendimento.', 'warning');
    irParaPasso(3);
    return;
  }

  const btnAvancar = document.getElementById('modal-btn-avancar-passo');
  const btnAbrir = document.getElementById('btn-recepcao-abrir-atendimento');
  if (btnAvancar) ui.setLoading(btnAvancar, true);
  if (btnAbrir) ui.setLoading(btnAbrir, true);

  try {
    const payload = {
      cd_pessoa_fisica: cdPf,
      cd_setor_atendimento: document.getElementById('recepcao-setor-atend')?.value || 39,
      cd_convenio: convVal,
      cd_categoria: document.getElementById('recepcao-categoria')?.value || '1',
      cd_usuario_convenio: document.getElementById('recepcao-carteirinha')?.value || '0',
      nr_seq_classificacao: document.getElementById('recepcao-classificacao')?.value || 2,
      cd_procedencia: document.getElementById('recepcao-procedencia')?.value || 1,
      nr_seq_pac_senha_fila: recepcaoState.senhaAtiva?.nr_sequencia || null,
      nr_fila_destino: 18 // Fila de Triagem / P.A.
    };

    const res = await api.post('/api/recepcao/atendimentos', payload);
    if (res.success && res.data) {
      recepcaoState.atendimentoCriado = res.data.nr_atendimento;
      
      const numAtendEl = document.getElementById('recepcao-atendimento-numero');
      if (numAtendEl) numAtendEl.textContent = res.data.nr_atendimento;

      ui.showToast(`Atendimento #${res.data.nr_atendimento} aberto com sucesso no TASY!`, 'success');
      
      await carregarRelatorios();
      await carregarDocumentosGED();
      await carregarSenhas();
      await carregarAtendimentosHoje();
      irParaPasso(5); // Avança para Relatórios e GED
    }
  } catch (err) {
    ui.showToast('Erro ao abrir atendimento: ' + (err.message || JSON.stringify(err)), 'error');
  } finally {
    if (btnAvancar) ui.setLoading(btnAvancar, false);
    if (btnAbrir) ui.setLoading(btnAbrir, false);
  }
}

// ============================================================================
// 9. EMISSÃO NATIVA DE RELATÓRIOS TASYREPORTS & GED
// ============================================================================

export async function carregarRelatorios() {
  const container = document.getElementById('recepcao-relatorios-list');
  if (!container) return;

  try {
    const res = await api.get('/api/recepcao/relatorios');
    if (res.success && Array.isArray(res.data)) {
      recepcaoState.relatorios = res.data;
      container.innerHTML = res.data.map(r => {
        const cd = r.cd_relatorio || r.CD_RELATORIO;
        const titulo = r.ds_titulo || r.DS_TITULO;
        const icone = r.icone || 'bi-file-earmark-text';
        const badge = r.badge || 'TASY';
        return `
        <div class="relatorio-card-item">
          <div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-secondary" style="font-size: 0.72rem;">${escapeHtml(badge)}</span>
              <small class="text-muted fw-bold">Cód: ${cd}</small>
            </div>
            <div class="relatorio-card-title"><i class="bi ${icone} text-primary me-1"></i> ${escapeHtml(titulo)}</div>
          </div>
          <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-primary flex-grow-1" type="button" onclick="window.conectaCore.imprimirRelatorio(${cd}, '${escapeHtml(titulo)}')">
              <i class="bi bi-printer"></i> Visualizar & Imprimir
            </button>
            <a class="btn btn-sm btn-outline-secondary" href="http://192.168.1.25" target="_blank" title="Abrir no TASY HTML5">
              <i class="bi bi-box-arrow-up-right"></i>
            </a>
          </div>
        </div>
      `;
      }).join('');
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar relatórios:', err);
  }
}

export function imprimirRelatorio(cdRelatorio, titulo) {
  let nrAtendimento = recepcaoState.atendimentoCriado || document.getElementById('recepcao-atendimento-numero')?.textContent || null;
  if (nrAtendimento) {
    nrAtendimento = String(nrAtendimento).replace(/[^0-9]/g, '').trim();
  }
  
  if (!nrAtendimento || nrAtendimento === '' || nrAtendimento === '0') {
    ui.showToast('Abra ou selecione um atendimento antes de emitir o relatório.', 'warning');
    return;
  }

  ui.showToast(`Gerando PDF oficial do TASY para "${titulo}" (Atendimento #${nrAtendimento})...`, 'info');
  window.open(`/api/recepcao/relatorios/${cdRelatorio}/gerar?nr_atendimento=${encodeURIComponent(nrAtendimento)}`, '_blank');
}

export async function carregarDocumentosGED() {
  const container = document.getElementById('recepcao-ged-list');
  if (!container) return;

  try {
    const atend = recepcaoState.atendimentoCriado || '';
    const pf = recepcaoState.pessoaSelecionada?.CD_PESSOA_FISICA || '';
    const res = await api.get(`/api/recepcao/ged?nr_atendimento=${atend}&cd_pessoa_fisica=${pf}`);
    
    if (res.success && Array.isArray(res.data)) {
      recepcaoState.documentosGED = res.data;
      if (res.data.length === 0) {
        container.innerHTML = '<div class="p-3 text-center text-muted col-12">Nenhum documento anexado ainda para este atendimento.</div>';
        return;
      }
      container.innerHTML = res.data.map(doc => `
        <div class="ged-file-item">
          <i class="bi bi-file-earmark-text ged-file-icon"></i>
          <strong>${escapeHtml(doc.DS_TITULO)}</strong>
          <small class="text-muted">${escapeHtml(doc.DT_REGISTRO_FMT || '')} • Por: ${escapeHtml(doc.NM_USUARIO || '')}</small>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar GED:', err);
  }
}

export function abrirUploadGED() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,application/pdf';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      ui.showToast(`Enviando "${file.name}" para o Storage do TASY...`, 'info');

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = event.target.result;
          const atend = recepcaoState.atendimentoCriado || document.getElementById('recepcao-atendimento-numero')?.textContent?.replace(/[^0-9]/g, '') || null;
          const pf = recepcaoState.pessoaSelecionada?.CD_PESSOA_FISICA || null;

          await api.post('/api/recepcao/ged', {
            nr_atendimento: atend,
            cd_pessoa_fisica: pf,
            ds_titulo: file.name,
            ds_arquivo: file.name,
            ds_extensao_arquivo: file.name.split('.').pop(),
            conteudo_base64: base64Data,
            mime_type: file.type
          });

          ui.showToast('Documento anexado e sincronizado com o GED do TASY com sucesso!', 'success');
          await carregarDocumentosGED();
          await carregarAtendimentosHoje();
        } catch (postErr) {
          ui.showToast('Erro ao salvar documento no GED: ' + (postErr.message || JSON.stringify(postErr)), 'error');
        }
      };

      reader.onerror = () => {
        ui.showToast('Erro ao ler o arquivo local.', 'error');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      ui.showToast('Erro ao anexar arquivo no GED: ' + err.message, 'error');
    }
  };
  input.click();
}

// Expõe métodos globais para callbacks de HTML inline
if (!window.conectaCore) window.conectaCore = {};
window.conectaCore.selecionarSenhaFila = selecionarSenhaFila;
window.conectaCore.selecionarPaciente = selecionarPaciente;
window.conectaCore.novoPaciente = novoPaciente;
window.conectaCore.imprimirRelatorio = imprimirRelatorio;
window.conectaCore.abrirModalAtendimento = abrirModalAtendimento;
window.conectaCore.irParaPasso = irParaPasso;
window.conectaCore.trocarAbaRecepcao = trocarAbaRecepcao;
window.conectaCore.abrirDocumentosAtendimento = abrirDocumentosAtendimento;
