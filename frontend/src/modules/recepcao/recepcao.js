import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import * as ui from '../../core/ui.js';
import { escapeHtml } from '../../core/utils.js';

/**
 * Módulo de Recepção & Acolhimento — Conecta HEAL 2.0
 * Padrão Conecta: Fila de Espera (Guichê) + Histórico de Atendimentos do Dia (GED) + Modal Wizard
 */

export let recepcaoState = {
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

// Vincula funções vitais ao escopo global para que outros módulos (como Dashboard PA) possam usar a grade de senhas
if (typeof window !== 'undefined') {
  window.conectaCore = window.conectaCore || {};
  // As funções abaixo serão sobrescritas ou declaradas na sequência, usamos wrappers para resolver o hoisting
  window.conectaCore.chamarSenhaEspecifica = (nr, e) => chamarSenhaEspecifica(nr, e);
  window.conectaCore.selecionarSenhaFila = (nr) => selecionarSenhaFila(nr);
  window.conectaCore.recepcaoState = recepcaoState;
}

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
  window.conectaCore.recepcaoState = recepcaoState;
  window.conectaCore.chamarSenhaEspecifica = chamarSenhaEspecifica;
window.conectaCore.inutilizarSenha = inutilizarSenha;
  window.conectaCore.selecionarPaciente = selecionarPaciente;
  window.conectaCore.novoPaciente = novoPaciente;
  window.conectaCore.imprimirRelatorio = imprimirRelatorio;
  window.conectaCore.abrirModalAtendimento = abrirModalAtendimento;
  window.conectaCore.trocarAbaRecepcao = trocarAbaRecepcao;
  window.conectaCore.abrirDocumentosAtendimento = abrirDocumentosAtendimento;
window.conectaCore.inativarGED = inativarGED;
  window.conectaCore.verificarDuplicidadeCpf = verificarDuplicidadeCpf;
  window.conectaCore.carregarSenhas = carregarSenhas;
  window.conectaCore.carregarSenhasTriagem = carregarSenhasTriagem;
  window.conectaCore.renderizarBoardSenhasTriagem = renderizarBoardSenhasTriagem;

  bindRecepcaoEvents();
  await detectarEConfigurarGuiche();

  // Restaura referência da última senha chamada se recente (12h)
  try {
    const raw = localStorage.getItem('conecta_recepcao_ultima_senha');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.numero && (Date.now() - (parsed.timestamp || 0) < 12 * 3600 * 1000)) {
        recepcaoState.senhaAtiva = parsed.dados || {
          cd_senha_gerada: parsed.numero,
          ds_prioridade: parsed.tipo || 'Normal'
        };
        const numEl = document.getElementById('guiche-active-number');
        const typeEl = document.getElementById('guiche-active-type');
        if (numEl) numEl.textContent = `#${parsed.numero}`;
        if (typeEl) typeEl.textContent = parsed.tipo || 'Chamado';
      }
    }
  } catch (e) {
    console.warn('[Recepção] Aviso ao restaurar última senha do guichê:', e);
  }

  await carregarFilas();
  await carregarSenhas();
  await carregarAtendimentosHoje();
      if (window.conectaCore && typeof window.conectaCore.loadDashboardPA === 'function') { window.conectaCore.loadDashboardPA(false); }
  await carregarSetoresAtendimento();
  await carregarConvenios();
  await carregarClassificacoesAtendimento();
  startQueuePolling();
}

async function detectarEConfigurarGuiche() {
  const selectGuiche = document.getElementById('recepcao-select-meu-guiche');
  const btnTv = document.getElementById('btn-recepcao-abrir-tv');

  try {
    const maquinaSalva = localStorage.getItem('conecta_ds_maquina');
    const res = await api.get(`/api/painel/detectar-maquina${maquinaSalva ? `?maquina=${encodeURIComponent(maquinaSalva)}` : ''}`);
    if (res.success && res.data) {
      if (selectGuiche && res.data.ds_guiche_sugerido) {
        selectGuiche.value = res.data.ds_guiche_sugerido;
      }
      if (res.data.cd_maquina) {
        localStorage.setItem('conecta_ds_maquina', res.data.cd_maquina);
      }
      if (btnTv && res.data.painel_sugerido) {
        btnTv.href = `/painel.html?painel=${encodeURIComponent(res.data.painel_sugerido)}`;
      }

      const btnChamar = document.getElementById('btn-recepcao-chamar-proximo');
      const btnRechamar = document.getElementById('btn-recepcao-rechamar');
      const permiteChamar = res.data.permite_chamar_senha !== false;
      if (!permiteChamar) {
        if (btnChamar) {
          btnChamar.disabled = true;
          btnChamar.title = 'Este computador não possui permissão para chamar senhas no painel indicado.';
          btnChamar.classList.add('opacity-50');
        }
        if (btnRechamar) {
          btnRechamar.disabled = true;
          btnRechamar.title = 'Este computador não possui permissão para chamar senhas no painel indicado.';
          btnRechamar.classList.add('opacity-50');
        }
      } else {
        if (btnChamar) {
          btnChamar.disabled = false;
          btnChamar.removeAttribute('title');
          btnChamar.classList.remove('opacity-50');
        }
        if (btnRechamar) {
          btnRechamar.disabled = false;
          btnRechamar.removeAttribute('title');
          btnRechamar.classList.remove('opacity-50');
        }
      }
    }
  } catch (err) {
    console.warn('[Recepção] Erro ao detectar posto de atendimento:', err);
  }
}

function bindRecepcaoEvents() {
  const selectGuiche = document.getElementById('recepcao-select-meu-guiche');
  if (selectGuiche && !selectGuiche.dataset.bound) {
    selectGuiche.dataset.bound = '1';
    selectGuiche.addEventListener('change', (e) => {
      localStorage.setItem('conecta_ds_guiche', e.target.value);
      ui.showToast(`Posto de atendimento definido como: ${e.target.value}`, 'info');
    });
  }

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

  // Busca Inteligente de Paciente no Modal
  const inputBusca = document.getElementById('recepcao-busca-paciente');
  let searchTimeout = null;
  inputBusca?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      buscarPacientes(e.target.value);
    }, 250);
  });

  // Validação em Tempo Real de Duplicidade (CPF e Nascimento)
  const inputCpf = document.getElementById('recepcao-cpf');
  let cpfTimeout = null;
  inputCpf?.addEventListener('input', (e) => {
    clearTimeout(cpfTimeout);
    cpfTimeout = setTimeout(() => {
      verificarDuplicidadeCpf(e.target.value);
    }, 350);
  });
  inputCpf?.addEventListener('blur', (e) => {
    verificarDuplicidadeCpf(e.target.value);
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

  // A troca de aba nunca deve movimentar a barra lateralmente.
  const workspaceRecepcao = document.getElementById('workspace-recepcao');
  if (workspaceRecepcao && workspaceRecepcao.scrollLeft) {
    workspaceRecepcao.scrollLeft = 0;
  }

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
  try {
    const res = await api.get('/api/recepcao/filas?modulo=recepcao');
    if (res && res.success && Array.isArray(res.data)) {
      recepcaoState.filasDisponiveis = res.data;
      recepcaoState.modoVisualizacao = res.modo_visualizacao || 'SENHA';
      recepcaoState.filaSelecionada = '';
    } else {
      recepcaoState.filaSelecionada = '';
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar filas:', err);
    recepcaoState.filaSelecionada = '';
  }
}

export async function carregarSenhas(showFeedback = false) {
  const container = document.getElementById('recepcao-senhas-grid');
  try {
    const res = await api.get(`/api/recepcao/senhas?modulo=recepcao`);
    if (res && res.success && Array.isArray(res.data)) {
      recepcaoState.senhasFila = res.data;
      renderizarBoardSenhas();
      if (showFeedback) {
        ui.showToast('Fila de senhas atualizada!', 'info');
      }
    } else {
      renderizarBoardSenhas([]);
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

export async function carregarSenhasTriagem(showFeedback = false) {
  const containerTriagem = document.getElementById('triagem-senhas-grid');
  if (!containerTriagem) return;
  try {
    const res = await api.get(`/api/recepcao/senhas?modulo=dashboard_pa`);
    if (res && res.success && Array.isArray(res.data)) {
      recepcaoState.senhasFilaTriagem = res.data;
      renderizarBoardSenhasTriagem(res.data);
      if (showFeedback) {
        ui.showToast('Fila de triagem P.A. atualizada!', 'info');
      }
    } else {
      renderizarBoardSenhasTriagem([]);
    }
  } catch (err) {
    console.error('[Triagem PA] Erro ao carregar senhas:', err);
    if (containerTriagem && (!recepcaoState.senhasFilaTriagem || recepcaoState.senhasFilaTriagem.length === 0)) {
      const isForbidden = err?.status === 403;
      containerTriagem.innerHTML = `
        <div class="col-12 p-4 text-center text-muted">
          <i class="bi bi-${isForbidden ? 'shield-lock text-warning' : 'exclamation-circle text-danger'} fs-2 d-block mb-2"></i>
          <h6 class="fw-bold ${isForbidden ? 'text-warning' : 'text-danger'}">${isForbidden ? 'Fila não habilitada para este perfil' : 'Erro ao carregar fila'}</h6>
          <p class="small text-muted">${isForbidden ? 'Habilite as filas de triagem deste perfil no Conecta Admin.' : (err?.message || 'Verifique sua conexão.')}</p>
          <button class="btn btn-sm btn-outline-primary mt-2" type="button" onclick="window.conectaCore.carregarSenhasTriagem(true)">
            <i class="bi bi-arrow-clockwise me-1"></i> Tentar Novamente
          </button>
        </div>`;
    }
  }
}

export function renderizarBoardSenhasTriagem(listaFiltrada = null) {
  const containerTriagem = document.getElementById('triagem-senhas-grid');
  if (!containerTriagem) return;

  const lista = listaFiltrada !== null ? listaFiltrada : (recepcaoState.senhasFilaTriagem || []);

  if (lista.length === 0) {
    containerTriagem.innerHTML = `
      <div class="text-center text-muted mt-5 p-4">
        <i class="bi bi-inbox fs-1 d-block mb-2 text-primary opacity-50"></i>
        <h6 class="fw-bold text-dark">Nenhuma senha aguardando no momento</h6>
        <p class="small text-muted mb-3">Todas as senhas desta fila foram atendidas ou não há novas emissões no totem.</p>
        <button class="btn btn-sm btn-outline-primary shadow-sm" type="button" onclick="window.conectaCore.carregarSenhasTriagem(true)">
          <i class="bi bi-arrow-clockwise me-1"></i> Atualizar Fila
        </button>
      </div>`;
    return;
  }

  const senhasPorFila = {};
  lista.forEach(s => {
    const filaId = s.NR_SEQ_FILA_SENHA ?? s.nr_seq_fila_senha ?? 0;
    const dsFila = s.DS_FILA ?? s.ds_fila ?? 'Triagem P.A.';
    if (!senhasPorFila[filaId]) {
      senhasPorFila[filaId] = { id: filaId, nome: dsFila, senhas: [] };
    }
    senhasPorFila[filaId].senhas.push(s);
  });

  const filasComSenhas = Object.values(senhasPorFila);
  const triagemHtml = filasComSenhas.map(fila => {
    return `
      <div class="pa-queue-group">
        <div class="pa-queue-group-title">
          <span><i class="bi bi-diagram-3 me-2"></i>${escapeHtml(fila.nome)}</span>
          <span class="badge bg-white rounded-pill" style="color: var(--primary);">${fila.senhas.length}</span>
        </div>
        <div class="pa-queue-list">
          ${fila.senhas.map(s => {
            const nrSeq = s.NR_SEQUENCIA ?? s.nr_sequencia;
            const cdSenha = s.CD_SENHA_GERADA ?? s.cd_senha_gerada;
            const numLimpo = String(cdSenha || '').replace(/^[^\d]*/i, '').trim();
            const cdFormatado = numLimpo ? `P ${numLimpo}` : (cdSenha || '---');
            const minEspera = s.MINUTOS_ESPERA ?? s.minutos_espera ?? 0;
            const nomePaciente = s.NM_PACIENTE ?? s.nm_paciente ?? s.NM_SOCIAL ?? s.nm_social ?? s.NM_PESSOA_FISICA ?? s.nm_pessoa_fisica ?? null;
            const initials = numLimpo || 'S';
            const nrAtendimento = s.NR_ATENDIMENTO ?? s.nr_atendimento;
            const emAndamento = nrAtendimento != null;
            return `
              <article class="pa-queue-card">
                <div class="pa-queue-number">${initials}</div>
                <div class="pa-queue-main">
                    <div class="pa-queue-line">
                      <span class="pa-queue-code">${escapeHtml(cdFormatado)}</span>
                      <span class="pa-wait-badge">
                        <i class="bi bi-clock me-1"></i>${minEspera} min
                      </span>
                      ${emAndamento ? '<span class="pa-wait-badge"><i class="bi bi-play-circle me-1"></i>Em andamento</span>' : ''}
                    </div>
                    <div class="pa-queue-status" title="${escapeHtml(nomePaciente || 'Aguardando identificação')}">
                      ${nomePaciente ? escapeHtml(nomePaciente) : '<i class="bi bi-person-dash me-1"></i>Aguardando identificação'}
                    </div>
                </div>
                <div class="pa-queue-buttons">
                  <button class="btn btn-sm btn-outline-danger" type="button" onclick="window.conectaCore.descartarSenhaPA(${nrSeq}, '${escapeHtml(cdFormatado)}')" title="Descartar Senha">
                    <i class="bi bi-trash-fill"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-primary" type="button" onclick="window.conectaCore.chamarSenhaEspecifica(${nrSeq}, event)" title="Chamar na TV">
                    <i class="bi bi-megaphone-fill me-1"></i> Chamar
                  </button>
                  ${emAndamento ? `
                  <button class="btn btn-sm btn-warning" type="button" onclick="window.conectaCore.abrirModalTriagemPA(${nrSeq}, '${escapeHtml(cdFormatado)}', '${escapeHtml(nomePaciente || '')}', true)" title="Continuar Triagem">
                    <i class="bi bi-play-fill me-1"></i> Continuar Triagem
                  </button>
                  ` : `
                  <button class="btn btn-sm btn-success" type="button" onclick="window.conectaCore.abrirModalTriagemPA(${nrSeq}, '${escapeHtml(cdFormatado)}', '${escapeHtml(nomePaciente || '')}', false)" title="Atender e Identificar">
                    <i class="bi bi-person-check-fill me-1"></i> Atender
                  </button>
                  `}
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  containerTriagem.innerHTML = '<div class="d-flex flex-column gap-3 w-100">' + triagemHtml + '</div>';
}

function renderizarBoardSenhas(listaFiltrada = null) {
  const container = document.getElementById('recepcao-senhas-grid');
  const countBadge = document.getElementById('recepcao-queue-count');
  const tabBadge = document.getElementById('tab-badge-espera');
  const kpiTotal = document.getElementById('kpi-total-espera');
  if (!container) return;

  const lista = listaFiltrada !== null ? listaFiltrada : (recepcaoState.senhasFila || []);

  if (countBadge) countBadge.textContent = lista.length;
  if (tabBadge) tabBadge.textContent = lista.length;
  if (kpiTotal) kpiTotal.textContent = (recepcaoState.senhasFila || []).length;

  if (lista.length === 0) {
    container.className = 'w-100';
    container.style = '';
    container.innerHTML = `
      <div class="col-12 p-5 text-center text-muted w-100" style="grid-column: 1 / -1;">
        <i class="bi bi-inbox fs-1 d-block mb-2 text-primary opacity-50"></i>
        <h5 class="fw-bold">Nenhuma senha aguardando atendimento</h5>
        <p class="small text-muted mb-3">O guichê está livre. Clique em "Próxima Senha" ou "Avulso" para iniciar.</p>
        <button class="btn btn-sm btn-outline-primary" type="button" onclick="window.conectaCore.abrirModalAtendimento()">
          <i class="bi bi-person-plus"></i> Abrir Atendimento Avulso
        </button>
      </div>`;
    return;
  }

  // Agrupar senhas por fila
  const senhasPorFila = {};
  lista.forEach(s => {
    const filaId = s.NR_SEQ_FILA_SENHA ?? s.nr_seq_fila_senha ?? 0;
    const dsFila = s.DS_FILA ?? s.ds_fila ?? 'Recepção';
    if (!senhasPorFila[filaId]) {
      senhasPorFila[filaId] = { id: filaId, nome: dsFila, senhas: [] };
    }
    senhasPorFila[filaId].senhas.push(s);
  });

  // Gerar grid flexível
  const filasComSenhas = Object.values(senhasPorFila);

  if (container) {
    container.className = 'recepcao-filas-board';
    container.style = '';
    const colunasHtml = filasComSenhas.map(fila => {
      const cardsHtml = fila.senhas.map(s => {
        const nrSeq = s.NR_SEQUENCIA ?? s.nr_sequencia;
        const cdSenha = s.CD_SENHA_GERADA ?? s.cd_senha_gerada ?? '';
        const numLimpo = String(cdSenha || '').replace(/^[^\d]*/i, '').trim();
        const cdFormatado = numLimpo ? `P ${numLimpo}` : (cdSenha || '---');
        const minEspera = s.MINUTOS_ESPERA ?? s.minutos_espera ?? 0;
        const nomePaciente = s.NM_PACIENTE ?? s.nm_paciente ?? s.NM_SOCIAL ?? s.nm_social ?? s.NM_PESSOA_FISICA ?? s.nm_pessoa_fisica ?? null;
        const displayNumeroQuadrado = numLimpo || cdSenha || '---';

        return `
          <div class="recepcao-ticket-card" data-nr-seq="${nrSeq}">
            <div class="recepcao-ticket-left">
              <div class="recepcao-ticket-square">${escapeHtml(displayNumeroQuadrado)}</div>
              <div class="recepcao-ticket-info">
                <div class="recepcao-ticket-info-top">
                  <span class="recepcao-ticket-num">${escapeHtml(cdFormatado)}</span>
                  <span class="recepcao-ticket-wait">
                    <i class="bi bi-clock"></i> ${minEspera} min
                  </span>
                </div>
                <div class="recepcao-ticket-paciente" title="${escapeHtml(nomePaciente || 'Aguardando identificação')}">
                  <i class="bi bi-person"></i> ${escapeHtml(nomePaciente || 'Aguardando identificação')}
                </div>
              </div>
            </div>
            <div class="recepcao-ticket-actions">
              <button class="btn-recepcao-chamar" type="button" onclick="window.conectaCore.chamarSenhaEspecifica(${nrSeq}, event)" title="Chamar no painel TV">
                <i class="bi bi-megaphone-fill"></i> Chamar
              </button>
              <button class="btn-recepcao-atender" type="button" onclick="window.conectaCore.selecionarSenhaFila(${nrSeq})" title="Iniciar Atendimento">
                <i class="bi bi-person-fill"></i> Atender
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="recepcao-fila-coluna">
          <div class="recepcao-fila-header">
            <div class="recepcao-fila-header-title">
              <i class="bi bi-diagram-3"></i>
              <span>${escapeHtml(fila.nome)}</span>
            </div>
            <span class="recepcao-fila-badge-count">${fila.senhas.length}</span>
          </div>
          <div class="recepcao-fila-items">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = colunasHtml;
  }
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
    const nome = String(s.NM_PACIENTE ?? s.nm_paciente ?? s.NM_SOCIAL ?? s.nm_social ?? s.NM_PESSOA_FISICA ?? s.nm_pessoa_fisica ?? '').toLowerCase();
    return cd.includes(q) || prio.includes(q) || fila.includes(q) || nome.includes(q);
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
    
    const statusAtend = item.IE_STATUS_ATENDIMENTO ?? item.ie_status_atendimento;
    const dtAlta = item.DT_ALTA ?? item.dt_alta;
    const dtCancelamento = item.DT_CANCELAMENTO ?? item.dt_cancelamento;
    const isCancelado = statusAtend === 'C' || dtCancelamento;

    let badgeStatus = '<span class="badge bg-success-subtle text-success border border-success-subtle mt-1" style="font-size: 0.65rem;"><i class="bi bi-check-circle me-1"></i>Aberto</span>';
    if (isCancelado) {
      badgeStatus = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle mt-1" style="font-size: 0.65rem;"><i class="bi bi-x-circle me-1"></i>Cancelado</span>';
    } else if (dtAlta) {
      badgeStatus = '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle mt-1" style="font-size: 0.65rem;"><i class="bi bi-box-arrow-right me-1"></i>Alta</span>';
    }

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
        <td>
          <span class="atend-badge-numero">#${atend}</span>
          <div class="mt-1">${badgeStatus}</div>
        </td>
        <td>
          <div class="small fw-semibold">${escapeHtml(conv)}</div>
          <small class="text-muted">${escapeHtml(setor)}</small>
        </td>
        <td>${badgeGed}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-primary fw-bold" type="button" onclick="window.conectaCore.abrirDocumentosAtendimento(${atend}, '${cdPf}', '${escapeHtml(nome)}', '${senha || ''}')">
            <i class="bi bi-printer-fill me-1"></i> Documentos
          </button>
          ${isCancelado ? '' : `<button class="btn btn-sm btn-outline-danger fw-bold ms-1" type="button" onclick="window.conectaCore.cancelarAtendimento(${atend}, '${escapeHtml(nome)}')">
            <i class="bi bi-x-circle"></i> Cancelar
          </button>`}
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

function obterNomeMaquina() {
  const customPosto = localStorage.getItem('conecta_ds_guiche');
  if (customPosto && customPosto.trim()) return customPosto.trim();
  const selectGuichePa = document.getElementById('recepcao-select-meu-guiche-pa');
  if (selectGuichePa && selectGuichePa.value && !document.getElementById('workspace-dashboard-internacao')?.classList.contains('d-none')) return selectGuichePa.value;
  const selectGuiche = document.getElementById('recepcao-select-meu-guiche');
  if (selectGuiche && selectGuiche.value) return selectGuiche.value;
  const custom = localStorage.getItem('conecta_ds_maquina');
  if (custom && custom.trim()) return custom.trim();
  if (state.usuario?.nm_computador) return state.usuario.nm_computador;
  return 'NOTE-CESARIO';
}

export async function chamarProximaSenha() {
  const btn = document.getElementById('btn-recepcao-chamar-proximo');
  if (btn) ui.setLoading(btn, true);

  try {
    const stateFila = recepcaoState.filaSelecionada || null;
    const fila = stateFila ? parseInt(stateFila, 10) : undefined;
    const maquina = obterNomeMaquina();
    const res = await api.post('/api/recepcao/senhas/chamar', {
      nr_seq_fila_senha: fila,
      ds_maquina: maquina
    });

    if (res.success && res.proxima && res.data) {
      recepcaoState.senhaAtiva = res.data;
      atualizarDisplaySenha(res.data.cd_senha_gerada, 'Chamado', res.data);
      const nomeChamado = res.data.nm_paciente;
      if (nomeChamado) {
        ui.showToast(`Paciente ${nomeChamado} (Senha #${res.data.cd_senha_gerada}) chamado no guichê!`, 'success');
      } else {
        ui.showToast(`Senha #${res.data.cd_senha_gerada} chamada no guichê!`, 'success');
      }
      await carregarSenhas();
      if (window.conectaCore && typeof window.conectaCore.abrirModalTriagemPA === 'function' && !document.getElementById('workspace-dashboard-internacao')?.classList.contains('d-none')) {
        const numLimpo = String(res.data.cd_senha_gerada || '').replace(/^[^\d]*/i, '').trim();
        const cdFormatado = numLimpo ? `P ${numLimpo}` : (res.data.cd_senha_gerada || '---');
        window.conectaCore.abrirModalTriagemPA(res.data.nr_sequencia, cdFormatado, res.data.nm_paciente || '');
      } else {
        abrirModalAtendimento(res.data);
      }
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
    const maquina = obterNomeMaquina();
    await api.post('/api/recepcao/senhas/rechamar', {
      nr_sequencia: recepcaoState.senhaAtiva.nr_sequencia,
      ds_maquina: maquina
    });
    const nomeChamado = recepcaoState.senhaAtiva.nm_paciente;
    if (nomeChamado) {
      ui.showToast(`Paciente ${nomeChamado} (Senha #${recepcaoState.senhaAtiva.cd_senha_gerada}) rechamado no painel!`, 'info');
    } else {
      ui.showToast(`Senha #${recepcaoState.senhaAtiva.cd_senha_gerada} rechamada no painel!`, 'info');
    }
  } catch (err) {
    ui.showToast('Erro ao rechamar senha: ' + err.message, 'error');
  }
}

export async function chamarSenhaEspecifica(nrSequencia, event) {
  if (event) {
    event.stopPropagation();
  }
  const senha = (recepcaoState.senhasFila || []).find(s => (s.NR_SEQUENCIA ?? s.nr_sequencia) == nrSequencia) 
             || (recepcaoState.senhasFilaTriagem || []).find(s => (s.NR_SEQUENCIA ?? s.nr_sequencia) == nrSequencia);
  if (!senha) {
    return;
  }
  
  const seq = senha.NR_SEQUENCIA ?? senha.nr_sequencia;
  const cd = senha.CD_SENHA_GERADA ?? senha.cd_senha_gerada;
  const nomePac = senha.NM_PACIENTE ?? senha.nm_paciente ?? senha.NM_SOCIAL ?? senha.nm_social ?? senha.NM_PESSOA_FISICA ?? senha.nm_pessoa_fisica ?? null;
  const maquina = obterNomeMaquina();

  try {
    await api.post('/api/recepcao/senhas/rechamar', {
      nr_sequencia: seq,
      ds_maquina: maquina
    });

    recepcaoState.senhaAtiva = {
      nr_sequencia: seq,
      cd_senha_gerada: cd,
      nm_paciente: nomePac,
      ds_prioridade: senha.DS_PRIORIDADE ?? senha.ds_prioridade ?? 'Normal',
      nr_prioridade: senha.NR_PRIORIDADE ?? senha.nr_prioridade ?? 3,
      ds_guiche: maquina
    };

    atualizarDisplaySenha(cd, 'Chamado', recepcaoState.senhaAtiva);
    if (nomePac) {
      ui.showToast(`Paciente ${nomePac} (Senha #${cd}) chamado no guichê e na TV!`, 'success');
    } else {
      ui.showToast(`Senha #${cd} chamada no guichê e na TV!`, 'success');
    }
    await carregarSenhas();
  } catch (err) {
    ui.showToast('Erro ao chamar senha: ' + err.message, 'error');
  }
}

export function selecionarSenhaFila(nrSequencia) {
  const senha = (recepcaoState.senhasFila || []).find(s => (s.NR_SEQUENCIA ?? s.nr_sequencia) == nrSequencia)
             || (recepcaoState.senhasFilaTriagem || []).find(s => (s.NR_SEQUENCIA ?? s.nr_sequencia) == nrSequencia);
  if (senha) {
    const seq = senha.NR_SEQUENCIA ?? senha.nr_sequencia;
    const cd = senha.CD_SENHA_GERADA ?? senha.cd_senha_gerada;
    const prio = senha.DS_PRIORIDADE ?? senha.ds_prioridade ?? 'Normal';
    const nomePac = senha.NM_PACIENTE ?? senha.nm_paciente ?? senha.NM_SOCIAL ?? senha.nm_social ?? senha.NM_PESSOA_FISICA ?? senha.nm_pessoa_fisica ?? null;
    recepcaoState.senhaAtiva = {
      nr_sequencia: seq,
      cd_senha_gerada: cd,
      nm_paciente: nomePac,
      ds_prioridade: prio
    };
    atualizarDisplaySenha(cd, prio, recepcaoState.senhaAtiva);
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

function atualizarDisplaySenha(numero, tipo, dadosCompletos = null) {
  const numEl = document.getElementById('guiche-active-number');
  const typeEl = document.getElementById('guiche-active-type');
  const dados = dadosCompletos || recepcaoState.senhaAtiva;
  const nome = dados?.NM_PACIENTE || dados?.nm_paciente || dados?.NM_SOCIAL || dados?.nm_social || dados?.NM_PESSOA_FISICA || dados?.nm_pessoa_fisica || null;

  if (numEl) {
    if (nome) {
      numEl.textContent = nome;
      numEl.title = nome;
      numEl.style.fontSize = '1.15rem';
      numEl.classList.add('text-truncate');
    } else {
      numEl.textContent = numero ? `#${numero}` : '---';
      numEl.removeAttribute('title');
      numEl.style.fontSize = '';
      numEl.classList.remove('text-truncate');
    }
  }

  if (typeEl) {
    if (nome && numero) {
      typeEl.textContent = `Senha: #${numero} • ${tipo || 'Chamado'}`;
    } else {
      typeEl.textContent = tipo || 'Nenhuma senha chamada';
    }
  }

  if (numero) {
    try {
      localStorage.setItem('conecta_recepcao_ultima_senha', JSON.stringify({
        numero,
        tipo: tipo || 'Chamado',
        dados: dados,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }
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

  container.innerHTML = '<div class="p-3 text-center text-muted"><span class="spinner-border spinner-border-sm me-2 text-primary"></span>Buscando paciente no TASY...</div>';

  try {
    const res = await api.get(`/api/recepcao/pessoas/buscar?q=${encodeURIComponent(termo)}`);
    if (res.success && Array.isArray(res.data)) {
      if (res.data.length === 0) {
        container.innerHTML = `
          <div class="p-4 text-center text-muted border rounded bg-light">
            <i class="bi bi-person-x fs-2 d-block mb-1 text-secondary"></i>
            <strong>Nenhum paciente localizado com "${escapeHtml(termo)}".</strong>
            <p class="small text-muted mb-2">Verifique o nome digitado ou cadastre como um novo paciente.</p>
            <button class="btn btn-sm btn-primary fw-bold" type="button" onclick="window.conectaCore.novoPaciente()">
              <i class="bi bi-person-plus"></i> Preencher Novo Cadastro
            </button>
          </div>`;
        return;
      }

      container.innerHTML = res.data.map(p => {
        const cdPf = p.CD_PESSOA_FISICA || '';
        const nome = p.NM_PESSOA_FISICA || 'Sem Nome';
        const social = p.NM_SOCIAL ? ` (${p.NM_SOCIAL})` : '';
        const cpf = p.NR_CPF || 'Não informado';
        const nasc = p.DT_NASC_FMT || '-';
        const idade = p.IDADE !== undefined && p.IDADE !== null ? ` (${p.IDADE} anos)` : '';
        const mae = p.NM_MAE || 'Não informada';
        const cns = p.NR_CNS || '';

        return `
          <div class="paciente-result-item d-flex justify-content-between align-items-center p-3 mb-2 bg-white border rounded shadow-sm hover-shadow" style="cursor: pointer;" onclick="window.conectaCore.selecionarPaciente('${cdPf}')">
            <div class="d-flex align-items-center gap-3">
              <div class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 44px; height: 44px; font-size: 1.1rem; flex-shrink: 0;">
                <i class="bi bi-person-fill"></i>
              </div>
              <div>
                <div class="d-flex align-items-center gap-2">
                  <strong class="fs-6 text-primary">${escapeHtml(nome)}${escapeHtml(social)}</strong>
                  <span class="badge bg-secondary-subtle text-secondary" style="font-size: 0.75rem;">Cód TASY: ${cdPf}</span>
                </div>
                <div class="text-muted small mt-1">
                  <span><i class="bi bi-card-heading me-1"></i><strong>CPF:</strong> ${escapeHtml(cpf)}</span>
                  <span class="mx-2">•</span>
                  <span><i class="bi bi-cake2 me-1"></i><strong>Nasc:</strong> ${escapeHtml(nasc)}${escapeHtml(idade)}</span>
                  <span class="mx-2">•</span>
                  <span><i class="bi bi-person-heart me-1"></i><strong>Mãe:</strong> ${escapeHtml(mae)}</span>
                  ${cns ? `<span class="mx-2">•</span><span><i class="bi bi-credit-card-2-front me-1"></i><strong>CNS:</strong> ${escapeHtml(cns)}</span>` : ''}
                </div>
              </div>
            </div>
            <button class="btn btn-sm btn-outline-primary fw-bold text-nowrap ms-3" type="button">
              Selecionar <i class="bi bi-arrow-right"></i>
            </button>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="p-3 text-danger small">Erro ao buscar pacientes: ' + err.message + '</div>';
  }
}

export async function verificarDuplicidadeCpf(cpfRaw) {
  const cpf = String(cpfRaw || '').replace(/\D/g, '');
  const alertaEl = document.getElementById('recepcao-alerta-duplicidade');
  if (!alertaEl) return;

  if (cpf.length !== 11) {
    alertaEl.classList.add('d-none');
    alertaEl.innerHTML = '';
    return;
  }

  const cdPfAtual = document.getElementById('recepcao-cd-pessoa')?.value || '';

  try {
    const res = await api.get(`/api/recepcao/pessoas/verificar-duplicidade?cpf=${encodeURIComponent(cpf)}${cdPfAtual ? `&cd_pessoa_fisica=${encodeURIComponent(cdPfAtual)}` : ''}`);
    if (res.success && res.data && res.data.duplicado) {
      const dup = res.data;
      alertaEl.innerHTML = `
        <div class="alert alert-warning border-warning shadow-sm mb-3">
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div>
              <h6 class="fw-bold text-warning-emphasis mb-1">
                <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> Paciente já cadastrado no TASY!
              </h6>
              <div class="small text-dark mb-1">
                Já existe o cadastro de <strong>${escapeHtml(dup.pessoa.nm_pessoa_fisica)}</strong> (Cód TASY: <strong>${dup.pessoa.cd_pessoa_fisica}</strong> • Nasc: ${escapeHtml(dup.pessoa.dt_nasc_fmt || '-')} • Mãe: ${escapeHtml(dup.pessoa.nm_mae || '-')}).
              </div>
              ${dup.ultimoAtendimento ? `
                <div class="small fw-bold text-primary mt-1">
                  <i class="bi bi-journal-medical me-1"></i> Último Atendimento no TASY: #${dup.ultimoAtendimento.nr_atendimento} (${dup.ultimoAtendimento.dt_entrada_fmt}) ${dup.ultimoAtendimento.isHoje ? '<span class="badge bg-success ms-1">ABERTO HOJE</span>' : ''}
                </div>
              ` : ''}
            </div>
            <div class="d-flex flex-column gap-1">
              <button class="btn btn-sm btn-primary fw-bold text-nowrap" type="button" onclick="window.conectaCore.selecionarPaciente('${dup.pessoa.cd_pessoa_fisica}')">
                <i class="bi bi-person-check-fill me-1"></i> Usar Este Cadastro
              </button>
            </div>
          </div>
        </div>
      `;
      alertaEl.classList.remove('d-none');
    } else {
      alertaEl.classList.add('d-none');
      alertaEl.innerHTML = '';
    }
  } catch (e) {
    console.warn('[Recepção] Erro ao verificar duplicidade de CPF:', e);
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
      
      const alertaEl = document.getElementById('recepcao-alerta-duplicidade');
      if (alertaEl) {
        alertaEl.classList.add('d-none');
        alertaEl.innerHTML = '';
      }

      await carregarUltimoConvenioPaciente(cdPessoaFisica);
      recepcaoState.atendimentoExistente = null;
      const btnSubmit = document.getElementById('btn-recepcao-abrir-atendimento');
      if (btnSubmit) {
        btnSubmit.innerHTML = `<i class="bi bi-check2-circle fs-5 me-2"></i> Abrir Atendimento Oficial no TASY`;
        btnSubmit.classList.replace('btn-warning', 'btn-primary');
      }

      if (res.data.atendimentosAbertos && res.data.atendimentosAbertos.length > 0) {
        const configRec = (() => {
          try {
            const p = window.appState.usuario.perfilObj;
            if (!p) return {};
            if (p.config_recepcao_json) return JSON.parse(p.config_recepcao_json);
            return p.config_recepcao || {};
          } catch(e) { return {}; }
        })();
        
        if (!configRec.permitirMultiplosAtendimentos) {
          const openAtend = res.data.atendimentosAbertos[0];
          recepcaoState.atendimentoExistente = openAtend;
          
          ui.showToast('Paciente possui atendimento em aberto. Fluxo alterado para atualizar.', 'warning');
          
          if (btnSubmit) {
            btnSubmit.innerHTML = `<i class="bi bi-arrow-repeat fs-5 me-2"></i> Atualizar Atendimento (#${openAtend.NR_ATENDIMENTO || openAtend.nr_atendimento})`;
            btnSubmit.classList.replace('btn-primary', 'btn-warning');
          }
          
          // Try to pre-fill the form with openAtend details
          document.getElementById('recepcao-estabelecimento').value = openAtend.CD_ESTABELECIMENTO || openAtend.cd_estabelecimento || '';
          document.getElementById('recepcao-procedencia').value = openAtend.CD_PROCEDENCIA || openAtend.cd_procedencia || '';
          document.getElementById('recepcao-convenio').value = openAtend.CD_CONVENIO || openAtend.cd_convenio || '';
          
          // trigger change to load categories
          if (openAtend.CD_CONVENIO || openAtend.cd_convenio) {
            carregarCategoriasConvenio(openAtend.CD_CONVENIO || openAtend.cd_convenio).then(() => {
              document.getElementById('recepcao-categoria').value = openAtend.CD_CATEGORIA || openAtend.cd_categoria || '';
            });
          }
          
          document.getElementById('recepcao-setor').value = openAtend.CD_SETOR_ATENDIMENTO || openAtend.cd_setor_atendimento || '';
          document.getElementById('recepcao-tipo-atendimento').value = openAtend.IE_TIPO_ATENDIMENTO || openAtend.ie_tipo_atendimento || '';
        } else {
          ui.showToast('Paciente possui atendimento aberto (criação de múltiplos permitida).', 'info');
        }
      }
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
  const alertaEl = document.getElementById('recepcao-alerta-duplicidade');
  if (alertaEl) {
    alertaEl.classList.add('d-none');
    alertaEl.innerHTML = '';
  }
  document.getElementById('recepcao-nome-completo')?.focus();
}

export function limparPaciente() {
  recepcaoState.pessoaSelecionada = null;
  limparFormularioPaciente();
  document.getElementById('card-paciente-selecionado')?.classList.add('d-none');
  const alertaEl = document.getElementById('recepcao-alerta-duplicidade');
  if (alertaEl) {
    alertaEl.classList.add('d-none');
    alertaEl.innerHTML = '';
  }
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

    const isUpdate = !!recepcaoState.atendimentoExistente;
    const nrAtend = recepcaoState.atendimentoExistente?.NR_ATENDIMENTO || recepcaoState.atendimentoExistente?.nr_atendimento;
    
    let res;
    if (isUpdate) {
      res = await api.put(`/api/recepcao/atendimentos/${nrAtend}`, payload);
    } else {
      res = await api.post('/api/recepcao/atendimentos', payload);
    }

    if (res.success && res.data) {
      recepcaoState.atendimentoCriado = res.data.nr_atendimento || nrAtend;
      
      const numAtendEl = document.getElementById('recepcao-atendimento-numero');
      if (numAtendEl) numAtendEl.textContent = recepcaoState.atendimentoCriado;

      ui.showToast(isUpdate ? `Atendimento #${recepcaoState.atendimentoCriado} atualizado com sucesso!` : `Atendimento #${recepcaoState.atendimentoCriado} aberto com sucesso no TASY!`, 'success');
      
      await carregarRelatorios();
      await carregarDocumentosGED();
      await carregarSenhas();
      await carregarAtendimentosHoje();
      if (window.conectaCore && typeof window.conectaCore.loadDashboardPA === 'function') { window.conectaCore.loadDashboardPA(false); }
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
        <div class="ged-file-item position-relative d-flex justify-content-between align-items-center" style="cursor: pointer; padding-right: 2.5rem;" onclick="window.open('/api/recepcao/ged/${doc.NR_SEQUENCIA}/download', '_blank')">
          <div class="d-flex align-items-center gap-2 overflow-hidden">
            <i class="bi bi-file-earmark-text ged-file-icon flex-shrink-0"></i>
            <div class="d-flex flex-column overflow-hidden">
              <strong class="text-truncate">${escapeHtml(doc.DS_TITULO)}</strong>
              <small class="text-muted text-truncate">${escapeHtml(doc.DT_REGISTRO_FMT || '')} • Por: ${escapeHtml(doc.NM_USUARIO || '')}</small>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-outline-danger position-absolute" style="right: 0.5rem;" title="Inativar/Remover Documento" onclick="event.stopPropagation(); window.conectaCore.inativarGED(${doc.NR_SEQUENCIA})">
            <i class="bi bi-trash3-fill"></i>
          </button>
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
      if (window.conectaCore && typeof window.conectaCore.loadDashboardPA === 'function') { window.conectaCore.loadDashboardPA(false); }
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
  window.conectaCore.recepcaoState = recepcaoState;
window.conectaCore.selecionarPaciente = selecionarPaciente;
window.conectaCore.novoPaciente = novoPaciente;
window.conectaCore.imprimirRelatorio = imprimirRelatorio;
window.conectaCore.abrirModalAtendimento = abrirModalAtendimento;
window.conectaCore.irParaPasso = irParaPasso;
window.conectaCore.trocarAbaRecepcao = trocarAbaRecepcao;
window.conectaCore.abrirDocumentosAtendimento = abrirDocumentosAtendimento;
window.conectaCore.inativarGED = inativarGED;
window.conectaCore.carregarSenhas = carregarSenhas;
window.conectaCore.carregarSenhasTriagem = carregarSenhasTriagem;
window.conectaCore.renderizarBoardSenhasTriagem = renderizarBoardSenhasTriagem;

// ============================================================================
// 10. CANCELAMENTO DE ATENDIMENTO NATIVO TASY
// ============================================================================

export async function cancelarAtendimento(nrAtendimento, nomePaciente) {
  const numEl = document.getElementById('cancel-atendimento-numero');
  const pacEl = document.getElementById('cancel-atendimento-paciente');
  const nrHidden = document.getElementById('cancel-atendimento-nr-hidden');
  const motivo = document.getElementById('cancel-atendimento-motivo');

  if (numEl) numEl.textContent = '#' + nrAtendimento;
  if (pacEl) pacEl.textContent = nomePaciente;
  if (nrHidden) nrHidden.value = nrAtendimento;
  if (motivo) motivo.value = '';
  
  const modalEl = document.getElementById('modal-cancelar-atendimento');
  if (modalEl) {
    modalEl.classList.remove('d-none');
    document.body.classList.add('modal-open');
  }
}

export function fecharModalCancelamento() {
  const modalEl = document.getElementById('modal-cancelar-atendimento');
  if (modalEl) {
    modalEl.classList.add('d-none');
    document.body.classList.remove('modal-open');
  }
}

export async function confirmarCancelamentoAtendimento() {
  const nrHidden = document.getElementById('cancel-atendimento-nr-hidden');
  const motivoEl = document.getElementById('cancel-atendimento-motivo');
  
  const nrAtendimento = nrHidden ? nrHidden.value : null;
  const motivo = motivoEl ? motivoEl.value : '';
  
  if (!nrAtendimento) return;

  const btn = document.getElementById('btn-confirmar-cancelamento');
  if (btn) ui.setLoading(btn, true);

  try {
    ui.showToast('Solicitando cancelamento no TASY...', 'info');
    const res = await api.post(`/api/recepcao/atendimentos/${nrAtendimento}/cancelar`, { motivo });
    
    if (res && res.success) {
      ui.showToast('Atendimento cancelado com sucesso no TASY!', 'success');
      fecharModalCancelamento();
      await carregarAtendimentosHoje();
      if (window.conectaCore && typeof window.conectaCore.loadDashboardPA === 'function') { window.conectaCore.loadDashboardPA(false); }
    } else {
      ui.showToast(res.message || 'Erro ao cancelar atendimento', 'error');
    }
  } catch (err) {
    ui.showToast('Falha na comunicação: ' + err.message, 'error');
  } finally {
    if (btn) ui.setLoading(btn, false);
  }
}

window.conectaCore.cancelarAtendimento = cancelarAtendimento;
window.conectaCore.fecharModalCancelamento = fecharModalCancelamento;
window.conectaCore.confirmarCancelamentoAtendimento = confirmarCancelamentoAtendimento;
export async function inativarGED(nrSequencia) {
  const justificativa = prompt('Por favor, informe a justificativa para a exclusão/inativação deste documento no TASY:');
  if (justificativa === null) return; // cancelou
  if (justificativa.trim() === '') {
    ui.showToast('Justificativa é obrigatória.', 'warning');
    return;
  }

  try {
    const res = await api.post(`/api/recepcao/ged/${nrSequencia}/inativar`, { justificativa: justificativa.trim() });
    if (res.success) {
      ui.showToast('Documento removido com sucesso!', 'success');
      carregarDocumentosGED(); // Recarrega a lista instantaneamente
    }
  } catch (err) {
    ui.showToast('Erro ao remover documento: ' + err.message, 'error');
  }
}

export async function inutilizarSenha(nrSequencia, event) {
  if (event) event.stopPropagation();
  
  try {
    const motivosRes = await api.get('/api/recepcao/senhas/motivos-inutilizacao');
    const motivos = motivosRes.success ? motivosRes.data : [];
    
    let selectHtml = `<select id="motivo-inutilizacao-select" class="form-select mb-3">`;
    motivos.forEach(m => {
      selectHtml += `<option value="${m.NR_SEQUENCIA || m.nr_sequencia}">${escapeHtml(m.DS_MOTIVO_INUTILIZACAO || m.ds_motivo_inutilizacao)}</option>`;
    });
    if (motivos.length === 0) {
      selectHtml += `<option value="3">Outros</option>`;
    }
    selectHtml += `</select>`;

    return new Promise((resolve) => {
      const modalHtml = `
        <div class="modal fade" id="inutilizarModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header bg-danger text-white">
                <h5 class="modal-title"><i class="bi bi-exclamation-triangle-fill me-2"></i>Inutilizar Senha</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p class="text-muted text-start mb-2">Selecione o motivo para inutilizar esta senha:</p>
                ${selectHtml}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-danger" id="btnConfirmInutilizar">Confirmar Inutilização</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modalEl = document.getElementById('inutilizarModal');
      const bsModal = new bootstrap.Modal(modalEl);
      
      const onConfirm = async () => {
        const val = document.getElementById('motivo-inutilizacao-select').value;
        bsModal.hide();
        
        try {
          const maquina = document.getElementById('recepcao-select-meu-guiche')?.value || 'CONECTA_WEB';
          const res = await api.post(`/api/recepcao/senhas/${nrSequencia}/inutilizar`, {
            motivo_id: parseInt(val, 10),
            ds_maquina: maquina
          });

          if (res.success) {
            ui.showToast('Senha inutilizada com sucesso.', 'success');
            carregarSenhas();
          }
        } catch (e) {
          ui.showToast('Erro ao inutilizar senha: ' + e.message, 'error');
        }
      };

      document.getElementById('btnConfirmInutilizar').addEventListener('click', onConfirm);

      modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
        resolve();
      });

      bsModal.show();
    });
  } catch (err) {
    ui.showToast('Erro ao inutilizar senha: ' + err.message, 'error');
  }
}
