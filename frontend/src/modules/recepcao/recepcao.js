import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import * as ui from '../../core/ui.js';

/**
 * Módulo de Recepção & Acolhimento — Conecta HEAL 2.0
 * Orquestrador dos 5 Pilares Clínico-Operacionais:
 * 1. Senhas & Guichê -> 2. Cadastro Pessoa -> 3. Endereço -> 4. Atendimento -> 5. Documentos TASY & GED
 */

let recepcaoState = {
  filaSelecionada: null,
  senhaAtiva: null,
  pessoaSelecionada: null,
  atendimentoCriado: null,
  passoAtual: 1, // 1: Senhas, 2: Pessoa, 3: Endereço, 4: Atendimento, 5: Documentos
  filasDisponiveis: [],
  senhasFila: [],
  relatorios: [],
  documentosGED: []
};

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

let queuePollInterval = null;

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
      carregarSenhas();
    } else {
      stopQueuePolling();
    }
  }, 10000);
}

export async function initRecepcao() {
  window.conectaCore = window.conectaCore || {};
  window.conectaCore.irParaPasso = irParaPasso;
  window.conectaCore.selecionarSenhaFila = selecionarSenhaFila;
  window.conectaCore.selecionarPacienteBusca = selecionarPacienteBusca;
  window.conectaCore.emitirRelatorioTasy = emitirRelatorioTasy;
  window.conectaCore.visualizarGedDoc = visualizarGedDoc;

  bindRecepcaoEvents();
  await carregarFilas();
  await carregarSenhas();
  startQueuePolling();
  irParaPasso(1);
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

  document.getElementById('btn-recepcao-chamar-proximo')?.addEventListener('click', chamarProximaSenha);
  document.getElementById('btn-recepcao-rechamar')?.addEventListener('click', rechamarSenha);

  // Stepper navigation
  document.querySelectorAll('.stepper-item').forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.dataset.step, 10);
      if (step) irParaPasso(step);
    });
  });

  // Busca de Paciente
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

  // Salvar Pessoa & Endereço
  document.getElementById('btn-recepcao-salvar-pessoa')?.addEventListener('click', salvarPessoaEEndereco);

  // Abertura de Atendimento
  document.getElementById('btn-recepcao-abrir-atendimento')?.addEventListener('click', abrirAtendimento);

  // Novo Atendimento / Reiniciar Ciclo
  document.getElementById('btn-recepcao-reiniciar')?.addEventListener('click', reiniciarFluxo);

  // GED Upload
  document.getElementById('btn-recepcao-upload-ged')?.addEventListener('click', abrirUploadGED);
}

export function irParaPasso(passo) {
  recepcaoState.passoAtual = passo;

  document.querySelectorAll('.stepper-item').forEach(item => {
    const s = parseInt(item.dataset.step, 10);
    item.classList.toggle('active', s === passo);
    item.classList.toggle('completed', s < passo);
  });

  document.querySelectorAll('.recepcao-step-panel').forEach(panel => {
    const s = parseInt(panel.dataset.step, 10);
    panel.classList.toggle('d-none', s !== passo);
  });
}

// ============================================================================
// PILAR 1: GERENCIAMENTO DE SENHAS
// ============================================================================

export async function carregarFilas() {
  try {
    const res = await api.get('/api/recepcao/filas');
    if (res.success && Array.isArray(res.data)) {
      recepcaoState.filasDisponiveis = res.data;
      const select = document.getElementById('recepcao-select-fila');
      if (select) {
        select.innerHTML = '<option value="">Todas as Filas Ativas</option>' +
          res.data.map(f => `<option value="${f.NR_SEQUENCIA}">${f.DS_FILA}</option>`).join('');
      }
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar filas:', err);
  }
}

export async function carregarSenhas() {
  try {
    const fila = recepcaoState.filaSelecionada || '';
    const res = await api.get(`/api/recepcao/senhas?fila=${fila}`);
    if (res.success && Array.isArray(res.data)) {
      recepcaoState.senhasFila = res.data;
      renderFilaSenhas();
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar senhas:', err);
  }
}

function renderFilaSenhas() {
  const container = document.getElementById('recepcao-queue-list');
  const countBadge = document.getElementById('recepcao-queue-count');
  if (!container) return;

  if (countBadge) countBadge.textContent = recepcaoState.senhasFila.length;

  if (recepcaoState.senhasFila.length === 0) {
    container.innerHTML = `
      <div class="p-3 text-center text-muted">
        <i class="bi bi-inbox fs-3 d-block mb-1"></i>
        Nenhuma senha aguardando no momento
      </div>`;
    return;
  }

  container.innerHTML = recepcaoState.senhasFila.map(s => `
    <div class="guiche-queue-item" data-id="${s.NR_SEQUENCIA}" onclick="window.conectaCore.selecionarSenhaFila(${s.NR_SEQUENCIA})">
      <div>
        <div class="guiche-queue-number">#${s.CD_SENHA_GERADA}</div>
        <small class="text-muted">${s.DS_PRIORIDADE} • ${s.DS_FILA || 'Recepção'}</small>
      </div>
      <div class="text-end">
        <span class="badge ${s.NR_PRIORIDADE === 1 ? 'bg-danger' : (s.NR_PRIORIDADE === 2 ? 'bg-warning text-dark' : 'bg-primary')}">
          ${s.MINUTOS_ESPERA || 0} min
        </span>
        <div class="guiche-queue-time">${s.HR_GERACAO || ''}</div>
      </div>
    </div>
  `).join('');
}

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
      irParaPasso(2); // Avança para identificação da pessoa
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
    ui.showToast('Nenhuma senha ativa para rechamar.', 'warning');
    return;
  }
  try {
    await api.post('/api/recepcao/senhas/rechamar', {
      nr_sequencia: recepcaoState.senhaAtiva.nr_sequencia,
      ds_maquina: 'GUICHE-' + (state.usuario?.nm_usuario || '1')
    });
    ui.showToast(`Senha #${recepcaoState.senhaAtiva.cd_senha_gerada} rechamada!`, 'info');
  } catch (err) {
    ui.showToast('Erro ao rechamar senha: ' + err.message, 'error');
  }
}

export function selecionarSenhaFila(nrSequencia) {
  const senha = recepcaoState.senhasFila.find(s => s.NR_SEQUENCIA === nrSequencia);
  if (senha) {
    recepcaoState.senhaAtiva = {
      nr_sequencia: senha.NR_SEQUENCIA,
      cd_senha_gerada: senha.CD_SENHA_GERADA
    };
    atualizarDisplaySenha(senha.CD_SENHA_GERADA, senha.DS_PRIORIDADE);
    irParaPasso(2);
  }
}

function atualizarDisplaySenha(numero, tipo) {
  const numEl = document.getElementById('guiche-active-number');
  const typeEl = document.getElementById('guiche-active-type');
  if (numEl) numEl.textContent = numero ? `#${numero}` : '---';
  if (typeEl) typeEl.textContent = tipo || 'Aguardando chamada';
}

// ============================================================================
// PILAR 2: CADASTRO E BUSCA DE PESSOA FÍSICA
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
            Nenhum paciente localizado com "${termo}".
            <button class="btn btn-sm btn-outline-primary ms-2" type="button" onclick="window.conectaCore.novoPaciente()">
              <i class="bi bi-person-plus"></i> Cadastrar Novo
            </button>
          </div>`;
        return;
      }

      container.innerHTML = res.data.map(p => `
        <div class="paciente-result-item" onclick="window.conectaCore.selecionarPaciente('${p.CD_PESSOA_FISICA}')">
          <div>
            <strong>${p.NM_PESSOA_FISICA}</strong> ${p.NM_SOCIAL ? `<small class="text-muted">(${p.NM_SOCIAL})</small>` : ''}
            <div class="text-muted small">
              CPF: ${p.NR_CPF || 'Não informado'} • Nasc: ${p.DT_NASC_FMT || '-'} • Mãe: ${p.NM_MAE || '-'}
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
      ui.showToast('Paciente carregado com sucesso!', 'success');
      irParaPasso(3); // Avança para conferência de endereço
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
  document.getElementById('form-paciente-container')?.classList.remove('d-none');
  irParaPasso(2);
}

export function limparPaciente() {
  recepcaoState.pessoaSelecionada = null;
  limparFormularioPaciente();
  document.getElementById('card-paciente-selecionado')?.classList.add('d-none');
  document.getElementById('form-paciente-container')?.classList.remove('d-none');
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
// PILAR 3: CADASTRO E VALIDAÇÃO DE ENDEREÇO
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
  const btn = document.getElementById('btn-recepcao-salvar-pessoa');
  if (btn) ui.setLoading(btn, true);

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
      ui.showToast('Dados cadastrais e endereço salvos com sucesso!', 'success');
      irParaPasso(4); // Avança para abertura do atendimento
    }
  } catch (err) {
    ui.showToast('Erro ao salvar paciente: ' + err.message, 'error');
  } finally {
    if (btn) ui.setLoading(btn, false);
  }
}

// ============================================================================
// PILAR 4: ABERTURA DO ATENDIMENTO ÂNCORA
// ============================================================================

export async function abrirAtendimento() {
  const cdPf = document.getElementById('recepcao-cd-pessoa').value || recepcaoState.pessoaSelecionada?.CD_PESSOA_FISICA;
  if (!cdPf) {
    ui.showToast('Nenhum paciente selecionado para abrir atendimento.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-recepcao-abrir-atendimento');
  if (btn) ui.setLoading(btn, true);

  try {
    const payload = {
      cd_pessoa_fisica: cdPf,
      cd_setor_atendimento: document.getElementById('recepcao-setor-atend')?.value || 39,
      cd_convenio: document.getElementById('recepcao-convenio')?.value || 3,
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
      irParaPasso(5); // Avança para Relatórios e GED
    }
  } catch (err) {
    ui.showToast('Erro ao abrir atendimento: ' + err.message, 'error');
  } finally {
    if (btn) ui.setLoading(btn, false);
  }
}

// ============================================================================
// PILAR 5: RELATÓRIOS TASY & GED
// ============================================================================

export async function carregarRelatorios() {
  const container = document.getElementById('recepcao-relatorios-list');
  if (!container) return;

  try {
    const res = await api.get('/api/recepcao/relatorios');
    if (res.success && Array.isArray(res.data)) {
      recepcaoState.relatorios = res.data;
      container.innerHTML = res.data.map(r => `
        <div class="relatorio-card-item">
          <div>
            <div class="relatorio-card-title"><i class="bi bi-file-earmark-pdf text-danger me-1"></i> ${r.DS_TITULO}</div>
            <small class="text-muted">Cód TASY: ${r.CD_RELATORIO}</small>
          </div>
          <button class="btn btn-sm btn-outline-primary w-100" type="button" onclick="window.conectaCore.imprimirRelatorio(${r.CD_RELATORIO}, '${r.DS_TITULO}')">
            <i class="bi bi-printer"></i> Imprimir Documento
          </button>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('[Recepção] Erro ao carregar relatórios:', err);
  }
}

export function imprimirRelatorio(cdRelatorio, titulo) {
  const nrAtendimento = recepcaoState.atendimentoCriado || '---';
  const paciente = recepcaoState.pessoaSelecionada?.NM_PESSOA_FISICA || 'Paciente';

  ui.showToast(`Preparando impressão de "${titulo}" para o atendimento #${nrAtendimento}...`, 'info');

  // Abre janela de impressão simulando relatório oficial
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${titulo} - Atendimento ${nrAtendimento}</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; color: #111; line-height: 1.6; }
          .header { border-bottom: 2px solid #00387a; padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; font-size: 1.25rem; color: #00387a; }
          .meta { font-size: 0.85rem; color: #666; margin-bottom: 2rem; }
          .content { border: 1px solid #ddd; padding: 1.5rem; border-radius: 6px; }
          .signature { margin-top: 4rem; display: flex; justify-content: space-between; }
          .sig-line { border-top: 1px solid #333; width: 45%; text-align: center; font-size: 0.85rem; padding-top: 0.5rem; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>HOSPITAL ESPÍRITA ANDRÉ LUIZ — HEAL</h1>
            <small>Sistema Conecta Assistencial / TASY</small>
          </div>
          <strong>${titulo}</strong>
        </div>
        <div class="meta">
          <strong>Paciente:</strong> ${paciente} | <strong>Atendimento:</strong> ${nrAtendimento} | <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}
        </div>
        <div class="content">
          <p>Documento oficial emitido eletronicamente através do Conecta Recepção Hospitalar em conformidade com o prontuário eletrônico TASY.</p>
          <p>Declaro estar ciente e de acordo com todas as disposições e orientações hospitalares aqui registradas.</p>
        </div>
        <div class="signature">
          <div class="sig-line">Assinatura do Paciente / Responsável Legal</div>
          <div class="sig-line">Recepção / Atendente Hospitalar</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }
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
          <strong>${doc.DS_TITULO}</strong>
          <small class="text-muted">${doc.DT_REGISTRO_FMT} • Por: ${doc.NM_USUARIO}</small>
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
      ui.showToast(`Anexando arquivo "${file.name}" ao GED...`, 'info');
      await api.post('/api/recepcao/ged', {
        nr_atendimento: recepcaoState.atendimentoCriado || null,
        cd_pessoa_fisica: recepcaoState.pessoaSelecionada?.CD_PESSOA_FISICA,
        ds_titulo: file.name,
        ds_arquivo: file.name,
        ds_extensao_arquivo: file.name.split('.').pop()
      });
      ui.showToast('Documento anexado ao GED com sucesso!', 'success');
      await carregarDocumentosGED();
    } catch (err) {
      ui.showToast('Erro ao anexar arquivo no GED: ' + err.message, 'error');
    }
  };
  input.click();
}

export function reiniciarFluxo() {
  recepcaoState = {
    filaSelecionada: null,
    senhaAtiva: null,
    pessoaSelecionada: null,
    atendimentoCriado: null,
    passoAtual: 1,
    filasDisponiveis: recepcaoState.filasDisponiveis,
    senhasFila: [],
    relatorios: [],
    documentosGED: []
  };
  atualizarDisplaySenha(null, null);
  limparFormularioPaciente();
  document.getElementById('card-paciente-selecionado')?.classList.add('d-none');
  irParaPasso(1);
  carregarSenhas();
  ui.showToast('Novo ciclo de atendimento iniciado no guichê.', 'info');
}

// Expõe no window.conectaCore para chamadas inline no HTML
if (!window.conectaCore) window.conectaCore = {};
window.conectaCore.selecionarSenhaFila = selecionarSenhaFila;
window.conectaCore.selecionarPaciente = selecionarPaciente;
window.conectaCore.novoPaciente = novoPaciente;
window.conectaCore.imprimirRelatorio = imprimirRelatorio;
