import { api } from '../../core/api.js';
import { state, MODULOS_CONFIG, draftHydratingModules, modeTransitionSeq } from '../../core/state.js';
import * as utils from '../../core/utils.js';
import * as ui from '../../core/ui.js';
import * as router from '../../core/router.js';
import * as draft from '../../core/draft.js';
import * as auth from '../../core/auth.js';

export function canAccessLivro() {
  return auth.perfilTemAcessoModulo(state.usuario?.perfilAtivo, 'livro');
}

export function temAcessoTecnicoEnfermagem() {
  return auth.validarPerfil(state.usuario, 'tecnico_enfermagem') || auth.validarPerfil(state.usuario, 'enfermagem');
}

  export let livroRowSequence = 1;

  export function nextLivroRowKey(prefix) {
    livroRowSequence += 1;
    return `${prefix}_${livroRowSequence}`;
  }

  export function getLivroSetorLabel(cdSetor) {
    const setor = state.livroSetores.find(item => Number(item.cd_setor_atendimento) === Number(cdSetor));
    return setor ? setor.ds_setor_atendimento : `Setor ${cdSetor}`;
  }

  export function getTecnicoLabel(tecnico) {
    return tecnico?.nome || tecnico?.nm_usuario || '-';
  }

  export function getEnfermeiroLabel(enfermeiro) {
    return enfermeiro?.nome || enfermeiro?.nm_usuario || '-';
  }

  export function getEscalaTurnoSelecionado() {
    const selected = document.querySelector('input[name="livro-turno"]:checked');
    if (!selected) return null;
    return selected.value === 'N' ? 'N' : 'M';
  }

  export function getLivroDataSelecionada() {
    return document.getElementById('livro-data-plantao').value || utils.getTodayIsoDate();
  }


  export function buildLivroTecnicoRow() {
    return {
      row_key: nextLivroRowKey('tec'),
      cd_pessoa_fisica: null,
      pacientes: []
    };
  }

  export function buildLivroFaltaRow() {
    return {
      row_key: nextLivroRowKey('falta'),
      cd_pessoa_fisica: null,
      tipo: 'Falta'
    };
  }

  export function buildAvaliacaoRow() {
    return {
      row_key: nextLivroRowKey('avaliacao'),
      cd_pessoa_fisica: null,
      pacientes: [],
      descricao: ''
    };
  }

  export function buildPatioRow() {
    return {
      row_key: nextLivroRowKey('patio'),
      cd_pessoa_fisica: null
    };
  }

  export function buildCirculanteRow() {
    return {
      row_key: nextLivroRowKey('circulante'),
      cd_pessoa_fisica: null
    };
  }

  export function buildEctPreRow() {
    return {
      row_key: nextLivroRowKey('ect_pre'),
      cd_pessoa_fisica: null
    };
  }

  export function buildEctSalaRow() {
    return {
      row_key: nextLivroRowKey('ect_sala'),
      cd_pessoa_fisica: null
    };
  }

  export function buildEctRecuperacaoRow() {
    return {
      row_key: nextLivroRowKey('ect_rec'),
      cd_pessoa_fisica: null
    };
  }

  export function refreshLivroPacienteVinculo() {
    const pacientesValidos = new Set(
      state.livroPacientes.map(item => Number(item.nr_atendimento || item.atendimento)).filter(Number.isInteger)
    );

    const mapa = new Map();
    state.livroTecnicosSelecionados.forEach(row => {
      row.pacientes = (row.pacientes || [])
        .map(Number)
        .filter(atendimento => Number.isInteger(atendimento) && pacientesValidos.has(atendimento));

      if (!Number.isInteger(row.cd_pessoa_fisica)) return;

      row.pacientes.forEach(atendimento => {
        if (!mapa.has(atendimento)) {
          mapa.set(atendimento, row.cd_pessoa_fisica);
        }
      });
    });

    state.livroPacienteVinculo = mapa;
    state.livroAvaliacaoExterna = (state.livroAvaliacaoExterna || []).map(row => ({
      row_key: row?.row_key || nextLivroRowKey('avaliacao'),
      cd_pessoa_fisica: Number.isInteger(Number(row?.cd_pessoa_fisica)) ? Number(row.cd_pessoa_fisica) : null,
      pacientes: Array.isArray(row?.pacientes)
        ? [...new Set(row.pacientes.map(Number).filter(atendimento => Number.isInteger(atendimento) && pacientesValidos.has(atendimento)))]
        : [],
      descricao: typeof row?.descricao === 'string' ? row.descricao : ''
    }));
    state.livroPatio = (state.livroPatio || []).map(row => ({
      row_key: row?.row_key || nextLivroRowKey('patio'),
      cd_pessoa_fisica: Number.isInteger(Number(row?.cd_pessoa_fisica)) ? Number(row.cd_pessoa_fisica) : null
    }));
    state.livroCirculante = (state.livroCirculante || []).map(row => ({
      row_key: row?.row_key || nextLivroRowKey('circulante'),
      cd_pessoa_fisica: Number.isInteger(Number(row?.cd_pessoa_fisica)) ? Number(row.cd_pessoa_fisica) : null
    }));
  }

  export function renderLivroPreviewData(data) {

    const preview = document.getElementById('livro-preview');

    if (!data) {
      preview.innerHTML = '<div class="loading-placeholder">Nenhuma escala técnica encontrada para os filtros informados.</div>';

      return;

    }

    const setorDesc = getLivroSetorLabel(data.cd_setor_atendimento);
    const metaText = `Ocorrência #${data.nr_ocorrencia} | Usuário: ${data.nm_usuario || '-'} | Data de registro: ${data.dt_ocorrencia || '-'} | Setor: ${setorDesc}`;
    const metaHtml = `<div class="livro-preview-meta">${utils.escapeHtml(metaText)}</div>`;
    const corpoHtml = data.ds_ocorrencia || '';

    preview.innerHTML = `
      <div class="livro-preview-toolbar">
        ${metaHtml}
        <button class="btn-secondary btn-print-preview" id="btn-imprimir-escala" type="button">
          <i class="bi bi-printer"></i> Imprimir
        </button>
      </div>
      <div id="livro-preview-documento">${corpoHtml}</div>`;

    document.getElementById('btn-imprimir-escala')?.addEventListener('click', () => {
      imprimirEscalaAssistencial(metaHtml, corpoHtml);
    });

  }

  export function imprimirEscalaAssistencial(metaHtml, corpoHtml) {
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      ui.showToast('Não foi possível abrir a janela de impressão. Libere pop-ups no navegador.', 'warning');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Escala Assistencial</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 16px; color: #111; }
          .print-wrapper { width: 100%; max-width: 1020px; margin: 0 auto; }
          .livro-preview-meta { font-size: 12px; color: #555; margin: 0 auto 12px; width: 100%; max-width: 980px; }
          .escala-print-item { padding-bottom: 1rem; page-break-inside: avoid; overflow: hidden; }
          @media print {
            body { margin: 0; padding: 0; }
            .print-wrapper { max-width: 1020px; }
            .escala-print-item { page-break-after: always; page-break-inside: avoid; }
            .escala-print-item:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${metaHtml}
          ${corpoHtml}
        </div>
      </body>
      </html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();

    // Fechar popup automaticamente quando janela principal receber foco
    const fecharPopupNoFoco = () => {
      if (popup && !popup.closed) {
        popup.close();
      }
      window.removeEventListener('focus', fecharPopupNoFoco);
    };
    window.addEventListener('focus', fecharPopupNoFoco);
  }

  export async function loadLivroAdministrativoByDate(dateValue) {
    const mySeq = ++state.livroLoadSeq;
    const preview = document.getElementById('livro-preview');
    const setorId = Number(state.livroSetorSelecionado);
    const turno = getEscalaTurnoSelecionado();

    if (!Number.isInteger(setorId)) {
      ensureLivroEditable();
      preview.innerHTML = '<div class="loading-placeholder">Não foi possível carregar o perfil.</div>';
      return;
    }

    const isStale = () => mySeq !== state.livroLoadSeq;

    preview.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando escala...</div>';
    setLivroFormLoading(true);

    try {
      const [resultAtiva, resultTecnica] = await Promise.all([
        api.get(`/api/escala-ativa?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dateValue)}&turno=${encodeURIComponent(turno || 'M')}`),
        api.get(`/api/escala-tecnica?data=${encodeURIComponent(dateValue)}&cd_setor=${encodeURIComponent(String(setorId))}&turno=${encodeURIComponent(turno || 'M')}`)
      ]);

      if (isStale()) return;

      const escalaExistente = (resultAtiva.success && resultAtiva.data) || (resultTecnica.success && resultTecnica.data);

      if (resultAtiva.success && resultAtiva.data) {
        hydrateLivroFromPayload(resultAtiva.data);
      } else if (!resultTecnica.success || !resultTecnica.data) {
        clearLivroForm();
      }

      if (escalaExistente) {
        disableLivroForm();
        showLivroEditarBtn();
      } else {
        ensureLivroEditable();
      }

      if (resultTecnica.success && resultTecnica.data) {
        renderLivroPreviewData(resultTecnica.data);
      } else if (resultAtiva.success && resultAtiva.data) {
        renderLivroPreviewFromPayload(resultAtiva.data);
      } else {
        preview.innerHTML = '<div class="loading-placeholder">Nenhuma escala encontrada para esta data.</div>';
      }

      await refreshHistoricoButton();
      if (isStale()) return;
    } catch (err) {
      if (isStale()) return;
      ensureLivroEditable();
      preview.innerHTML = '<div class="loading-placeholder">Erro ao buscar escala</div>';
    } finally {
      if (!isStale()) setLivroFormLoading(false);
    }
  }

  export function renderLivroPreviewFromPayload(payload) {
    const preview = document.getElementById('livro-preview');
    if (!payload || (!payload.tecnicos && !payload.ect)) {
      preview.innerHTML = '<div class="loading-placeholder">Dados incompletos para visualização.</div>';
      return;
    }

    const turnoLabel = payload.turno === 'N' ? 'Noturno (19h - 07h)' : 'Diurno (07h - 19h)';
    let html = '<div class="livro-preview-content">';
    html += `<div class="livro-preview-header"><i class="bi bi-clipboard-check"></i> Escala Assistencial — ${payload.data_plantao || ''} | ${turnoLabel}</div>`;

    const enfSelect = document.getElementById('livro-enfermeiro');
    const enfNome = enfSelect && payload.enfermeiro_cd_pessoa_fisica
      ? enfSelect.querySelector(`option[value="${payload.enfermeiro_cd_pessoa_fisica}"]`)?.textContent || ''
      : '';

    if (enfNome) html += `<div class="livro-preview-row"><b>Enfermeiro:</b> ${utils.escapeHtml(enfNome)}</div>`;

    if (payload.ect) {
      if (Array.isArray(payload.ect.pre_procedimento) && payload.ect.pre_procedimento.length) {
        html += '<div class="livro-preview-row"><b>Pré-Procedimento:</b> ' +
          payload.ect.pre_procedimento.map(id => utils.escapeHtml(getTecnicoNome(id))).join(', ') +
          '</div>';
      }
      if (Array.isArray(payload.ect.sala_procedimento) && payload.ect.sala_procedimento.length) {
        html += '<div class="livro-preview-row"><b>Sala de Procedimento:</b> ' +
          payload.ect.sala_procedimento.map(id => utils.escapeHtml(getTecnicoNome(id))).join(', ') +
          '</div>';
      }
      if (Array.isArray(payload.ect.sala_recuperacao) && payload.ect.sala_recuperacao.length) {
        html += '<div class="livro-preview-row"><b>Sala de Recuperação:</b> ' +
          payload.ect.sala_recuperacao.map(id => utils.escapeHtml(getTecnicoNome(id))).join(', ') +
          '</div>';
      }
    }

    if (payload.tecnicos && payload.tecnicos.length) {
      html += '<div class="livro-preview-row"><b>Técnicos do plantão:</b></div>';
      payload.tecnicos.forEach(t => {
        const nomeTec = getTecnicoNome(t.cd_pessoa_fisica);
        const pacientesList = (t.pacientes || []).map(p => getPacienteNome(p)).filter(Boolean).join(', ');
        const extras = (t.patio_circulante || []).join(', ');
        let linha = `&nbsp;&nbsp;${utils.escapeHtml(nomeTec)}`;
        if (pacientesList) linha += ` → Pacientes: ${utils.escapeHtml(pacientesList)}`;
        if (extras) linha += ` [${utils.escapeHtml(extras)}]`;
        html += `<div class="livro-preview-row">${linha}</div>`;
      });
    }

    if (payload.faltas_folgas && payload.faltas_folgas.length) {
      html += '<div class="livro-preview-row"><b>Faltas/Folgas:</b> ' +
        payload.faltas_folgas.map(f => `${utils.escapeHtml(getTecnicoNome(f.cd_pessoa_fisica))} (${f.tipo})`).join(', ') +
        '</div>';
    }

    if (payload.avaliacao_externa && payload.avaliacao_externa.length) {
      html += '<div class="livro-preview-row"><b>Avaliação Externa:</b></div>';
      payload.avaliacao_externa.forEach(a => {
        const pacientesList = (a.pacientes || []).map(p => getPacienteNome(p)).filter(Boolean).join(', ');
        html += `<div class="livro-preview-row">&nbsp;&nbsp;${utils.escapeHtml(getTecnicoNome(a.cd_pessoa_fisica))} → ${utils.escapeHtml(pacientesList)}${a.descricao ? ' — ' + utils.escapeHtml(a.descricao) : ''}</div>`;
      });
    }

    if (payload.observacoes) {
      html += `<div class="livro-preview-row"><b>Observações:</b> ${utils.escapeHtml(payload.observacoes)}</div>`;
    }

    html += '</div>';
    preview.innerHTML = html;
  }

  export function isLivroSetorEct() {
    if (!state.livroSetorSelecionado) return false;
    const setor = (state.livroSetores || []).find(s => Number(s.cd_setor_atendimento) === Number(state.livroSetorSelecionado));
    if (!setor) return false;
    const nome = String(setor.ds_setor_atendimento || '').toUpperCase().trim();
    return nome === 'ECT' || nome.includes('ECT');
  }

  export function updateLivroSectionsVisibility() {
    const isEct = isLivroSetorEct();
    const workspace = document.getElementById('workspace-livro');
    const ectPreSecao = document.getElementById('livro-secao-ect-pre');
    const ectSalaSecao = document.getElementById('livro-secao-ect-sala');
    const ectRecSecao = document.getElementById('livro-secao-ect-recuperacao');
    const tecSecao = document.getElementById('livro-secao-tecnicos');
    const patioSecao = document.getElementById('livro-secao-patio');
    const circSecao = document.getElementById('livro-secao-circulante');
    const faltasSecao = document.getElementById('livro-secao-faltas');
    const avaliacaoSecao = document.getElementById('livro-secao-avaliacao-externa');

    if (isEct) {
      workspace?.classList.add('mode-ect');
      ectPreSecao?.classList.remove('d-none');
      ectSalaSecao?.classList.remove('d-none');
      ectRecSecao?.classList.remove('d-none');
      tecSecao?.classList.add('d-none');
      patioSecao?.classList.add('d-none');
      circSecao?.classList.add('d-none');
      faltasSecao?.classList.add('d-none');
      avaliacaoSecao?.classList.add('d-none');
    } else {
      workspace?.classList.remove('mode-ect');
      ectPreSecao?.classList.add('d-none');
      ectSalaSecao?.classList.add('d-none');
      ectRecSecao?.classList.add('d-none');
      tecSecao?.classList.remove('d-none');
      patioSecao?.classList.remove('d-none');
      circSecao?.classList.remove('d-none');
      faltasSecao?.classList.remove('d-none');
      avaliacaoSecao?.classList.remove('d-none');
    }
  }

  export function getLivroTodosProfissionais() {
    const mapa = new Map();
    (state.livroEnfermeiros || []).forEach(p => {
      const id = Number(p.cd_pessoa_fisica);
      if (Number.isInteger(id) && !mapa.has(id)) {
        mapa.set(id, { cd_pessoa_fisica: id, nome: p.nome || p.nm_usuario || `Enfermeiro ${id}` });
      }
    });
    (state.livroTecnicos || []).forEach(p => {
      const id = Number(p.cd_pessoa_fisica);
      if (Number.isInteger(id) && !mapa.has(id)) {
        mapa.set(id, { cd_pessoa_fisica: id, nome: p.nome || p.nm_usuario || `Técnico ${id}` });
      }
    });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  export function buildEctProfissionalOptionsHtml(selectedId, emptyLabel = 'Selecione...') {
    const selected = Number(selectedId);
    const profissionais = getLivroTodosProfissionais();
    const options = [
      `<option value="">${utils.escapeHtml(emptyLabel)}</option>`,
      ...profissionais.map(item => {
        const value = Number(item.cd_pessoa_fisica);
        const mark = Number.isInteger(selected) && selected === value ? 'selected' : '';
        return `<option value="${value}" ${mark}>${utils.escapeHtml(item.nome)}</option>`;
      })
    ];
    return options.join('');
  }

  export function renderEctPreList() {
    const container = document.getElementById('livro-ect-pre-list');
    if (!container) return;
    if (!state.livroEctPre.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum profissional adicionado.</div>';
      return;
    }
    container.innerHTML = state.livroEctPre
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Profissional ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="ect-pre-select" data-row-key="${item.row_key}">
                ${buildEctProfissionalOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-ect-pre" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  export function renderEctSalaList() {
    const container = document.getElementById('livro-ect-sala-list');
    if (!container) return;
    if (!state.livroEctSala.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum profissional adicionado.</div>';
      return;
    }
    container.innerHTML = state.livroEctSala
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Profissional ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="ect-sala-select" data-row-key="${item.row_key}">
                ${buildEctProfissionalOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-ect-sala" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  export function renderEctRecuperacaoList() {
    const container = document.getElementById('livro-ect-recuperacao-list');
    if (!container) return;
    if (!state.livroEctRecuperacao.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum profissional adicionado.</div>';
      return;
    }
    container.innerHTML = state.livroEctRecuperacao
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Profissional ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="ect-recuperacao-select" data-row-key="${item.row_key}">
                ${buildEctProfissionalOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-ect-recuperacao" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  export function renderLivroEctSelects() {
    renderEctPreList();
    renderEctSalaList();
    renderEctRecuperacaoList();
  }

  export function getTecnicoNome(cdPessoaFisica) {
    const id = Number(cdPessoaFisica);
    const todos = [...(state.livroEnfermeiros || []), ...(state.livroTecnicos || [])];
    const found = todos.find(t => Number(t.cd_pessoa_fisica) === id);
    return found ? (found.nome || found.nm_usuario || '') : '';
  }

  export function getPacienteNome(nrAtendimento) {
    const id = Number(nrAtendimento);
    const found = (state.livroPacientes || []).find(p => Number(p.atendimento || p.nr_atendimento) === id);
    if (found) return found.nm_pessoa_fisica || found.nome || '';
    return '';
  }

  export async function refreshHistoricoButton() {
    const btn = document.getElementById('btn-livro-historico');
    const countSpan = document.getElementById('livro-historico-count');
    if (!btn || !countSpan) return;

    const setorId = Number(state.livroSetorSelecionado);
    const dtPlantao = document.getElementById('livro-data-plantao').value || utils.getTodayIsoDate();
    const turno = getEscalaTurnoSelecionado() || 'M';

    if (!Number.isInteger(setorId)) {
      btn.classList.add('d-none');
      return;
    }

    try {
      const result = await api.get(
        `/api/escala-ativa/versoes?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}`
      );
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        countSpan.textContent = `(${result.data.length})`;
        btn.classList.remove('d-none');
        btn._versoesData = result.data;
      } else {
        btn.classList.add('d-none');
      }
    } catch (err) {
      btn.classList.add('d-none');
    }
  }

  export async function showHistoricoModal() {
    const btn = document.getElementById('btn-livro-historico');
    const versoes = btn._versoesData;
    if (!versoes || !versoes.length) return;

    const setorId = Number(state.livroSetorSelecionado);
    const dtPlantao = document.getElementById('livro-data-plantao').value || utils.getTodayIsoDate();
    const turno = getEscalaTurnoSelecionado() || 'M';

    let listHtml = '';
    versoes.forEach(v => {
      listHtml += `
        <div class="historico-item" data-versao="${v.NR_VERSAO}">
          <strong>Versão ${v.NR_VERSAO}</strong> — ${v.NM_USUARIO || 'Desconhecido'}<br>
          <small>${v.DT_CRIACAO || ''} · ${v.QTD_ITENS || 0} registros</small>
        </div>`;
    });

    const modalHtml = `
      <div class="modal-overlay" id="historico-modal-overlay">
        <div class="modal-card" style="max-width:500px">
          <div class="modal-header-row">
            <h3 style="margin:0">Histórico de versões</h3>
            <button class="modal-close-btn" id="historico-modal-fechar">&times;</button>
          </div>
          <div id="historico-modal-list">${listHtml}</div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.classList.add('modal-open');

    document.getElementById('historico-modal-overlay').addEventListener('click', function(e) {
      if (e.target === this || e.target.id === 'historico-modal-fechar') {
        this.remove();
        document.body.classList.remove('modal-open');
      }
    });

    document.querySelectorAll('#historico-modal-list .historico-item').forEach(function(item) {
      item.addEventListener('click', async () => {
        const versao = Number(item.dataset.versao);
        document.getElementById('historico-modal-overlay').remove();
        document.body.classList.remove('modal-open');
        try {
          const result = await api.get(
            `/api/escala-ativa/diff?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}&versao=${versao}`
          );
          if (result.success && result.data) {
        if (auth.temPermissaoAtiva('passagem', 'lancar_passagem_lote')) {
           try {
              const draftRes = await api.get('/api/lote/draft');
              if (draftRes.success && draftRes.data && draftRes.data.setoresSelecionados) {
                 state.loteSectors = new Set(draftRes.data.setoresSelecionados.map(Number));
              }
           } catch(e) {}
        }

            showDiffModal(result.data, turno, versao);
          }
        } catch (err) {
          ui.showToast('Erro ao carregar alterações', 'error');
        }
      });
    });
  }

  export function showDiffModal(diff, turno, versao) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let bodyHtml = diff.alteracoes.map(a => formatDiffItem(a)).join('');

    overlay.innerHTML = `
      <div class="modal-card modal-card-diff">
        <div class="modal-header-row">
          <h3 style="margin:0"><i class="bi bi-clock-history"></i> Alterações — Versão ${versao}</h3>
          <button class="modal-close-btn" id="diff-modal-fechar">&times;</button>
        </div>
        <div class="modal-diff-meta">
          Usuário: ${utils.escapeHtml(diff.nm_usuario || '')} &middot; ${utils.escapeHtml(diff.data_plantao || '')} &middot; Turno: ${turno === 'N' ? 'Noturno' : 'Diurno'}
        </div>
        <div class="modal-diff-body">${bodyHtml}</div>
        <div class="modal-actions">
          <button class="modal-btn-secondary" id="diff-modal-ok">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    const close = () => {
      overlay.remove();
      document.body.classList.remove('modal-open');
    };
    overlay.querySelector('#diff-modal-fechar').onclick = close;
    overlay.querySelector('#diff-modal-ok').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
  }

  export function formatDiffItem(a) {
    const icon = a.tipo === '+' ? '<span style="color:#16a34a">+</span>' : a.tipo === '-' ? '<span style="color:#dc2626">−</span>' : '<span style="color:#ca8a04">~</span>';

    if (a.secao === 'info') return `<div class="diff-info">${utils.escapeHtml(a.texto)}</div>`;

    if (a.secao === 'enfermeiro') {
      const antes = getTecnicoNome(a.antes) || '(não informado)';
      const depois = getTecnicoNome(a.depois) || '(não informado)';
      return `<div class="diff-item"><strong>Enfermeiro:</strong> <span style="color:#dc2626;text-decoration:line-through">${utils.escapeHtml(antes)}</span> → <span style="color:#16a34a">${utils.escapeHtml(depois)}</span></div>`;
    }

    if (a.secao === 'tecnicos') {
      const nomeTec = getTecnicoNome(a.cd_pessoa_fisica) || `Técnico #${a.cd_pessoa_fisica || '?'}`;
      let texto = `<div class="diff-item">${icon} <strong>Técnicos:</strong> ${utils.escapeHtml(nomeTec)}`;

      if (a.tipo === '+' && a.pacientes && a.pacientes.length) {
        texto += ` — ${a.pacientes.length} paciente(s): ${a.pacientes.map(p => utils.escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      }
      if (a.tipo === '+' && a.patio_circulante && a.patio_circulante.length) {
        texto += ` [${a.patio_circulante.join(', ')}]`;
      }
      if (a.pacientes_adicionados && a.pacientes_adicionados.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#16a34a">+ Pacientes:</span> ${a.pacientes_adicionados.map(p => utils.escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      }
      if (a.pacientes_removidos && a.pacientes_removidos.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#dc2626">− Pacientes:</span> ${a.pacientes_removidos.map(p => utils.escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      }
      if (a.extras_adicionados && a.extras_adicionados.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#16a34a">+ Função:</span> ${a.extras_adicionados.join(', ')}`;
      }
      if (a.extras_removidos && a.extras_removidos.length) {
        texto += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#dc2626">− Função:</span> ${a.extras_removidos.join(', ')}`;
      }
      texto += '</div>';
      return texto;
    }

    if (a.secao === 'faltas_folgas') {
      const nomeTec = getTecnicoNome(a.cd_pessoa_fisica) || `Técnico #${a.cd_pessoa_fisica || '?'}`;
      return `<div class="diff-item">${icon} <strong>Faltas/Folgas:</strong> ${utils.escapeHtml(nomeTec)} (${a.ff_tipo || ''})</div>`;
    }

    if (a.secao === 'avaliacao') {
      const nomeTec = getTecnicoNome(a.cd_pessoa_fisica) || `Técnico #${a.cd_pessoa_fisica || '?'}`;
      let texto = `<div class="diff-item">${icon} <strong>Avaliação:</strong> ${utils.escapeHtml(nomeTec)}`;
      if (a.pacientes && a.pacientes.length) texto += ` — ${a.pacientes.map(p => utils.escapeHtml(getPacienteNome(p) || `#${p}`)).join(', ')}`;
      if (a.descricao) texto += ` (${utils.escapeHtml(a.descricao)})`;
      texto += '</div>';
      return texto;
    }

    if (a.secao === 'observacoes') {
      return `<div class="diff-item"><strong>Observações:</strong><br>
        <span style="color:#dc2626;text-decoration:line-through">${utils.escapeHtml(a.antes || '(vazio)')}</span><br>
        <span style="color:#16a34a">${utils.escapeHtml(a.depois || '(vazio)')}</span></div>`;
    }

    return '';
  }

  export function disableLivroForm() {
    document.getElementById('livro-setor').disabled = false;
    document.getElementById('livro-data-plantao').disabled = true;
    document.querySelectorAll('input[name="livro-turno"]').forEach(r => r.disabled = true);
    document.getElementById('livro-enfermeiro').disabled = true;
    document.getElementById('livro-observacoes').disabled = true;
    ['livro-ect-pre-procedimento', 'livro-ect-sala-procedimento', 'livro-ect-sala-recuperacao'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
    document.getElementById('btn-livro-salvar').classList.add('d-none');
    document.getElementById('btn-add-tecnico')?.classList.add('d-none');
    document.getElementById('btn-add-patio')?.classList.add('d-none');
    document.getElementById('btn-add-circulante')?.classList.add('d-none');
    document.getElementById('btn-add-falta')?.classList.add('d-none');
    document.getElementById('btn-add-avaliacao-externa')?.classList.add('d-none');
  }

  export function enableLivroForm() {
    document.getElementById('livro-setor').disabled = false;
    document.getElementById('livro-data-plantao').disabled = false;
    document.querySelectorAll('input[name="livro-turno"]').forEach(r => r.disabled = false);
    document.getElementById('livro-enfermeiro').disabled = false;
    document.getElementById('livro-observacoes').disabled = false;
    ['livro-ect-pre-procedimento', 'livro-ect-sala-procedimento', 'livro-ect-sala-recuperacao'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
    document.getElementById('btn-livro-salvar').classList.remove('d-none');
    document.getElementById('btn-add-tecnico')?.classList.remove('d-none');
    document.getElementById('btn-add-patio')?.classList.remove('d-none');
    document.getElementById('btn-add-circulante')?.classList.remove('d-none');
    document.getElementById('btn-add-falta')?.classList.remove('d-none');
    document.getElementById('btn-add-avaliacao-externa')?.classList.remove('d-none');
  }

  export function showLivroEditarBtn() {
    document.getElementById('btn-livro-editar')?.classList.remove('d-none');
  }

  export function hideLivroEditarBtn() {
    document.getElementById('btn-livro-editar')?.classList.add('d-none');
  }

  export function ensureLivroEditable() {
    enableLivroForm();
    hideLivroEditarBtn();
  }

  export function setLivroFormLoading(loading) {
    const ids = [
      'btn-add-tecnico', 'btn-add-patio', 'btn-add-circulante',
      'btn-add-falta', 'btn-add-avaliacao-externa',
      'btn-livro-buscar', 'btn-livro-salvar', 'btn-livro-historico'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !!loading;
    });
  }

  export function renderLivroSetorSelect() {
    const select = document.getElementById('livro-setor');
    if (!select) return;

    if (!state.livroSetores.length) {
      select.innerHTML = '<option value="">Nenhum setor disponível</option>';
      select.disabled = true;
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>';
    state.livroSetores.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.cd_setor_atendimento);
      option.textContent = item.ds_setor_atendimento;
      if (item.escala_liberada === true) {
        option.style.backgroundColor = '#d4edda';
        option.style.color = '#155724';
      } else if (item.escala_liberada === false) {
        option.style.backgroundColor = '#f8d7da';
        option.style.color = '#721c24';
      }
      select.appendChild(option);
    });

    select.disabled = false;

    if (Number.isInteger(state.livroSetorSelecionado)) {
      select.value = String(state.livroSetorSelecionado);
    } else if (state.livroSetores.length === 1) {
      select.value = String(state.livroSetores[0].cd_setor_atendimento);
      state.livroSetorSelecionado = Number(select.value);
    }
  }

  export function renderLivroEnfermeiroSelect() {
    const select = document.getElementById('livro-enfermeiro');
    if (!select) return;

    if (!state.livroEnfermeiros.length) {
      select.innerHTML = '<option value="">Nenhum enfermeiro disponivel</option>';
      select.disabled = true;
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>';
    state.livroEnfermeiros.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.cd_pessoa_fisica);
      option.textContent = getEnfermeiroLabel(item);
      select.appendChild(option);
    });

    select.disabled = false;

    if (Number.isInteger(state.livroEnfermeiroSelecionado)) {
      select.value = String(state.livroEnfermeiroSelecionado);
    } else {
      const usuarioLogado = Number(state.usuario?.cd_pessoa_fisica);
      const existeLogado = state.livroEnfermeiros.some(
        item => Number(item.cd_pessoa_fisica) === usuarioLogado
      );

      if (Number.isInteger(usuarioLogado) && existeLogado) {
        state.livroEnfermeiroSelecionado = usuarioLogado;
      } else if (state.livroEnfermeiros.length === 1) {
        state.livroEnfermeiroSelecionado = Number(state.livroEnfermeiros[0].cd_pessoa_fisica);
      }

      if (Number.isInteger(state.livroEnfermeiroSelecionado)) {
        select.value = String(state.livroEnfermeiroSelecionado);
      }
    }
  }

  export function buildTecnicoOptionsHtml(selectedId, emptyLabel = 'Selecione...') {
    const selected = Number(selectedId);
    const options = [
      `<option value="">${utils.escapeHtml(emptyLabel)}</option>`,
      ...state.livroTecnicos.map(item => {
        const value = Number(item.cd_pessoa_fisica);
        const mark = Number.isInteger(selected) && selected === value ? 'selected' : '';
        return `<option value="${value}" ${mark}>${utils.escapeHtml(getTecnicoLabel(item))}</option>`;
      })
    ];

    return options.join('');
  }

  export function isTecnicoComPacientes(cdPessoaFisica, ignoreRowKey = null) {
    const tecnicoId = Number(cdPessoaFisica);
    if (!Number.isInteger(tecnicoId)) return false;

    return state.livroTecnicosSelecionados.some(row => {
      if (ignoreRowKey && row.row_key === ignoreRowKey) return false;
      return Number(row.cd_pessoa_fisica) === tecnicoId && Array.isArray(row.pacientes) && row.pacientes.length > 0;
    });
  }

  export function isTecnicoEmListaFuncao(lista, cdPessoaFisica, ignoreRowKey = null) {
    const tecnicoId = Number(cdPessoaFisica);
    if (!Number.isInteger(tecnicoId)) return false;

    return (lista || []).some(row => {
      if (ignoreRowKey && row.row_key === ignoreRowKey) return false;
      return Number(row.cd_pessoa_fisica) === tecnicoId;
    });
  }

  export function renderPatioList(locked) {
    const container = document.getElementById('livro-patio-list');
    if (!container) return;

    if (!state.livroPatio.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum técnico de pátio adicionado.</div>';
      return;
    }

    if (locked) {
      container.innerHTML = state.livroPatio
        .map((item, index) => `
          <div class="livro-item-card" data-row-key="${item.row_key}">
            <div class="livro-item-header">
              <span class="livro-item-title">Pátio ${index + 1}</span>
              <span class="livro-item-locked">${utils.escapeHtml(item._nome || 'Técnico')}</span>
            </div>
          </div>`)
        .join('');
      const addBtn = document.getElementById('btn-add-patio');
      if (addBtn) addBtn.style.display = 'none';
      return;
    }

    const addBtn = document.getElementById('btn-add-patio');
    if (addBtn) addBtn.style.display = '';

    container.innerHTML = state.livroPatio
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Pátio ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="patio-select" data-row-key="${item.row_key}">
                ${buildTecnicoOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-patio" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  export function renderCirculanteList(locked) {
    const container = document.getElementById('livro-circulante-list');
    if (!container) return;

    if (!state.livroCirculante.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum técnico circulante adicionado.</div>';
      return;
    }

    if (locked) {
      container.innerHTML = state.livroCirculante
        .map((item, index) => `
          <div class="livro-item-card" data-row-key="${item.row_key}">
            <div class="livro-item-header">
              <span class="livro-item-title">Circulante ${index + 1}</span>
              <span class="livro-item-locked">${utils.escapeHtml(item._nome || 'Técnico')}</span>
            </div>
          </div>`)
        .join('');
      const addBtn = document.getElementById('btn-add-circulante');
      if (addBtn) addBtn.style.display = 'none';
      return;
    }

    const addBtn = document.getElementById('btn-add-circulante');
    if (addBtn) addBtn.style.display = '';

    container.innerHTML = state.livroCirculante
      .map((item, index) => `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">Circulante ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <select class="form-select" style="max-width:280px" data-action="circulante-select" data-row-key="${item.row_key}">
                ${buildTecnicoOptionsHtml(item.cd_pessoa_fisica)}
              </select>
              <button class="btn-sm btn-secondary" type="button" data-action="remover-circulante" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`)
      .join('');
  }

  export function addPacienteToAvaliacao(rowKey, atendimento) {
    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    const atendimentoId = Number(atendimento);
    if (!row || !Number.isInteger(atendimentoId)) return;

    if (!Number.isInteger(row.cd_pessoa_fisica)) {
      ui.showToast('Selecione o técnico antes de adicionar pacientes', 'warning');
      return;
    }

    if (!row.pacientes.includes(atendimentoId)) {
      row.pacientes.push(atendimentoId);
    }
  }

  export function removePacienteFromAvaliacao(rowKey, atendimento) {
    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    const atendimentoId = Number(atendimento);
    if (!row || !Number.isInteger(atendimentoId)) return;

    row.pacientes = row.pacientes.filter(item => Number(item) !== atendimentoId);
  }

  export function getAutocompleteContextFromDescricao(input) {
    if (!input) return null;

    const text = String(input.value || '');
    const cursor = Number.isInteger(input.selectionStart) ? input.selectionStart : text.length;
    const trecho = text.slice(0, cursor);
    const match = trecho.match(/([A-Za-zÀ-ÿ]{2,})$/);
    if (!match) return null;

    return {
      query: match[1],
      tokenStart: cursor - match[1].length,
      tokenEnd: cursor
    };
  }

  export function insertPacienteNomeNaDescricao(rowKey, atendimento, tokenStart, tokenEnd) {
    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    const atendimentoId = Number(atendimento);
    if (!row || !Number.isInteger(atendimentoId)) return;

    const paciente = state.livroPacientes.find(
      item => Number(item.nr_atendimento || item.atendimento) === atendimentoId
    );
    const nomePaciente = paciente?.nome || `Paciente ${atendimentoId}`;
    const descricaoOriginal = String(row.descricao || '');

    if (
      Number.isInteger(tokenStart) &&
      Number.isInteger(tokenEnd) &&
      tokenStart >= 0 &&
      tokenEnd >= tokenStart &&
      tokenEnd <= descricaoOriginal.length
    ) {
      const before = descricaoOriginal.slice(0, tokenStart);
      const after = descricaoOriginal.slice(tokenEnd);
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
      const needsSpaceAfter = after.length > 0 && !/^\s|^[,.;:!?)]/.test(after);
      row.descricao = `${before}${needsSpaceBefore ? ' ' : ''}${nomePaciente}${needsSpaceAfter ? ' ' : ''}${after}`;
      return;
    }

    row.descricao = descricaoOriginal ? `${descricaoOriginal} ${nomePaciente}` : nomePaciente;
  }

  export function renderAvaliacaoAutocomplete(rowKey, context = null) {
    const dropdown = document.querySelector(`.autocomplete-dropdown[data-row-key="${rowKey}"]`);
    if (!dropdown) return;

    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    if (!row) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    const query = String(context?.query || '').trim().toLowerCase();
    if (!query || query.length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    if (Number.isInteger(context?.tokenStart) && Number.isInteger(context?.tokenEnd)) {
      dropdown.dataset.tokenStart = String(context.tokenStart);
      dropdown.dataset.tokenEnd = String(context.tokenEnd);
    } else {
      dropdown.dataset.tokenStart = '';
      dropdown.dataset.tokenEnd = '';
    }

    if (!Number.isInteger(row.cd_pessoa_fisica)) {
      dropdown.innerHTML = '<li>Selecione o técnico primeiro</li>';
      dropdown.classList.remove('hidden');
      return;
    }

    const sugestoes = state.livroPacientes
      .map(item => ({
        atendimento: Number(item.nr_atendimento || item.atendimento),
        nome: item.nome || 'Paciente',
        nome_civil: item.nome_civil || ''
      }))
      .filter(item => Number.isInteger(item.atendimento))
      .filter(item => `${item.nome} ${item.nome_civil}`.toLowerCase().includes(query))
      .filter(item => !row.pacientes.includes(item.atendimento))
      .slice(0, 10);

    if (!sugestoes.length) {
      dropdown.innerHTML = '<li>Nenhum paciente encontrado</li>';
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = sugestoes
      .map(item => `
        <li data-action="selecionar-paciente-avaliacao" data-row-key="${rowKey}" data-atendimento="${item.atendimento}">
          ${utils.escapeHtml(item.nome)} <span class="livro-muted">(Atend. ${item.atendimento})</span>
          ${utils.renderNomeCivilPaciente(item)}
        </li>`)
      .join('');
    dropdown.classList.remove('hidden');
  }

  export function renderAvaliacaoList() {
    const container = document.getElementById('livro-avaliacao-externa-list');
    if (!container) return;

    if (!Number.isInteger(state.livroSetorSelecionado)) {
      container.innerHTML = '<div class="livro-muted">Selecione um setor para configurar avaliação externa.</div>';
      return;
    }

    if (!state.livroAvaliacaoExterna.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum card de avaliação externa adicionado.</div>';
      return;
    }

    container.innerHTML = state.livroAvaliacaoExterna
      .map((row, index) => {
        const tags = (row.pacientes || [])
          .map(atendimento => {
            const paciente = state.livroPacientes.find(item => Number(item.nr_atendimento || item.atendimento) === Number(atendimento));
            const nome = paciente?.nome || `Paciente ${atendimento}`;
            return `
              <span class="tag-paciente">
                ${utils.escapeHtml(nome)} (Atend. ${atendimento})
                <button type="button" data-action="remover-paciente-avaliacao" data-row-key="${row.row_key}" data-atendimento="${atendimento}">&times;</button>
              </span>`;
          })
          .join('');

        return `
          <div class="livro-avaliacao-card" data-row-key="${row.row_key}">
            <div class="livro-avaliacao-header">
              <span class="livro-item-title">Técnico de Enfermagem ${index + 1}</span>
              <div class="livro-tecnico-actions">
                <select
                  class="form-select"
                  data-action="avaliacao-tecnico"
                  data-row-key="${row.row_key}"
                  aria-label="Técnico responsável pelo paciente na saída externa">
                  ${buildTecnicoOptionsHtml(row.cd_pessoa_fisica, 'Informe o técnico responsável pelo paciente na saída externa...')}
                </select>
                <button class="btn-sm btn-secondary" type="button" data-action="remover-avaliacao" data-row-key="${row.row_key}">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <div class="livro-avaliacao-body">
              <div class="paciente-search-wrapper">
                <textarea class="form-control paciente-descricao-input" data-row-key="${row.row_key}" placeholder="Ex.: Paciente Roberis saiu às 09h.">${utils.escapeHtml(row.descricao || '')}</textarea>
                <div class="livro-avaliacao-helper">Digite o nome do paciente no meio do texto para autocompletar.</div>
                <ul class="autocomplete-dropdown hidden" data-row-key="${row.row_key}"></ul>
              </div>
              <div class="pacientes-tags">
                ${tags || '<span class="livro-muted">Nenhum paciente vinculado.</span>'}
              </div>
            </div>
          </div>`;
      })
      .join('');
  }

  export function renderTecnicoRow(row, index) {
    const options = state.livroTecnicos
      .map(item => {
        const value = Number(item.cd_pessoa_fisica);
        const selected = Number(row.cd_pessoa_fisica) === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${utils.escapeHtml(getTecnicoLabel(item))}</option>`;
      })
      .join('');

    const pacientesHtml = state.livroPacientes.length
      ? state.livroPacientes
          .map(item => {
            const atendimento = Number(item.nr_atendimento || item.atendimento);
            const checked = row.pacientes.includes(atendimento);
            const vinculado = state.livroPacienteVinculo.get(atendimento);
            const disabled =
              !Number.isInteger(row.cd_pessoa_fisica) ||
              (Number.isInteger(vinculado) && vinculado !== Number(row.cd_pessoa_fisica) && !checked);

            return `
            <label class="livro-checkbox-label ${disabled ? 'disabled' : ''}">
              <input
                type="checkbox"
                class="livro-paciente-checkbox"
                data-row-key="${row.row_key}"
                data-paciente-id="${atendimento}"
                ${checked ? 'checked' : ''}
                ${disabled ? 'disabled' : ''}>
              <span class="livro-paciente-label-text">
                <span>${utils.escapeHtml(item.nome || 'Paciente')} (${atendimento})</span>
                ${utils.renderNomeCivilPaciente(item)}
              </span>
            </label>`;
          })
          .join('')
      : '<div class="livro-muted">Selecione um setor para carregar pacientes.</div>';

    return `
      <div class="livro-tecnico-card" data-row-key="${row.row_key}">
        <div class="livro-tecnico-header">
          <span class="livro-tecnico-title">Técnico ${index + 1}</span>
          <div class="livro-tecnico-actions">
            <select class="form-select livro-tecnico-select" data-action="tecnico-select" data-row-key="${row.row_key}">
              <option value="">Selecione...</option>
              ${options}
            </select>
            <button class="btn-sm btn-secondary" type="button" data-action="remover-tecnico" data-row-key="${row.row_key}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="livro-pacientes-grid">
          ${pacientesHtml}
        </div>
      </div>`;
  }

  export function renderTecnicosList() {
    const container = document.getElementById('livro-tecnicos-list');
    if (!container) return;

    refreshLivroPacienteVinculo();

    if (!state.livroTecnicosSelecionados.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum técnico adicionado.</div>';
      renderAvaliacaoList();
      renderPatioList();
      renderCirculanteList();
      return;
    }

    container.innerHTML = state.livroTecnicosSelecionados
      .map((item, index) => renderTecnicoRow(item, index))
      .join('');

    renderAvaliacaoList();
    renderPatioList();
    renderCirculanteList();
  }

  export function renderFaltasFolgasList() {
    const container = document.getElementById('livro-faltas-list');
    if (!container) return;

    if (!state.livroFaltasFolgas.length) {
      container.innerHTML = '<div class="livro-muted">Nenhum item de falta/folga adicionado.</div>';
      return;
    }

    const tecnicoOptions = state.livroTecnicos
      .map(item => `<option value="${item.cd_pessoa_fisica}">${utils.escapeHtml(getTecnicoLabel(item))}</option>`)
      .join('');

    container.innerHTML = state.livroFaltasFolgas
      .map((item, index) => {
        const selectedFalta = item.tipo === 'Falta' ? 'checked' : '';
        const selectedFolga = item.tipo === 'Folga' ? 'checked' : '';
        const value = Number.isInteger(item.cd_pessoa_fisica) ? String(item.cd_pessoa_fisica) : '';
        const label = item.tipo === 'Folga' ? 'Folga' : 'Falta';

        return `
        <div class="livro-item-card" data-row-key="${item.row_key}">
          <div class="livro-item-header">
            <span class="livro-item-title">${label} ${index + 1}</span>
            <div class="livro-tecnico-actions">
              <button class="btn-sm btn-secondary" type="button" data-action="remover-falta" data-row-key="${item.row_key}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <div class="livro-item-body">
            <select class="form-select" style="max-width:260px" data-action="falta-tecnico" data-row-key="${item.row_key}">
              <option value="">Selecione o técnico...</option>
              ${tecnicoOptions}
            </select>
            <div class="livro-falta-tipo">
              <label><input type="radio" name="falta_tipo_${item.row_key}" value="Falta" data-action="falta-tipo" data-row-key="${item.row_key}" ${selectedFalta}> Falta</label>
              <label><input type="radio" name="falta_tipo_${item.row_key}" value="Folga" data-action="falta-tipo" data-row-key="${item.row_key}" ${selectedFolga}> Folga</label>
            </div>
          </div>
        </div>`;
      })
      .join('');

    container.querySelectorAll('[data-action="falta-tecnico"]').forEach(select => {
      const row = state.livroFaltasFolgas.find(item => item.row_key === select.dataset.rowKey);
      if (row && Number.isInteger(row.cd_pessoa_fisica)) {
        select.value = String(row.cd_pessoa_fisica);
      }
    });
  }

  export async function loadSetoresLivro() {
    const select = document.getElementById('livro-setor');
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Carregando...</option>';
    }

    try {
      const dataPlantao = document.getElementById('livro-data-plantao')?.value || utils.getTodayIsoDate();
      const turno = getEscalaTurnoSelecionado();
      const result = await api.get(`/api/setores-livro?data=${dataPlantao}&turno=${turno}`);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar setores do livro');
      }

      const unicos = [];
      const seen = new Set();
      result.data.forEach(item => {
        const id = Number(item.cd_setor_atendimento);
        if (!Number.isInteger(id) || seen.has(id)) return;
        seen.add(id);
        unicos.push(item);
      });

      state.livroSetores = unicos;
      renderLivroSetorSelect();

      if (state.livroSetorSelecionado) {
        await loadPacientesSetor(state.livroSetorSelecionado);
      }
    } catch (err) {
      state.livroSetores = [];
      renderLivroSetorSelect();
      ui.showToast(err.message || 'Erro ao carregar setores do livro', 'error');
    }
  }

  export async function loadEnfermeiros() {
    const select = document.getElementById('livro-enfermeiro');
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Carregando...</option>';
    }

    try {
      const result = await api.get('/api/enfermeiros');
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar enfermeiros');
      }
      state.livroEnfermeiros = result.data;
      renderLivroEnfermeiroSelect();
      renderLivroEctSelects();
    } catch (err) {
      state.livroEnfermeiros = [];
      renderLivroEnfermeiroSelect();
      renderLivroEctSelects();
      ui.showToast(err.message || 'Erro ao carregar enfermeiros', 'error');
    }
  }

  export async function loadTecnicos() {
    try {
      const result = await api.get('/api/tecnicos');
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar técnicos');
      }
      state.livroTecnicos = result.data;
      renderTecnicosList();
      renderFaltasFolgasList();
      renderPatioList();
      renderCirculanteList();
      renderAvaliacaoList();
      renderLivroEctSelects();
    } catch (err) {
      state.livroTecnicos = [];
      renderTecnicosList();
      renderFaltasFolgasList();
      renderPatioList();
      renderCirculanteList();
      renderAvaliacaoList();
      renderLivroEctSelects();
      ui.showToast(err.message || 'Erro ao carregar técnicos', 'error');
    }
  }

  export async function loadPacientesSetor(cdSetor) {
    const setorId = Number(cdSetor);
    if (!Number.isInteger(setorId)) {
      state.livroPacientes = [];
      renderTecnicosList();
      renderAvaliacaoList();
      return;
    }

    try {
      const result = await api.get(`/api/pacientes-setor/${encodeURIComponent(String(setorId))}`);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Falha ao carregar pacientes do setor');
      }
      state.livroPacientes = result.data;
    } catch (err) {
      state.livroPacientes = [];
      ui.showToast(err.message || 'Erro ao carregar pacientes do setor', 'error');
    }

    refreshLivroPacienteVinculo();
    renderTecnicosList();
    renderAvaliacaoList();
  }

  export function hydrateLivroFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return;

    const dateInput = document.getElementById('livro-data-plantao');
    if (payload.data_plantao && !dateInput.value) {
      dateInput.value = payload.data_plantao;
    }

    const turnoPayload =
      payload.turno === 'N' ||
      (payload.hora_inicio === '19:00' && payload.hora_fim === '07:00')
        ? 'N'
        : 'M';
    document.querySelectorAll('input[name="livro-turno"]').forEach(radio => {
      radio.checked = radio.value === turnoPayload;
    });

    const enfermeiroId = Number(payload.enfermeiro_cd_pessoa_fisica);
    state.livroEnfermeiroSelecionado = Number.isInteger(enfermeiroId) ? enfermeiroId : null;
    renderLivroEnfermeiroSelect();

    if (typeof payload.observacoes === 'string') {
      document.getElementById('livro-observacoes').value = payload.observacoes;
    }

    state.livroPatio = [];
    state.livroCirculante = [];
    state.livroTecnicosSelecionados = [];

    if (Array.isArray(payload.tecnicos) && payload.tecnicos.length > 0) {
      payload.tecnicos.forEach(item => {
        const cdPessoa = Number(item.cd_pessoa_fisica);
        if (!Number.isInteger(cdPessoa)) return;

        const pacientes = Array.isArray(item.pacientes) ? item.pacientes.map(Number).filter(Number.isInteger) : [];
        const extras = Array.isArray(item.patio_circulante)
          ? [
              ...new Set(
                item.patio_circulante
                  .map(extra => String(extra || '').toLowerCase())
                  .map(extra => {
                    if (extra === 'patio' || extra === 'p\u00e1tio') return 'Patio';
                    if (extra === 'circulante') return 'Circulante';
                    return '';
                  })
                  .filter(Boolean)
              )
            ]
          : [];

        if (pacientes.length > 0) {
          state.livroTecnicosSelecionados.push({
            row_key: nextLivroRowKey('tec'),
            cd_pessoa_fisica: cdPessoa,
            pacientes
          });
        }

        if (extras.includes('Patio')) {
          state.livroPatio.push({
            row_key: nextLivroRowKey('patio'),
            cd_pessoa_fisica: cdPessoa
          });
        }

        if (extras.includes('Circulante')) {
          state.livroCirculante.push({
            row_key: nextLivroRowKey('circulante'),
            cd_pessoa_fisica: cdPessoa
          });
        }
      });
    }

    if (state.livroTecnicosSelecionados.length === 0) {
      state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    }

    if (Array.isArray(payload.faltas_folgas)) {
      state.livroFaltasFolgas = payload.faltas_folgas.map(item => ({
        row_key: nextLivroRowKey('falta'),
        cd_pessoa_fisica: Number(item.cd_pessoa_fisica) || null,
        tipo: item.tipo === 'Folga' ? 'Folga' : 'Falta'
      }));
    } else {
      state.livroFaltasFolgas = [];
    }

    if (Array.isArray(payload.avaliacao_externa) && payload.avaliacao_externa.length > 0) {
      if (typeof payload.avaliacao_externa[0] === 'object' && payload.avaliacao_externa[0] !== null) {
        state.livroAvaliacaoExterna = payload.avaliacao_externa.map(item => ({
          row_key: nextLivroRowKey('avaliacao'),
          cd_pessoa_fisica: Number.isInteger(Number(item.cd_pessoa_fisica)) ? Number(item.cd_pessoa_fisica) : null,
          pacientes: Array.isArray(item.pacientes) ? item.pacientes.map(Number).filter(Number.isInteger) : [],
          descricao: typeof item.descricao === 'string' ? item.descricao : ''
        }));
      } else {
        const pacientes = [...new Set(payload.avaliacao_externa.map(Number).filter(Number.isInteger))];
        state.livroAvaliacaoExterna = pacientes.length
          ? [
              {
                row_key: nextLivroRowKey('avaliacao'),
                cd_pessoa_fisica: null,
                pacientes,
                descricao: ''
              }
            ]
          : [];
      }
    } else {
      state.livroAvaliacaoExterna = [];
    }

    if (payload.ect) {
      const preList = Array.isArray(payload.ect.pre_procedimento)
        ? payload.ect.pre_procedimento
        : (Number.isInteger(Number(payload.ect.pre_procedimento)) ? [Number(payload.ect.pre_procedimento)] : []);
      const salaList = Array.isArray(payload.ect.sala_procedimento)
        ? payload.ect.sala_procedimento
        : (Number.isInteger(Number(payload.ect.sala_procedimento)) ? [Number(payload.ect.sala_procedimento)] : []);
      const recList = Array.isArray(payload.ect.sala_recuperacao)
        ? payload.ect.sala_recuperacao
        : (Number.isInteger(Number(payload.ect.sala_recuperacao)) ? [Number(payload.ect.sala_recuperacao)] : []);

      state.livroEctPre = preList.map(cd => ({
        row_key: nextLivroRowKey('ect_pre'),
        cd_pessoa_fisica: Number.isInteger(Number(cd)) ? Number(cd) : null
      }));
      state.livroEctSala = salaList.map(cd => ({
        row_key: nextLivroRowKey('ect_sala'),
        cd_pessoa_fisica: Number.isInteger(Number(cd)) ? Number(cd) : null
      }));
      state.livroEctRecuperacao = recList.map(cd => ({
        row_key: nextLivroRowKey('ect_rec'),
        cd_pessoa_fisica: Number.isInteger(Number(cd)) ? Number(cd) : null
      }));
    } else {
      state.livroEctPre = [];
      state.livroEctSala = [];
      state.livroEctRecuperacao = [];
    }

    updateLivroSectionsVisibility();
    renderLivroEctSelects();
    refreshLivroPacienteVinculo();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
  }

  export function fillLivroDefaults() {
    const dateInput = document.getElementById('livro-data-plantao');
    if (dateInput && !dateInput.value) {
      dateInput.value = utils.getTodayIsoDate();
    }

    const turnoSelecionado = getEscalaTurnoSelecionado();
    if (!turnoSelecionado) {
      const turnoManha = document.querySelector('input[name="livro-turno"][value="M"]');
      if (turnoManha) turnoManha.checked = true;
    }

    if (state.livroTecnicosSelecionados.length === 0) {
      state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    }
    if (state.livroFaltasFolgas.length === 0) {
      state.livroFaltasFolgas = [];
    }
    if (!Array.isArray(state.livroAvaliacaoExterna)) {
      state.livroAvaliacaoExterna = [];
    }
    if (!Array.isArray(state.livroPatio)) {
      state.livroPatio = [];
    }
    if (!Array.isArray(state.livroCirculante)) {
      state.livroCirculante = [];
    }

    renderLivroEnfermeiroSelect();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
  }


  export async function restoreLivroDraft(draftPayload, transitionId = modeTransitionSeq) {
    if (!draftPayload || !router.isCurrentWorkspace(transitionId, 'livro')) return;
    draftHydratingModules.add('livro');

    try {
      const dateInput = document.getElementById('livro-data-plantao');
      if (dateInput && draftPayload.dataPlantao) dateInput.value = draftPayload.dataPlantao;
      document.querySelectorAll('input[name="livro-turno"]').forEach(radio => {
        radio.checked = radio.value === (draftPayload.turno === 'N' ? 'N' : 'M');
      });

      state.livroSetorSelecionado = Number.isInteger(Number(draftPayload.setorSelecionado))
        ? Number(draftPayload.setorSelecionado)
        : null;
      state.livroEnfermeiroSelecionado = Number.isInteger(Number(draftPayload.enfermeiroSelecionado))
        ? Number(draftPayload.enfermeiroSelecionado)
        : null;
      state.livroTecnicosSelecionados = draft.cloneDraftValue(draftPayload.tecnicosSelecionados, []);
      state.livroFaltasFolgas = draft.cloneDraftValue(draftPayload.faltasFolgas, []);
      state.livroPatio = draft.cloneDraftValue(draftPayload.patio, []);
      state.livroCirculante = draft.cloneDraftValue(draftPayload.circulante, []);
      state.livroAvaliacaoExterna = draft.cloneDraftValue(draftPayload.avaliacaoExterna, []);

      const observacoes = document.getElementById('livro-observacoes');
      if (observacoes) observacoes.value = draftPayload.observacoes || '';

      renderLivroSetorSelect();
      renderLivroEnfermeiroSelect();
      if (state.livroSetorSelecionado) {
        await loadPacientesSetor(state.livroSetorSelecionado);
        if (!router.isCurrentWorkspace(transitionId, 'livro')) return;
      }
      refreshLivroPacienteVinculo();
      renderTecnicosList();
      renderFaltasFolgasList();
      renderPatioList();
      renderCirculanteList();
      renderAvaliacaoList();
      ensureLivroEditable();
    } finally {
      draftHydratingModules.delete('livro');
      draft.updateTopbarDraftIndicators();
    }
  }

  export async function enterLivroMode() {

    if (!canAccessLivro()) {
      ui.showToast('Módulo de livro disponível apenas para Enfermagem', 'warning');
      window.conectaCore.enterPassagemMode();
      return;
    }

    const transitionId = router.activateWorkspace('livro', document.getElementById('workspace-livro'));
    const livroDraft = draft.getModuleDraft('livro');

    if (!state.livroLoaded) {
      fillLivroDefaults();

      await loadSetoresLivro();
      if (!router.isCurrentWorkspace(transitionId, 'livro')) return;
      await loadEnfermeiros();
      if (!router.isCurrentWorkspace(transitionId, 'livro')) return;
      await loadTecnicos();
      if (!router.isCurrentWorkspace(transitionId, 'livro')) return;

      state.livroLoaded = true;
    }

    if (livroDraft) {
      await restoreLivroDraft(livroDraft, transitionId);
      if (!router.isCurrentWorkspace(transitionId, 'livro')) return;
    }

    await refreshHistoricoButton();

  }






  export function adicionarTecnico() {
    state.livroTecnicosSelecionados.push(buildLivroTecnicoRow());
    renderTecnicosList();
  }

  export function removerTecnico(rowKey) {
    if (state.livroTecnicosSelecionados.length <= 1) {
      ui.showToast('Mantenha ao menos uma linha de técnico', 'warning');
      return;
    }

    state.livroTecnicosSelecionados = state.livroTecnicosSelecionados.filter(item => item.row_key !== rowKey);
    refreshLivroPacienteVinculo();
    renderTecnicosList();
  }

  export function adicionarAvaliacao() {
    state.livroAvaliacaoExterna.push(buildAvaliacaoRow());
    renderAvaliacaoList();
  }

  export function removerAvaliacao(rowKey) {
    state.livroAvaliacaoExterna = state.livroAvaliacaoExterna.filter(item => item.row_key !== rowKey);
    renderAvaliacaoList();
  }

  export function adicionarPatio() {
    state.livroPatio.push(buildPatioRow());
    renderPatioList();
  }

  export function removerPatio(rowKey) {
    state.livroPatio = state.livroPatio.filter(item => item.row_key !== rowKey);
    renderPatioList();
  }

  export function adicionarCirculante() {
    state.livroCirculante.push(buildCirculanteRow());
    renderCirculanteList();
  }

  export function removerCirculante(rowKey) {
    state.livroCirculante = state.livroCirculante.filter(item => item.row_key !== rowKey);
    renderCirculanteList();
  }

  export function isTecnicoComConflitoDeFuncao(cdPessoaFisica, tipo, rowKey = null) {
    const tecnicoId = Number(cdPessoaFisica);
    if (!Number.isInteger(tecnicoId)) return false;

    if (tipo === 'tecnico') {
      return (
        isTecnicoEmListaFuncao(state.livroPatio, tecnicoId) ||
        isTecnicoEmListaFuncao(state.livroCirculante, tecnicoId)
      );
    }

    if (tipo === 'patio') {
      return (
        isTecnicoEmListaFuncao(state.livroPatio, tecnicoId, rowKey) ||
        isTecnicoEmListaFuncao(state.livroCirculante, tecnicoId) ||
        isTecnicoComPacientes(tecnicoId)
      );
    }

    if (tipo === 'circulante') {
      return (
        isTecnicoEmListaFuncao(state.livroCirculante, tecnicoId, rowKey) ||
        isTecnicoEmListaFuncao(state.livroPatio, tecnicoId) ||
        isTecnicoComPacientes(tecnicoId)
      );
    }

    return false;
  }

  export function adicionarFalta() {
    state.livroFaltasFolgas.push(buildLivroFaltaRow());
    renderFaltasFolgasList();
  }

  export function removerFalta(rowKey) {
    state.livroFaltasFolgas = state.livroFaltasFolgas.filter(item => item.row_key !== rowKey);
    renderFaltasFolgasList();
  }

  export function togglePaciente(rowKey, pacienteId, checkbox) {
    const row = state.livroTecnicosSelecionados.find(item => item.row_key === rowKey);
    const atendimento = Number(pacienteId);
    if (!row || !Number.isInteger(atendimento)) return;

    if (!Number.isInteger(row.cd_pessoa_fisica)) {
      checkbox.checked = false;
      ui.showToast('Selecione um técnico antes de vincular pacientes', 'warning');
      return;
    }

    const tecnicoVinculado = state.livroPacienteVinculo.get(atendimento);
    if (checkbox.checked) {
      if (isTecnicoComConflitoDeFuncao(row.cd_pessoa_fisica, 'tecnico')) {
        checkbox.checked = false;
        ui.showToast('Técnico em pátio/circulante não pode receber pacientes na lista de técnicos', 'warning');
        return;
      }

      if (Number.isInteger(tecnicoVinculado) && tecnicoVinculado !== Number(row.cd_pessoa_fisica)) {
        checkbox.checked = false;
        ui.showToast('Paciente já vinculado a outro técnico', 'error');
        return;
      }

      if (!row.pacientes.includes(atendimento)) {
        row.pacientes.push(atendimento);
      }
    } else {
      row.pacientes = row.pacientes.filter(item => Number(item) !== atendimento);
    }

    refreshLivroPacienteVinculo();
    renderTecnicosList();
  }

  export function showConfirmModal(title, message) {
    return new Promise(resolve => {
      const overlay = document.getElementById('modal-confirm-overlay');
      document.getElementById('modal-confirm-title').textContent = title;
      document.getElementById('modal-confirm-message').textContent = message;
      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');

      const close = (result) => {
        overlay.classList.add('d-none');
        document.body.classList.remove('modal-open');
        resolve(result);
      };

      document.getElementById('modal-confirm-yes').onclick = () => close(true);
      document.getElementById('modal-confirm-no').onclick = () => close(false);
      overlay.onclick = e => { if (e.target === overlay) close(false); };
    });
  }

  export function showJustificativaModal() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-card modal-card-wide">
          <h3><i class="bi bi-pencil-square"></i> Justificativa da alteração</h3>
          <p style="margin-bottom:0.8rem;color:var(--slate-600)">Por que esta escala está sendo alterada?</p>
          <textarea id="justificativa-input" rows="3" placeholder="Descreva o motivo da alteração..."></textarea>
          <div class="modal-actions">
            <button class="modal-btn-secondary" id="justificativa-cancel">Cancelar</button>
            <button class="modal-btn-primary" id="justificativa-confirm">Confirmar</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');

      const input = overlay.querySelector('#justificativa-input');
      input.focus();

      overlay.querySelector('#justificativa-cancel').onclick = () => {
        overlay.remove();
        document.body.classList.remove('modal-open');
        resolve(null);
      };

      overlay.querySelector('#justificativa-confirm').onclick = () => {
        const valor = input.value.trim();
        overlay.remove();
        document.body.classList.remove('modal-open');
        resolve(valor || null);
      };

      overlay.onclick = e => {
        if (e.target === overlay) {
          overlay.remove();
          document.body.classList.remove('modal-open');
          resolve(null);
        }
      };
    });
  }

  export function clearLivroForm() {
    document.getElementById('livro-observacoes').value = '';
    state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    state.livroFaltasFolgas = [];
    state.livroPatio = [];
    state.livroCirculante = [];
    state.livroAvaliacaoExterna = [];
    state.livroPacienteVinculo = new Map();
    state.livroEnfermeiroSelecionado = null;
    state.livroEctPre = [];
    state.livroEctSala = [];
    state.livroEctRecuperacao = [];
    ensureLivroEditable();
    renderLivroPreviewData(null);
    renderLivroEnfermeiroSelect();
    updateLivroSectionsVisibility();
    renderLivroEctSelects();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
  }

  export async function checkPatioCirculanteGlobal() {
    const data = document.getElementById('livro-data-plantao')?.value;
    const turno = getEscalaTurnoSelecionado();
    if (!data || !turno) return;

    try {
      const res = await api.get(`/api/escala-ativa/patio-circulante-global?dt_plantao=${data}&turno=${turno}`);
      if (!res.success) return;

      state.livroPatioCirculanteLocked = res.data.locked;
      state.livroPatioGlobal = res.data.patio;
      state.livroCirculanteGlobal = res.data.circulante;

      if (res.data.locked) {
        state.livroPatio = (res.data.patio || []).map(p => ({
          row_key: 'patio_global_' + p.cd_pessoa_fisica,
          cd_pessoa_fisica: p.cd_pessoa_fisica,
          _nome: p.nome
        }));
        state.livroCirculante = (res.data.circulante || []).map(c => ({
          row_key: 'circ_global_' + c.cd_pessoa_fisica,
          cd_pessoa_fisica: c.cd_pessoa_fisica,
          _nome: c.nome
        }));
        ui.showToast('Pátio e Circulante definidos pela primeira escala liberada', 'info');
      } else {
        state.livroPatioCirculanteLocked = false;
      }

      renderPatioList(state.livroPatioCirculanteLocked);
      renderCirculanteList(state.livroPatioCirculanteLocked);
    } catch (e) {
      console.error('[checkPatioCirculanteGlobal] Erro:', e);
    }
  }

  export async function onLivroSetorChange() {
    const select = document.getElementById('livro-setor');
    const cdSetor = Number(select.value);

    state.livroSetorSelecionado = Number.isInteger(cdSetor) ? cdSetor : null;

    if (!state.livroSetorSelecionado) {
      clearLivroForm();
      return;
    }

    ensureLivroEditable();
    clearLivroForm();
    await loadPacientesSetor(state.livroSetorSelecionado);
    await refreshHistoricoButton();
    await loadLivroAdministrativoByDate(getLivroDataSelecionada());
    await checkPatioCirculanteGlobal();
  }

  export function collectEscalaTecnicaPayload() {
    const cdSetor = Number(state.livroSetorSelecionado);
    if (!Number.isInteger(cdSetor)) {
      ui.showToast('Selecione o setor do plantão', 'warning');
      return null;
    }

    const turno = getEscalaTurnoSelecionado();
    if (!turno) {
      ui.showToast('Selecione o turno (Diurno ou Noturno)', 'warning');
      return null;
    }

    const enfermeiroId = Number(state.livroEnfermeiroSelecionado);
    if (!Number.isInteger(enfermeiroId)) {
      ui.showToast('Selecione o enfermeiro responsável', 'warning');
      return null;
    }

    const extrasByTecnico = new Map();

    const appendExtra = (cdPessoaFisica, extra) => {
      if (!Number.isInteger(cdPessoaFisica)) return;
      if (!extrasByTecnico.has(cdPessoaFisica)) {
        extrasByTecnico.set(cdPessoaFisica, new Set());
      }
      extrasByTecnico.get(cdPessoaFisica).add(extra);
    };

    state.livroPatio
      .map(item => Number(item.cd_pessoa_fisica))
      .filter(Number.isInteger)
      .forEach(cdPessoaFisica => appendExtra(cdPessoaFisica, 'Patio'));

    state.livroCirculante
      .map(item => Number(item.cd_pessoa_fisica))
      .filter(Number.isInteger)
      .forEach(cdPessoaFisica => appendExtra(cdPessoaFisica, 'Circulante'));

    const tecnicosMap = new Map();
    state.livroTecnicosSelecionados.forEach(item => {
      const cdPessoaFisica = Number(item.cd_pessoa_fisica);
      if (!Number.isInteger(cdPessoaFisica)) return;

      const pacientesValidos = (item.pacientes || [])
        .map(Number)
        .filter(Number.isInteger);
      if (pacientesValidos.length === 0) return;

      if (!tecnicosMap.has(cdPessoaFisica)) {
        tecnicosMap.set(cdPessoaFisica, {
          cd_pessoa_fisica: cdPessoaFisica,
          pacientes: new Set(),
          patio_circulante: new Set()
        });
      }

      const entry = tecnicosMap.get(cdPessoaFisica);
      pacientesValidos.forEach(atendimento => entry.pacientes.add(atendimento));
    });

    extrasByTecnico.forEach((extras, cdPessoaFisica) => {
      if (!tecnicosMap.has(cdPessoaFisica)) {
        tecnicosMap.set(cdPessoaFisica, {
          cd_pessoa_fisica: cdPessoaFisica,
          pacientes: new Set(),
          patio_circulante: new Set()
        });
      }

      const entry = tecnicosMap.get(cdPessoaFisica);
      extras.forEach(extra => entry.patio_circulante.add(extra));
    });

    const tecnicos = [...tecnicosMap.values()].map(item => ({
      cd_pessoa_fisica: item.cd_pessoa_fisica,
      pacientes: [...item.pacientes],
      patio_circulante: [...item.patio_circulante]
    }));

    const faltas_folgas = state.livroFaltasFolgas
      .filter(item => Number.isInteger(item.cd_pessoa_fisica) && ['Falta', 'Folga'].includes(item.tipo))
      .map(item => ({
        cd_pessoa_fisica: Number(item.cd_pessoa_fisica),
        tipo: item.tipo
      }));

    const avaliacao_externa = state.livroAvaliacaoExterna
      .map(item => ({
        cd_pessoa_fisica: Number.isInteger(Number(item.cd_pessoa_fisica)) ? Number(item.cd_pessoa_fisica) : null,
        pacientes: Array.isArray(item.pacientes) ? [...new Set(item.pacientes.map(Number).filter(Number.isInteger))] : [],
        descricao: String(item.descricao || '').trim()
      }))
      .filter(item => Number.isInteger(item.cd_pessoa_fisica) && item.pacientes.length > 0);

    const observacoes = document.getElementById('livro-observacoes').value || '';

    if (isLivroSetorEct()) {
      const preList = state.livroEctPre.map(i => Number(i.cd_pessoa_fisica)).filter(Number.isInteger);
      const salaList = state.livroEctSala.map(i => Number(i.cd_pessoa_fisica)).filter(Number.isInteger);
      const recList = state.livroEctRecuperacao.map(i => Number(i.cd_pessoa_fisica)).filter(Number.isInteger);

      const temEct = preList.length > 0 || salaList.length > 0 || recList.length > 0;

      if (!temEct && !observacoes.trim()) {
        ui.showToast('Adicione profissionais na equipe ECT ou informe observações', 'warning');
        return null;
      }

      return {
        data_plantao: document.getElementById('livro-data-plantao').value || utils.getTodayIsoDate(),
        turno,
        cd_setor_atendimento: cdSetor,
        cd_modulo: cdSetor === 4 ? 4 : 1,
        enfermeiro_cd_pessoa_fisica: enfermeiroId,
        ect: {
          pre_procedimento: preList,
          sala_procedimento: salaList,
          sala_recuperacao: recList
        },
        tecnicos: [],
        faltas_folgas: [],
        avaliacao_externa: [],
        observacoes
      };
    }

    const temPacientes = tecnicos.some(item => item.pacientes.length > 0);
    const temPatioCirculante = extrasByTecnico.size > 0;
    const temAvaliacaoExterna = avaliacao_externa.length > 0;

    if (!temPacientes && !temPatioCirculante && faltas_folgas.length === 0 && !temAvaliacaoExterna && !observacoes.trim()) {
      ui.showToast('Preencha técnicos/pacientes, pátio/circulante, faltas/folgas, avaliação externa ou observações', 'warning');
      return null;
    }

    return {
      data_plantao: document.getElementById('livro-data-plantao').value || utils.getTodayIsoDate(),
      turno,
      cd_setor_atendimento: cdSetor,
      cd_modulo: cdSetor === 4 ? 4 : 1,
      enfermeiro_cd_pessoa_fisica: enfermeiroId,
      tecnicos,
      faltas_folgas,
      avaliacao_externa,
      observacoes
    };
  }

  export function adicionarEctPre() {
    state.livroEctPre.push(buildEctPreRow());
    renderEctPreList();
  }

  export function removerEctPre(rowKey) {
    state.livroEctPre = state.livroEctPre.filter(item => item.row_key !== rowKey);
    renderEctPreList();
  }

  export function adicionarEctSala() {
    state.livroEctSala.push(buildEctSalaRow());
    renderEctSalaList();
  }

  export function removerEctSala(rowKey) {
    state.livroEctSala = state.livroEctSala.filter(item => item.row_key !== rowKey);
    renderEctSalaList();
  }

  export function adicionarEctRecuperacao() {
    state.livroEctRecuperacao.push(buildEctRecuperacaoRow());
    renderEctRecuperacaoList();
  }

  export function removerEctRecuperacao(rowKey) {
    state.livroEctRecuperacao = state.livroEctRecuperacao.filter(item => item.row_key !== rowKey);
    renderEctRecuperacaoList();
  }

  document.getElementById('livro-setor').addEventListener('change', onLivroSetorChange);

  const loadLivroContextoDebounced = utils.debounce(async () => {
    const dateValue = getLivroDataSelecionada();
    loadLivroAdministrativoByDate(dateValue);
    await checkPatioCirculanteGlobal();
    await loadSetoresLivro();
  }, 300);

  document.getElementById('livro-data-plantao').addEventListener('change', loadLivroContextoDebounced);
  document.querySelectorAll('input[name="livro-turno"]').forEach(radio => {
    radio.addEventListener('change', loadLivroContextoDebounced);
  });

  document.getElementById('btn-livro-editar')?.addEventListener('click', ensureLivroEditable);

  document.getElementById('livro-enfermeiro').addEventListener('change', e => {
    const value = Number(e.target.value);
    state.livroEnfermeiroSelecionado = Number.isInteger(value) ? value : null;
  });

  document.getElementById('btn-add-ect-pre')?.addEventListener('click', adicionarEctPre);
  document.getElementById('btn-add-ect-sala')?.addEventListener('click', adicionarEctSala);
  document.getElementById('btn-add-ect-recuperacao')?.addEventListener('click', adicionarEctRecuperacao);

  document.getElementById('livro-ect-pre-list')?.addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;
    if (target.matches('[data-action="ect-pre-select"]')) {
      const val = Number(target.value);
      const row = state.livroEctPre.find(i => i.row_key === rowKey);
      if (row) row.cd_pessoa_fisica = Number.isInteger(val) ? val : null;
    }
  });

  document.getElementById('livro-ect-pre-list')?.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-ect-pre"]');
    if (!button) return;
    removerEctPre(button.dataset.rowKey);
  });

  document.getElementById('livro-ect-sala-list')?.addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;
    if (target.matches('[data-action="ect-sala-select"]')) {
      const val = Number(target.value);
      const row = state.livroEctSala.find(i => i.row_key === rowKey);
      if (row) row.cd_pessoa_fisica = Number.isInteger(val) ? val : null;
    }
  });

  document.getElementById('livro-ect-sala-list')?.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-ect-sala"]');
    if (!button) return;
    removerEctSala(button.dataset.rowKey);
  });

  document.getElementById('livro-ect-recuperacao-list')?.addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;
    if (target.matches('[data-action="ect-recuperacao-select"]')) {
      const val = Number(target.value);
      const row = state.livroEctRecuperacao.find(i => i.row_key === rowKey);
      if (row) row.cd_pessoa_fisica = Number.isInteger(val) ? val : null;
    }
  });

  document.getElementById('livro-ect-recuperacao-list')?.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-ect-recuperacao"]');
    if (!button) return;
    removerEctRecuperacao(button.dataset.rowKey);
  });
  document.getElementById('btn-add-tecnico').addEventListener('click', adicionarTecnico);
  document.getElementById('btn-add-falta').addEventListener('click', adicionarFalta);
  document.getElementById('btn-add-avaliacao-externa')?.addEventListener('click', adicionarAvaliacao);
  document.getElementById('btn-add-patio')?.addEventListener('click', adicionarPatio);
  document.getElementById('btn-add-circulante')?.addEventListener('click', adicionarCirculante);

  document.getElementById('livro-tecnicos-list').addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;

    if (target.matches('[data-action="tecnico-select"]')) {
      const novoTecnico = Number(target.value);
      const row = state.livroTecnicosSelecionados.find(item => item.row_key === rowKey);
      if (!row) return;

      if (
        Number.isInteger(novoTecnico) &&
        state.livroTecnicosSelecionados.some(
          item => item.row_key !== rowKey && Number(item.cd_pessoa_fisica) === novoTecnico
        )
      ) {
        target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
        ui.showToast('Técnico já selecionado em outra linha', 'warning');
        return;
      }

      if (Number.isInteger(novoTecnico) && isTecnicoComConflitoDeFuncao(novoTecnico, 'tecnico', rowKey)) {
        target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
        ui.showToast('Técnico em pátio/circulante não pode ficar na lista de técnicos com pacientes', 'warning');
        return;
      }

      row.cd_pessoa_fisica = Number.isInteger(novoTecnico) ? novoTecnico : null;
      row.pacientes = [];
      refreshLivroPacienteVinculo();
      renderTecnicosList();
      return;
    }

    if (target.matches('.livro-paciente-checkbox')) {
      togglePaciente(rowKey, target.dataset.pacienteId, target);
      return;
    }
  });

  document.getElementById('livro-tecnicos-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-tecnico"]');
    if (!button) return;
    removerTecnico(button.dataset.rowKey);
  });

  document.getElementById('livro-faltas-list').addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;

    const row = state.livroFaltasFolgas.find(item => item.row_key === rowKey);
    if (!row) return;

    if (target.matches('[data-action="falta-tecnico"]')) {
      const tecnico = Number(target.value);
      row.cd_pessoa_fisica = Number.isInteger(tecnico) ? tecnico : null;
      return;
    }

    if (target.matches('[data-action="falta-tipo"]')) {
      row.tipo = target.value === 'Folga' ? 'Folga' : 'Falta';
    }
  });

  document.getElementById('livro-faltas-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-falta"]');
    if (!button) return;
    removerFalta(button.dataset.rowKey);
  });

  document.getElementById('livro-patio-list').addEventListener('change', e => {
    const target = e.target;
    if (!target.matches('[data-action="patio-select"]')) return;

    const rowKey = target.dataset.rowKey;
    const row = state.livroPatio.find(item => item.row_key === rowKey);
    if (!row) return;

    const tecnicoId = Number(target.value);
    if (!Number.isInteger(tecnicoId)) {
      row.cd_pessoa_fisica = null;
      return;
    }

    if (isTecnicoComConflitoDeFuncao(tecnicoId, 'patio', rowKey)) {
      target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
      ui.showToast('Técnico já vinculado em outra função', 'warning');
      return;
    }

    row.cd_pessoa_fisica = tecnicoId;
  });

  document.getElementById('livro-patio-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-patio"]');
    if (!button) return;
    removerPatio(button.dataset.rowKey);
  });

  document.getElementById('livro-circulante-list').addEventListener('change', e => {
    const target = e.target;
    if (!target.matches('[data-action="circulante-select"]')) return;

    const rowKey = target.dataset.rowKey;
    const row = state.livroCirculante.find(item => item.row_key === rowKey);
    if (!row) return;

    const tecnicoId = Number(target.value);
    if (!Number.isInteger(tecnicoId)) {
      row.cd_pessoa_fisica = null;
      return;
    }

    if (isTecnicoComConflitoDeFuncao(tecnicoId, 'circulante', rowKey)) {
      target.value = Number.isInteger(row.cd_pessoa_fisica) ? String(row.cd_pessoa_fisica) : '';
      ui.showToast('Técnico já vinculado em outra função', 'warning');
      return;
    }

    row.cd_pessoa_fisica = tecnicoId;
  });

  document.getElementById('livro-circulante-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action="remover-circulante"]');
    if (!button) return;
    removerCirculante(button.dataset.rowKey);
  });

  document.getElementById('livro-avaliacao-externa-list').addEventListener('change', e => {
    const target = e.target;
    const rowKey = target?.dataset?.rowKey;
    if (!rowKey) return;

    if (!target.matches('[data-action="avaliacao-tecnico"]')) return;

    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    if (!row) return;

    const tecnicoId = Number(target.value);
    row.cd_pessoa_fisica = Number.isInteger(tecnicoId) ? tecnicoId : null;
  });

  const renderAvaliacaoAutocompleteDebounced = utils.debounce((rowKey, context) => {
    renderAvaliacaoAutocomplete(rowKey, context);
  }, 300);

  document.getElementById('livro-avaliacao-externa-list').addEventListener('input', e => {
    const target = e.target;
    if (!target.matches('.paciente-descricao-input')) return;

    const rowKey = target.dataset.rowKey;
    if (!rowKey) return;

    const row = state.livroAvaliacaoExterna.find(item => item.row_key === rowKey);
    if (!row) return;

    row.descricao = String(target.value || '');
    const context = getAutocompleteContextFromDescricao(target);
    renderAvaliacaoAutocompleteDebounced(rowKey, context);
  });

  document.getElementById('livro-avaliacao-externa-list').addEventListener('click', e => {
    const removerBtn = e.target.closest('[data-action="remover-avaliacao"]');
    if (removerBtn) {
      removerAvaliacao(removerBtn.dataset.rowKey);
      return;
    }

    const removerPacienteBtn = e.target.closest('[data-action="remover-paciente-avaliacao"]');
    if (removerPacienteBtn) {
      removePacienteFromAvaliacao(removerPacienteBtn.dataset.rowKey, removerPacienteBtn.dataset.atendimento);
      renderAvaliacaoList();
      return;
    }

    const selecionarPaciente = e.target.closest('[data-action="selecionar-paciente-avaliacao"]');
    if (selecionarPaciente) {
      const rowKey = selecionarPaciente.dataset.rowKey;
      const atendimento = selecionarPaciente.dataset.atendimento;
      const dropdown = document.querySelector(`.autocomplete-dropdown[data-row-key="${rowKey}"]`);
      const tokenStartRaw = dropdown?.dataset?.tokenStart || '';
      const tokenEndRaw = dropdown?.dataset?.tokenEnd || '';
      const tokenStart = /^\d+$/.test(tokenStartRaw) ? Number(tokenStartRaw) : null;
      const tokenEnd = /^\d+$/.test(tokenEndRaw) ? Number(tokenEndRaw) : null;

      insertPacienteNomeNaDescricao(rowKey, atendimento, tokenStart, tokenEnd);
      addPacienteToAvaliacao(rowKey, atendimento);
      renderAvaliacaoList();
    }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.paciente-search-wrapper')) return;
    document.querySelectorAll('.autocomplete-dropdown').forEach(dropdown => dropdown.classList.add('hidden'));
  });

  document.getElementById('workspace-livro')?.addEventListener('input', () => draft.markModuleDraftDirty('livro'));
  document.getElementById('workspace-livro')?.addEventListener('change', () => draft.markModuleDraftDirty('livro'));
  document.getElementById('workspace-livro')?.addEventListener('click', event => {
    const mutationControl = event.target.closest(
      '#btn-add-tecnico, #btn-add-falta, #btn-add-avaliacao-externa, #btn-add-patio, #btn-add-circulante, ' +
      '[data-action="remover-tecnico"], [data-action="remover-falta"], [data-action="remover-avaliacao"], ' +
      '[data-action="remover-patio"], [data-action="remover-circulante"], ' +
      '[data-action="remover-paciente-avaliacao"], [data-action="selecionar-paciente-avaliacao"]'
    );
    if (mutationControl) draft.markModuleDraftDirty('livro');
  });

  document.getElementById('btn-livro-salvar').addEventListener('click', async () => {
    const btn = document.getElementById('btn-livro-salvar');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
    btn.disabled = true;

    try {
      const payload = collectEscalaTecnicaPayload();
      if (!payload) return;

      const setorId = payload.cd_setor_atendimento;
      const dtPlantao = payload.data_plantao || utils.getTodayIsoDate();
      const turno = payload.turno || 'M';

      const checkResult = await api.get(
        `/api/escala-ativa?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}`
      );

      if (checkResult.success && checkResult.data && checkResult.data.tecnicos && checkResult.data.tecnicos.length > 0) {
        const confirm = await ui.showConfirmModal(
          'Escala já existente',
          'Já existe uma escala para este setor, data e turno. Deseja alterar?'
        );
        if (!confirm) return;

        const justificativa = await showJustificativaModal();
        if (justificativa === null) return;
        payload.ds_justificativa = justificativa;
      }

      const resultDb = await api.put('/api/escala-ativa', payload);
      if (!resultDb.success) {
        ui.showToast(resultDb.message || 'Falha ao salvar escala', 'error');
        return;
      }

      const resultOc = await api.post('/api/escala-tecnica', payload);
      if (resultOc.success) {
        draft.clearModuleDraft('livro');
        ui.showToast('Escala salva com sucesso', 'success');
        await loadLivroAdministrativoByDate(dtPlantao);
      } else {
        ui.showToast(resultOc.message || 'Escala salva no DB mas falha no histórico', 'warning');
        await loadLivroAdministrativoByDate(dtPlantao);
      }
    } catch (err) {
      ui.showToast('Erro ao salvar escala técnica', 'error');
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  });

  export async function limparLivro() {
    const confirm = await ui.showConfirmModal(
      'Limpar Livro Administrativo',
      'Deseja limpar todos os dados preenchidos e descartar o rascunho atual?'
    );
    if (!confirm) return;

    // 1. Limpa o rascunho do módulo
    draft.clearModuleDraft('livro');
    draft.discardModuleWork('livro');

    // 2. Reseta o estado em memória
    state.livroSetorSelecionado = null;
    state.livroEnfermeiroSelecionado = null;
    state.livroTecnicosSelecionados = [buildLivroTecnicoRow(), buildLivroTecnicoRow()];
    state.livroFaltasFolgas = [];
    state.livroPatio = [];
    state.livroCirculante = [];
    state.livroAvaliacaoExterna = [];
    state.livroEctPre = [];
    state.livroEctSala = [];
    state.livroEctRecuperacao = [];
    state.livroPacientesSetor = [];

    // 3. Reseta os campos do DOM
    const dateInput = document.getElementById('livro-data-plantao');
    if (dateInput) dateInput.value = utils.getTodayIsoDate();

    const turnoManha = document.querySelector('input[name="livro-turno"][value="M"]');
    if (turnoManha) turnoManha.checked = true;

    const setorSelect = document.getElementById('livro-setor');
    if (setorSelect) setorSelect.value = '';

    const enfermeiroSelect = document.getElementById('livro-enfermeiro');
    if (enfermeiroSelect) enfermeiroSelect.value = '';

    const obsTextarea = document.getElementById('livro-observacoes');
    if (obsTextarea) obsTextarea.value = '';

    const previewEl = document.getElementById('livro-preview');
    if (previewEl) previewEl.innerHTML = '<div class="loading-placeholder">Nenhuma escala carregada para visualização.</div>';

    // 4. Re-renderiza todas as seções e listas
    renderLivroSetorSelect();
    renderLivroEnfermeiroSelect();
    renderTecnicosList();
    renderFaltasFolgasList();
    renderPatioList();
    renderCirculanteList();
    renderAvaliacaoList();
    renderLivroEctSelects();
    ensureLivroEditable();
    draft.updateTopbarDraftIndicators();

    ui.showToast('Livro Administrativo limpo com sucesso!', 'info');
  }

  document.getElementById('btn-livro-limpar')?.addEventListener('click', limparLivro);

  // --- Livro Sub-Menu ---
  export function showLivroSubMenu() {

    router.activateWorkspace('livro-submenu', document.getElementById('livro-sub-menu'));
  }

  document.getElementById('btn-livro-lancar')?.addEventListener('click', () => {
    enterLivroMode();
  });

  document.getElementById('btn-livro-imprimir')?.addEventListener('click', () => {
    router.activateWorkspace('print', document.getElementById('workspace-print'));
    const dataInput = document.getElementById('print-data-plantao');
    if (dataInput) dataInput.value = utils.getTodayIsoDate();
    const turnoSelect = document.getElementById('print-turno');
    const setorSelect = document.getElementById('print-setor');
    if (turnoSelect) turnoSelect.value = '';
    if (setorSelect) setorSelect.innerHTML = '<option value="">Todos os setores</option>';
    state.printHtmlBody = null;
    state.printEscalasAll = [];
    state.printEscalasFiltradas = [];
    setTimeout(() => buscarEscalasLiberadas(), 100);
  });

  document.getElementById('btn-livro-voltar')?.addEventListener('click', () => {
    showLivroSubMenu();
  });

  document.getElementById('btn-print-voltar')?.addEventListener('click', () => {
    showLivroSubMenu();
  });

  document.getElementById('btn-print-imprimir')?.addEventListener('click', () => {
    imprimirTodasEscalas();
  });

  document.getElementById('btn-print-buscar')?.addEventListener('click', () => {
    buscarEscalasLiberadas();
  });

  document.getElementById('print-setor')?.addEventListener('change', () => {
    aplicarFiltroSetorImpressao();
  });

  document.getElementById('print-preview')?.addEventListener('click', event => {
    const button = event.target.closest('[data-action="imprimir-escala"]');
    if (!button) return;

    const index = Number(button.dataset.index);
    const escala = state.printEscalasFiltradas[index];
    if (!escala) {
      ui.showToast('Escala não encontrada para impressão', 'warning');
      return;
    }

    imprimirEscalaAssistencial('', buildPrintHtml([escala]));
  });

  export async function buscarEscalasLiberadas() {
    const data = document.getElementById('print-data-plantao')?.value;
    const turno = document.getElementById('print-turno')?.value || '';
    if (!data) {
      ui.showToast('Selecione a data do plantão', 'warning');
      return;
    }

    const btn = document.getElementById('btn-print-buscar');
    const preview = document.getElementById('print-preview');
    const btnImprimir = document.getElementById('btn-print-imprimir');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Buscando...'; }

    try {
      const params = new URLSearchParams({ data });
      if (turno) params.set('turno', turno);
      const res = await api.get(`/api/escala-tecnica/todas?${params.toString()}`);

      if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
        state.printHtmlBody = null;
        state.printEscalasAll = [];
        state.printEscalasFiltradas = [];
        preencherSetoresImpressao([]);
        atualizarResumoImpressao([], data, turno);
        if (preview) preview.innerHTML = renderPrintEmptyState('Nenhuma escala liberada para os filtros informados.');
        if (btnImprimir) btnImprimir.classList.add('d-none');
        return;
      }

      state.printEscalasAll = res.data;
      preencherSetoresImpressao(res.data);
      aplicarFiltroSetorImpressao();
    } catch (e) {
      state.printHtmlBody = null;
      state.printEscalasAll = [];
      state.printEscalasFiltradas = [];
      if (btnImprimir) btnImprimir.classList.add('d-none');
      if (preview) preview.innerHTML = renderPrintEmptyState('Não foi possível carregar as escalas neste momento.', 'bi-exclamation-triangle');
      ui.showToast('Erro ao buscar escalas', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-funnel"></i> Aplicar filtros'; }
    }
  }

  export function preencherSetoresImpressao(escalas) {
    const select = document.getElementById('print-setor');
    if (!select) return;

    const currentValue = select.value;
    const setores = new Map();
    escalas.forEach(escala => {
      const codigo = String(escala.cd_setor_atendimento ?? '');
      if (!codigo) return;
      setores.set(codigo, escala.ds_setor || `Setor ${codigo}`);
    });

    const options = Array.from(setores.entries())
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'))
      .map(([codigo, descricao]) => `<option value="${utils.escapeHtml(codigo)}">${utils.escapeHtml(descricao)}</option>`)
      .join('');

    select.innerHTML = `<option value="">Todos os setores</option>${options}`;
    if (currentValue && setores.has(currentValue)) select.value = currentValue;
  }

  export function aplicarFiltroSetorImpressao() {
    const data = document.getElementById('print-data-plantao')?.value || '';
    const turno = document.getElementById('print-turno')?.value || '';
    const setor = document.getElementById('print-setor')?.value || '';
    const filtradas = setor
      ? state.printEscalasAll.filter(escala => String(escala.cd_setor_atendimento) === setor)
      : [...state.printEscalasAll];

    state.printEscalasFiltradas = filtradas;
    state.printHtmlBody = filtradas.length > 0 ? buildPrintHtml(filtradas) : null;
    renderPrintPreview(filtradas, data, turno);
    atualizarResumoImpressao(filtradas, data, turno);

    document.getElementById('btn-print-imprimir')?.classList.toggle('d-none', filtradas.length === 0);
  }

  export function getPrintEscalaTurno(escala, turnoFallback = '') {
    const turno = String(escala?.payload?.turno || turnoFallback || '').trim().toUpperCase();
    if (turno === 'N' || turno === '2') return { value: 'N', label: 'Noturno' };
    if (turno === 'M' || turno === '1') return { value: 'M', label: 'Diurno' };
    return { value: '', label: 'Turno não informado' };
  }

  export function formatPrintReleaseDate(value) {
    if (!value) return 'Liberação não informada';
    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  export function renderPrintEmptyState(message, icon = 'bi-file-earmark-text') {
    return `<div class="print-empty-state">
      <span><i class="bi ${icon}"></i></span>
      <strong>Nenhuma escala encontrada</strong>
      <p>${utils.escapeHtml(message)}</p>
    </div>`;
  }

  export function atualizarResumoImpressao(escalas, data, turno) {
    const summary = document.getElementById('print-results-summary');
    if (!summary) return;

    const turnoLabel = turno === 'M'
      ? 'Turno diurno'
      : turno === 'N'
        ? 'Turno noturno'
        : 'Todos os turnos';
    const countLabel = escalas.length === 1 ? '1 escala liberada' : `${escalas.length} escalas liberadas`;

    summary.innerHTML = `<div>
      <strong>${countLabel}</strong>
      <span>${utils.escapeHtml(data || '')} · ${turnoLabel}</span>
    </div>`;
  }

  export function renderPrintPreview(escalas, data, turno) {
    const preview = document.getElementById('print-preview');
    if (!preview) return;

    if (!escalas.length) {
      preview.innerHTML = renderPrintEmptyState('Ajuste os filtros para consultar outros registros.');
      return;
    }

    preview.innerHTML = escalas.map((escala, index) => {
      const setor = escala.ds_setor || `Setor ${escala.cd_setor_atendimento}`;
      const escalaTurno = getPrintEscalaTurno(escala, turno);
      const usuario = escala.nm_usuario || 'Usuário não informado';
      const liberacao = utils.formatPrintReleaseDate(escala.dt_liberacao);

      return `<article class="print-scale-card">
        <header class="print-scale-card-header">
          <div class="print-scale-title">
            <span class="print-scale-building"><i class="bi bi-building"></i></span>
            <div>
              <h3>${utils.escapeHtml(setor)}</h3>
              <div class="print-scale-meta">
                <span><i class="bi ${escalaTurno.value === 'N' ? 'bi-moon-stars' : 'bi-sun'}"></i> ${escalaTurno.label}</span>
                <span><i class="bi bi-calendar3"></i> ${utils.escapeHtml(data)}</span>
                <span><i class="bi bi-person-check"></i> ${utils.escapeHtml(usuario)}</span>
                <span><i class="bi bi-clock"></i> ${utils.escapeHtml(liberacao)}</span>
              </div>
            </div>
          </div>
          <div class="print-scale-card-actions">
            <span class="print-release-chip"><i class="bi bi-check-circle-fill"></i> Liberada</span>
            <button class="btn-secondary print-single-button" type="button" data-action="imprimir-escala" data-index="${index}">
              <i class="bi bi-printer"></i> Imprimir
            </button>
          </div>
        </header>
        <div class="print-scale-content">${escala.ds_ocorrencia || ''}</div>
      </article>`;
    }).join('');
  }

  export function buildPrintHtml(escalas) {
    let bodyHtml = '';
    for (let i = 0; i < escalas.length; i++) {
      const esc = escalas[i];
      const isLast = (i === escalas.length - 1);
      bodyHtml += `<div class="escala-print-item" style="${isLast ? '' : 'page-break-after: always;'}">
        <div style="font-weight:700;font-size:1.05rem;color:#0754a6;margin-bottom:0.5rem;border-bottom:2px solid #bfdbfe;padding-bottom:0.3rem;">
          ${utils.escapeHtml(esc.ds_setor || 'Setor ' + esc.cd_setor_atendimento)}
        </div>
        <div>${esc.ds_ocorrencia || ''}</div>
      </div>`;
    }
    return bodyHtml;
  }

  export function imprimirTodasEscalas() {
    if (!state.printHtmlBody) {
      ui.showToast('Nenhuma escala para imprimir', 'warning');
      return;
    }
    imprimirEscalaAssistencial('', state.printHtmlBody);
  }


  export function captureLivroDraft() {
    return {
      dataPlantao: document.getElementById('livro-data-plantao')?.value || '',
      turno: document.querySelector('input[name="livro-turno"]:checked')?.value || 'M',
      setorSelecionado: state.livroSetorSelecionado,
      enfermeiroSelecionado: state.livroEnfermeiroSelecionado,
      observacoes: document.getElementById('livro-observacoes')?.value || '',
      tecnicosSelecionados: draft.cloneDraftValue(state.livroTecnicosSelecionados, []),
      faltasFolgas: draft.cloneDraftValue(state.livroFaltasFolgas, []),
      patio: draft.cloneDraftValue(state.livroPatio, []),
      circulante: draft.cloneDraftValue(state.livroCirculante, []),
      avaliacaoExterna: draft.cloneDraftValue(state.livroAvaliacaoExterna, [])
    };
  }
