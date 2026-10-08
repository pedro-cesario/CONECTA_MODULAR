import { api } from '../../core/api.js';
import * as ui from '../../core/ui.js';

export let triagemState = {
  senha: null,
  paciente: null,
  condicaoIdentificacao: 'IDENTIFICADO',
  cdPessoaFisica: null,
  nrAtendimento: null,
  etapaAtual: 'queixa',
  queixaPrincipal: '',
  alergias: { existentes: [], novas: [], negaAlergias: false, selecionada: null },
  sinaisVitais: { pas: '', pad: '', fc: '', fr: '', temperatura: '', spo2: '', peso: '' },
  historicoSaude: [],
  estadoGeral: [],
  comportamento: [],
  sintomasGripais: { apresenta: false, descricao: '' },
  glasgow: { ocular: null, verbal: null, motora: null },
  criteriosManuais: [],
  criteriosManuaisDisponiveis: [],
  classificacao: null
};

const STEPS = ['queixa', 'alergias', 'sinais', 'historico', 'glasgow', 'escala', 'revisao'];
let isSetup = false;

export function setupTriagemClinico() {
  if (isSetup) return;
  isSetup = true;
  // Stepper clicks
  document.querySelectorAll('#triagem-stepper .modal-step-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const step = e.currentTarget.getAttribute('data-t-step');
      if (canNavigateTo(step)) {
        showStep(step);
      }
    });
  });

  // Next / Prev buttons
  document.getElementById('btn-triagem-voltar-step')?.addEventListener('click', goPrev);
  document.getElementById('btn-triagem-avancar-clinico')?.addEventListener('click', goNext);
  document.getElementById('btn-triagem-finalizar')?.addEventListener('click', handleFinalizar);
  document.getElementById('btn-triagem-salvar-rascunho')?.addEventListener('click', () => {
    salvarRascunho(true);
    ui.showToast('Rascunho da triagem salvo.', 'success');
  });

  // Bind inputs
  document.getElementById('triagem-queixa-principal')?.addEventListener('input', (e) => {
    triagemState.queixaPrincipal = e.target.value;
    salvarRascunho();
  });

  document.getElementById('triagem-nega-alergias')?.addEventListener('change', (e) => {
    triagemState.alergias.negaAlergias = e.target.checked;
    if (e.target.checked) {
      if (triagemState.alergias.existentes.length > 0) {
        ui.showToast('Paciente possui alergias cadastradas no TASY.', 'warning');
        e.target.checked = false;
        triagemState.alergias.negaAlergias = false;
      } else {
        triagemState.alergias.novas = [];
        renderNovasAlergias();
      }
    }
    salvarRascunho();
  });

  document.getElementById('triagem-nova-alergia-input')?.addEventListener('input', pesquisarPrincipiosAtivos);

  document.getElementById('btn-triagem-add-alergia')?.addEventListener('click', () => {
    const input = document.getElementById('triagem-nova-alergia-input');
    const selecionada = triagemState.alergias.selecionada;
    if (selecionada?.nrSeqFichaTecnica) {
      if (!triagemState.alergias.novas.some(item => Number(item.nrSeqFichaTecnica) === Number(selecionada.nrSeqFichaTecnica))) {
        triagemState.alergias.novas.push(selecionada);
      }
      triagemState.alergias.negaAlergias = false;
      document.getElementById('triagem-nega-alergias').checked = false;
      input.value = '';
      triagemState.alergias.selecionada = null;
      renderResultadosPrincipiosAtivos([]);
      renderNovasAlergias();
      salvarRascunho();
    } else {
      ui.showToast('Selecione um princípio ativo na busca antes de adicionar.', 'warning');
    }
  });

  const svIds = ['pas', 'pad', 'fc', 'fr', 'temp', 'spo2', 'peso'];
  svIds.forEach(id => {
    document.getElementById(`triagem-sv-${id}`)?.addEventListener('input', (e) => {
      triagemState.sinaisVitais[id === 'temp' ? 'temperatura' : id] = e.target.value;
      renderResumoSinais();
      salvarRascunho();
    });
  });

  ['ocular', 'verbal', 'motora'].forEach(campo => {
    document.getElementById(`triagem-glasgow-${campo}`)?.addEventListener('change', (e) => {
      triagemState.glasgow[campo] = e.target.value ? Number(e.target.value) : null;
      renderGlasgow();
      salvarRascunho();
    });
  });

  document.getElementById('triagem-sintomas-gripais-check')?.addEventListener('change', (e) => {
    triagemState.sintomasGripais.apresenta = e.target.checked;
    document.getElementById('triagem-sintomas-gripais-desc-container').classList.toggle('d-none', !e.target.checked);
    salvarRascunho();
  });

  document.getElementById('triagem-sintomas-gripais-desc')?.addEventListener('input', (e) => {
    triagemState.sintomasGripais.descricao = e.target.value;
    salvarRascunho();
  });
}

function renderNovasAlergias() {
  const ul = document.getElementById('triagem-novas-alergias-list');
  if (!ul) return;
  ul.innerHTML = '';
  triagemState.alergias.novas.forEach((a, index) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML = `<span>${escapeHtml(a.descricao || '')}</span> <button class="btn btn-sm btn-outline-danger btn-rm-alergia" data-idx="${index}" aria-label="Remover alergia"><i class="bi bi-trash"></i></button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.btn-rm-alergia').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      triagemState.alergias.novas.splice(idx, 1);
      renderNovasAlergias();
      salvarRascunho();
    });
  });
}

let buscaPrincipioTimeout = null;
async function pesquisarPrincipiosAtivos(event) {
  const termo = event.target.value.trim();
  triagemState.alergias.selecionada = null;
  clearTimeout(buscaPrincipioTimeout);
  if (termo.length < 2) {
    renderResultadosPrincipiosAtivos([]);
    return;
  }
  buscaPrincipioTimeout = setTimeout(async () => {
    try {
      const itens = await api.get(`/api/triagem-pa/principios-ativos?q=${encodeURIComponent(termo)}`);
      renderResultadosPrincipiosAtivos(Array.isArray(itens) ? itens : []);
    } catch (error) {
      renderResultadosPrincipiosAtivos([]);
    }
  }, 250);
}

function renderResultadosPrincipiosAtivos(itens) {
  const target = document.getElementById('triagem-principios-ativos-resultados');
  if (!target) return;
  target.innerHTML = itens.map(item => `<button type="button" class="list-group-item list-group-item-action triagem-principio-ativo" data-ficha="${Number(item.nrSeqFichaTecnica)}" data-descricao="${escapeHtml(item.descricao)}">${escapeHtml(item.descricao)}</button>`).join('');
  target.querySelectorAll('.triagem-principio-ativo').forEach(botao => {
    botao.addEventListener('click', () => {
      triagemState.alergias.selecionada = {
        nrSeqFichaTecnica: Number(botao.dataset.ficha),
        descricao: botao.dataset.descricao
      };
      document.getElementById('triagem-nova-alergia-input').value = botao.dataset.descricao;
      renderResultadosPrincipiosAtivos([]);
    });
  });
}

export async function iniciarEtapasClinicas(dadosAtend) {
  triagemState.cdPessoaFisica = dadosAtend.cdPf;
  triagemState.nrAtendimento = dadosAtend.nrAtendimento;
  triagemState.senha = dadosAtend.senha;
  
  // Exibir navegação e rodapé clínico mantendo a mesma estrutura do modal.
  document.getElementById('triagem-stepper')?.classList.remove('d-none');
  document.getElementById('btn-triagem-confirmar-inicio').classList.add('d-none');
  document.getElementById('btn-triagem-avancar-clinico').classList.remove('d-none');
  document.getElementById('btn-triagem-voltar-step').classList.remove('d-none');
  document.getElementById('btn-triagem-salvar-rascunho')?.classList.remove('d-none');
  document.getElementById('btn-triagem-cancelar')?.classList.add('d-none');

  // Load existing draft if any, otherwise defaults
  try {
    const rascunho = await api.get(`/api/triagem-pa/atendimentos/${dadosAtend.nrAtendimento}/rascunho`);
    if (rascunho && Object.keys(rascunho).length > 0) {
      Object.assign(triagemState, rascunho);
      preencherFormularioComRascunho();
    }
  } catch(e) {}

  // Carregar Alergias do TASY
  if (triagemState.cdPessoaFisica) {
    try {
      const alergias = await api.get(`/api/triagem-pa/pacientes/${triagemState.cdPessoaFisica}/alergias`);
      triagemState.alergias.existentes = alergias || [];
      const divExistentes = document.getElementById('triagem-alergias-existentes');
      if (alergias && alergias.length > 0) {
        divExistentes.innerHTML = `<ul class="mb-0 ps-3">${alergias.map(a => `<li>${escapeHtml(a.descricao || '')}</li>`).join('')}</ul>`;
      } else {
        divExistentes.innerHTML = `<p class="text-muted mb-0">Nenhuma alergia cadastrada.</p>`;
      }
    } catch(e) {
      document.getElementById('triagem-alergias-existentes').innerHTML = '<span class="text-danger">Erro ao carregar alergias.</span>';
    }
  }

  // Carregar configuracoes admin para Histórico
  await carregarConfiguracoesClinicas();
  renderResumoPaciente(dadosAtend.paciente || triagemState.paciente || {});
  renderResumoSinais();
  renderGlasgow();
  showStep('queixa');
}

async function carregarConfiguracoesClinicas() {
  try {
    const configs = await api.get('/api/triagem-pa/configuracoes-clinicas');
    renderCheckboxes('triagem-historico-container', configs.historico || [], 'historicoSaude');
    renderCheckboxes('triagem-estado-geral-container', configs.estadoGeral || [], 'estadoGeral', true);
    renderCheckboxes('triagem-comportamento-container', configs.comportamento || [], 'comportamento');
    triagemState.criteriosManuaisDisponiveis = Array.isArray(configs.escalaManuais) ? configs.escalaManuais : [];
  } catch(e) {
    console.error('Erro config', e);
  }
}

function renderCheckboxes(containerId, items, stateKey, isRadioPairs = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'col-12 col-md-6';
    const checked = triagemState[stateKey].includes(item.id || item.descricao);
    div.innerHTML = `
      <div class="form-check">
        <input class="form-check-input chk-${stateKey}" type="checkbox" value="${item.id || item.descricao}" id="chk_${stateKey}_${item.id || item.descricao}" ${checked ? 'checked' : ''} data-incompativel="${item.incompativel || ''}" data-exclusivo="${item.exclusivo || false}">
        <label class="form-check-label" for="chk_${stateKey}_${item.id || item.descricao}">${item.descricao}</label>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(`.chk-${stateKey}`).forEach(chk => {
    chk.addEventListener('change', (e) => {
      const val = e.target.value;
      const isChecked = e.target.checked;
      const excl = e.target.getAttribute('data-exclusivo') === 'true';
      const incomp = e.target.getAttribute('data-incompativel');

      if (isChecked) {
        if (excl) {
          // Desmarcar todos os outros
          container.querySelectorAll(`.chk-${stateKey}`).forEach(c => {
            if (c !== e.target) c.checked = false;
          });
          triagemState[stateKey] = [val];
        } else {
          // Desmarcar o exclusivo se existir
          const chkExcl = container.querySelector(`.chk-${stateKey}[data-exclusivo="true"]`);
          if (chkExcl) {
            chkExcl.checked = false;
            triagemState[stateKey] = triagemState[stateKey].filter(x => x !== chkExcl.value);
          }
          // Desmarcar incompatível
          if (incomp) {
            const chkIncomp = container.querySelector(`.chk-${stateKey}[value="${incomp}"]`);
            if (chkIncomp) chkIncomp.checked = false;
            triagemState[stateKey] = triagemState[stateKey].filter(x => x !== incomp);
          }
          if (!triagemState[stateKey].includes(val)) triagemState[stateKey].push(val);
        }
      } else {
        triagemState[stateKey] = triagemState[stateKey].filter(x => x !== val);
      }
      salvarRascunho();
    });
  });
}

function preencherFormularioComRascunho() {
  if (document.getElementById('triagem-queixa-principal')) {
    document.getElementById('triagem-queixa-principal').value = triagemState.queixaPrincipal || '';
  }
  if (triagemState.alergias.negaAlergias) {
    document.getElementById('triagem-nega-alergias').checked = true;
  }
  renderNovasAlergias();
  
  const sv = triagemState.sinaisVitais;
  if(sv) {
    if(document.getElementById('triagem-sv-pas')) document.getElementById('triagem-sv-pas').value = sv.pas || '';
    if(document.getElementById('triagem-sv-pad')) document.getElementById('triagem-sv-pad').value = sv.pad || '';
    if(document.getElementById('triagem-sv-fc')) document.getElementById('triagem-sv-fc').value = sv.fc || '';
    if(document.getElementById('triagem-sv-fr')) document.getElementById('triagem-sv-fr').value = sv.fr || '';
    if(document.getElementById('triagem-sv-temp')) document.getElementById('triagem-sv-temp').value = sv.temperatura || '';
    if(document.getElementById('triagem-sv-spo2')) document.getElementById('triagem-sv-spo2').value = sv.spo2 || '';
    if(document.getElementById('triagem-sv-peso')) document.getElementById('triagem-sv-peso').value = sv.peso || '';
  }

  
  const glas = triagemState.glasgow;
  if (glas) {
    if (document.getElementById('triagem-glasgow-ocular')) document.getElementById('triagem-glasgow-ocular').value = glas.ocular || '';
    if (document.getElementById('triagem-glasgow-verbal')) document.getElementById('triagem-glasgow-verbal').value = glas.verbal || '';
    if (document.getElementById('triagem-glasgow-motora')) document.getElementById('triagem-glasgow-motora').value = glas.motora || '';
    renderGlasgow();
  }

  const grip = triagemState.sintomasGripais;
  if(grip) {
    const chk = document.getElementById('triagem-sintomas-gripais-check');
    if (chk) {
      chk.checked = grip.apresenta;
      document.getElementById('triagem-sintomas-gripais-desc-container').classList.toggle('d-none', !grip.apresenta);
      document.getElementById('triagem-sintomas-gripais-desc').value = grip.descricao || '';
    }
  }
}

let rascunhoTimeout = null;
function salvarRascunho(imediato = false) {
  clearTimeout(rascunhoTimeout);
  const persistir = async () => {
    if (!triagemState.nrAtendimento) return;
    try {
      const resposta = await api.post(`/api/triagem-pa/atendimentos/${triagemState.nrAtendimento}/rascunho`, triagemState);
      if (resposta?.classificacao) {
        triagemState.classificacao = resposta.classificacao;
        if (triagemState.etapaAtual === 'escala') preencherEscala();
        if (triagemState.etapaAtual === 'glasgow') renderGlasgow();
      }
    } catch(e) {}
  };
  if (imediato) persistir();
  else rascunhoTimeout = setTimeout(persistir, 1000);
}

function canNavigateTo(targetStep) {
  const currentIdx = STEPS.indexOf(triagemState.etapaAtual);
  const targetIdx = STEPS.indexOf(targetStep);
  
  // Validar Queixa se estiver tentando avançar além dela
  if (currentIdx === 0 && targetIdx > 0) {
    const q = triagemState.queixaPrincipal.trim();
    if (!q) {
      ui.showToast('Informe a queixa principal.', 'error');
      document.getElementById('triagem-queixa-principal').classList.add('is-invalid');
      return false;
    }
    document.getElementById('triagem-queixa-principal').classList.remove('is-invalid');
  }
  return true;
}

function showStep(stepName) {
  // Esconder todas
  document.querySelectorAll('.triagem-clinical-step').forEach(el => el.classList.add('d-none'));
  
  // Mostrar alvo
  document.getElementById(`triagem-modal-step-${stepName}`)?.classList.remove('d-none');
  triagemState.etapaAtual = stepName;

  // Atualizar stepper UI
  document.querySelectorAll('#triagem-stepper .modal-step-item').forEach(el => {
    const s = el.getAttribute('data-t-step');
    const stepIndex = STEPS.indexOf(s);
    const currentIndex = STEPS.indexOf(stepName);
    el.classList.remove('active', 'completed');
    if (s === stepName) el.classList.add('active');
    else if (s === 'identificacao' || (stepIndex >= 0 && stepIndex < currentIndex)) el.classList.add('completed');
  });

  // Atualizar botoes
  const idx = STEPS.indexOf(stepName);
  const btnNext = document.getElementById('btn-triagem-avancar-clinico');
  const btnFinalizar = document.getElementById('btn-triagem-finalizar');
  if (idx === STEPS.length - 1) {
    btnNext.classList.add('d-none');
    btnFinalizar.classList.remove('d-none');
    preencherRevisao();
  } else if (stepName === 'escala') {
    preencherEscala();
    salvarRascunho(true);
  } else {
    btnNext.classList.remove('d-none');
    btnFinalizar.classList.add('d-none');
    btnNext.innerHTML = 'Avançar <i class="bi bi-arrow-right ms-1"></i>';
  }
}

function goNext() {
  const currentIdx = STEPS.indexOf(triagemState.etapaAtual);
  if (currentIdx < STEPS.length - 1) {
    const nextStep = STEPS[currentIdx + 1];
    if (canNavigateTo(nextStep)) {
      showStep(nextStep);
    }
  } else {
    // FASE 4 END
    ui.showToast('Fase 4 das etapas clínicas concluída no protótipo!', 'success');
  }
}

function goPrev() {
  const currentIdx = STEPS.indexOf(triagemState.etapaAtual);
  if (currentIdx > 0) {
    const prevStep = STEPS[currentIdx - 1];
    showStep(prevStep);
  }
}


function preencherRevisao() {
  const container = document.getElementById('triagem-revisao-conteudo');
  if (!container) return;

  const sv = triagemState.sinaisVitais || {};
  const g = triagemState.glasgow || {};
  const total = g.ocular && g.verbal && g.motora ? Number(g.ocular) + Number(g.verbal) + Number(g.motora) : '-';
  const alergias = triagemState.alergias?.negaAlergias ? 'Nega alergias' : [...(triagemState.alergias?.existentes || []), ...(triagemState.alergias?.novas || [])].map(a => a.ds_alergia || a.ds_substancia || a).filter(Boolean).join(', ') || 'Não informado';
  const card = (titulo, texto, classe = '') => `<article class="triagem-review-card ${classe}"><h6>${titulo}</h6><p>${texto || 'Não informado'}</p></article>`;
  container.innerHTML = [
    card('Paciente', triagemState.paciente?.nome || triagemState.paciente?.nm_pessoa_fisica || 'Em atendimento'),
    card('Queixa principal', triagemState.queixaPrincipal), card('Alergias', alergias),
    card('Sinais Vitais', `PA ${sv.pas || '-'} / ${sv.pad || '-'} • FC ${sv.fc || '-'} • FR ${sv.fr || '-'}\nTemp. ${sv.temperatura || '-'} • SpO₂ ${sv.spo2 || '-'} • Peso ${sv.peso || '-'}`),
    card('Histórico / Estado / Comportamento', `${(triagemState.historicoSaude || []).join(', ') || '-'}\n${(triagemState.estadoGeral || []).join(', ') || '-'}\n${(triagemState.comportamento || []).join(', ') || '-'}`),
    card('Glasgow', `Ocular ${g.ocular || '-'} • Verbal ${g.verbal || '-'} • Motora ${g.motora || '-'}\nTotal: ${total}`),
    card('Escala', resumoClassificacao(), 'triagem-classification-card'),
    card('Triagem pronta para finalização', 'Todos os dados preenchidos podem ser revisados antes da finalização.', 'triagem-classification-card')
  ].join('');
}

function renderResumoPaciente(paciente = {}) {
  if (paciente && Object.keys(paciente).length) triagemState.paciente = paciente;
  const nome = paciente.nome || paciente.nm_pessoa_fisica || 'Paciente em atendimento';
  const atendimento = triagemState.nrAtendimento || paciente.nr_atendimento || '-';
  const senha = triagemState.senha?.cdFormatado || triagemState.senha?.cd_senha_gerada || '-';
  const setor = paciente.setor || 'P.A.';
  const html = `<strong>${escapeHtml(nome)}</strong><span>Atendimento #${escapeHtml(String(atendimento))}</span><span>${escapeHtml(setor)}</span><span>${escapeHtml(String(senha))}</span>`;
  document.querySelectorAll('[id^="triagem-patient-summary"]').forEach(el => { el.innerHTML = html; });
}

function renderResumoSinais() {
  const target = document.getElementById('triagem-sinais-resumo');
  if (!target) return;
  const sv = triagemState.sinaisVitais || {};
  const itens = [['PA', sv.pas && sv.pad ? `${sv.pas} / ${sv.pad} mmHg` : '-'], ['FC', sv.fc ? `${sv.fc} bpm` : '-'], ['FR', sv.fr ? `${sv.fr} irpm` : '-'], ['Temperatura', sv.temperatura ? `${sv.temperatura} °C` : '-'], ['SpO₂', sv.spo2 ? `${sv.spo2} %` : '-'], ['Peso', sv.peso ? `${sv.peso} kg` : '-']];
  target.innerHTML = itens.map(([label, valor]) => `<li><span>${label}</span><b>${escapeHtml(valor)}</b></li>`).join('');
}

function criteriosAtuais() {
  return Array.isArray(triagemState.classificacao?.criteriosIdentificados) ? triagemState.classificacao.criteriosIdentificados : [];
}

function resumoClassificacao() {
  const classificacao = triagemState.classificacao?.classificacaoResolvida;
  const criterios = criteriosAtuais();
  if (!classificacao && !criterios.length) return 'Aguardando dados e critérios clínicos.';
  return `${classificacao || 'Sem classificação resolvida'}${criterios.length ? ` • ${criterios.length} critério(s) identificado(s)` : ''}`;
}

function renderGlasgow() {
  const g = triagemState.glasgow || {};
  const total = g.ocular && g.verbal && g.motora ? Number(g.ocular) + Number(g.verbal) + Number(g.motora) : '-';
  const target = document.getElementById('triagem-glasgow-total');
  if (target) target.textContent = total;
  const criterios = document.getElementById('triagem-glasgow-criterios');
  if (criterios) {
    const lista = criteriosAtuais();
    criterios.innerHTML = lista.length ? lista.map(item => `<span class="triagem-criteria-chip">${escapeHtml(String(item.descricao || item))}</span>`).join('') : '<span class="text-muted small">Nenhum critério identificado até o momento.</span>';
  }
}

function preencherEscala() {
  const target = document.getElementById('triagem-escala-conteudo');
  if (!target) return;
  const criterios = criteriosAtuais();
  const automaticos = criterios.filter(item => item.origem === 'AUTOMATICO');
  const manuaisIdentificados = criterios.filter(item => item.origem === 'MANUAL');
  const linhas = itens => itens.length
    ? `<ul>${itens.map(item => `<li>${escapeHtml(item.descricao || item.evidencia || item.criterio || item.codigo)}</li>`).join('')}</ul>`
    : '<p>Nenhum critério identificado.</p>';
  const opcoesManuais = (triagemState.criteriosManuaisDisponiveis || []).filter(item => item.ativo).map(item => {
    const marcado = triagemState.criteriosManuais.includes(item.codigo) ? 'checked' : '';
    return `<label class="form-check mb-2"><input class="form-check-input triagem-criterio-manual" type="checkbox" value="${escapeHtml(item.codigo)}" ${marcado}> <span class="form-check-label">${escapeHtml(item.codigo)} — ${escapeHtml(item.descricao)}</span></label>`;
  }).join('') || '<p>Nenhum critério manual configurado no Admin.</p>';
  const classificacao = triagemState.classificacao?.classificacaoResolvida || 'Aguardando critérios clínicos';
  target.innerHTML = `<article class="triagem-review-card"><h6>Critérios automáticos</h6>${linhas(automaticos)}</article><article class="triagem-review-card"><h6>Critérios manuais</h6><div class="triagem-manual-criteria">${opcoesManuais}</div>${linhas(manuaisIdentificados)}</article><article class="triagem-review-card"><h6>Evidências</h6>${linhas(criterios)}</article><article class="triagem-review-card triagem-classification-card"><h6>Classificação resolvida</h6><p class="triagem-classification-value">${escapeHtml(classificacao)}</p></article>`;
  target.querySelectorAll('.triagem-criterio-manual').forEach(input => {
    input.addEventListener('change', event => {
      const codigo = event.target.value;
      triagemState.criteriosManuais = event.target.checked
        ? [...new Set([...triagemState.criteriosManuais, codigo])]
        : triagemState.criteriosManuais.filter(item => item !== codigo);
      salvarRascunho(true);
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

async function handleFinalizar() {
  if (!confirm('Confirma a finalização da Triagem P.A.?')) return;

  const btn = document.getElementById('btn-triagem-finalizar');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Finalizando...';
  btn.disabled = true;

  try {
    const payload = {
      nr_seq_senha: triagemState.senha?.nr_sequencia,
      cd_senha_gerada: triagemState.senha?.cd_senha_gerada,
      fila_atual: triagemState.senha?.nr_seq_fila_senha || triagemState.senha?.nr_seq_fila_senha_origem,
      cd_pessoa_fisica: triagemState.cdPessoaFisica
    };

    const res = await api.post(`/api/triagem-pa/atendimentos/${triagemState.nrAtendimento}/finalizar`, payload);
    if (res.success) {
      ui.showToast('Triagem finalizada com sucesso e senha transferida!', 'success');
      
      const modalEl = document.getElementById('modal-triagem-identificacao');
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.hide();

      // Recarregar senhas
      document.getElementById('btn-dashboard-internacao-recarregar')?.click();
      
      // Limpar rascunho
      clearTimeout(rascunhoTimeout);
      triagemState.nrAtendimento = null;
    } else {
      ui.showToast(res.message || 'Erro ao finalizar triagem.', 'error');
    }
  } catch (e) {
    console.error(e);
    ui.showToast('Erro ao finalizar triagem. Verifique o console.', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}
