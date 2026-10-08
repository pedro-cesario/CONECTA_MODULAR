export class TriagemPaUI {
  constructor(api, ui) {
    this.api = api;
    this.ui = ui;
    this.senhaAtiva = null;
    this.pacienteSelecionado = null;
    
    this.initListeners();
  }

  initListeners() {
    // 1. Search Debounce
    const searchInput = document.getElementById('triagem-modal-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 500));
    }

    // 2. Navigation
    document.getElementById('btn-triagem-show-cadastro')?.addEventListener('click', () => this.showStep('cadastro'));
    document.getElementById('btn-triagem-back-busca')?.addEventListener('click', () => this.showStep('busca'));
    document.getElementById('btn-triagem-back-busca-conf')?.addEventListener('click', () => this.showStep('busca'));
    
    // 3. Actions
    document.getElementById('btn-triagem-salvar-paciente')?.addEventListener('click', this.salvarNovoPaciente.bind(this));
    document.getElementById('btn-triagem-confirmar-inicio')?.addEventListener('click', this.iniciarTriagem.bind(this));

    // Nao Identificado
    document.getElementById('btn-triagem-nao-identificado')?.addEventListener('click', this.iniciarNaoIdentificado.bind(this));
  }

  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  abrirModalParaSenha(senha) {
    this.senhaAtiva = senha;
    this.pacienteSelecionado = null;
    
    // Reset modal
    const searchInput = document.getElementById('triagem-modal-search-input');
    if (searchInput) searchInput.value = '';
    document.getElementById('triagem-modal-search-results').innerHTML = '';
    
    this.showStep('busca');
    
    const badge = document.getElementById('triagem-modal-senha-badge');
    if (badge) {
      badge.textContent = `Senha: ${senha.senhaVisual || senha.nrSeq}`;
    }

    // Usando global bootstrap se disponivel
    const modalEl = document.getElementById('modal-triagem-identificacao');
    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  showStep(stepName) {
    const steps = ['busca', 'cadastro', 'confirmacao'];
    steps.forEach(s => {
      const el = document.getElementById(`triagem-modal-step-${s}`);
      if (el) {
        if (s === stepName) el.classList.remove('d-none');
        else el.classList.add('d-none');
      }
    });

    const btnConfirmar = document.getElementById('btn-triagem-confirmar-inicio');
    if (btnConfirmar) {
      if (stepName === 'confirmacao') btnConfirmar.classList.remove('d-none');
      else btnConfirmar.classList.add('d-none');
    }
  }

  async handleSearch(e) {
    const q = e.target.value.trim();
    const resultsContainer = document.getElementById('triagem-modal-search-results');
    
    if (q.length < 3 && !q.replace(/\\D/g, '').length === 11) {
      resultsContainer.innerHTML = '<div class="text-muted small p-2">Digite ao menos 3 caracteres, uma data ou CPF.</div>';
      return;
    }

    resultsContainer.innerHTML = '<div class="text-muted small p-2">Buscando...</div>';

    try {
      const res = await this.api.get(`/api/triagem-pa/buscar?q=${encodeURIComponent(q)}`);
      if (!res || res.length === 0) {
        resultsContainer.innerHTML = '<div class="text-muted small p-2">Nenhum paciente encontrado.</div>';
        return;
      }

      resultsContainer.innerHTML = '';
      res.forEach(p => {
        const div = document.createElement('div');
        div.className = 'border p-2 rounded mb-2 search-result-item d-flex justify-content-between align-items-center';
        div.style.cursor = 'pointer';
        div.innerHTML = `
          <div>
            <div class="fw-bold">${p.nm_pessoa_fisica}</div>
            <div class="small text-muted">
              Nasc: ${p.dt_nascimento ? new Date(p.dt_nascimento).toLocaleDateString() : 'N/A'} | 
              CPF: ${p.nr_cpf ? p.nr_cpf.replace(/(\\d{3})(\\d{3})(\\d{3})(\\d{2})/, '$1.$2.$3-$4') : 'N/I'} |
              Prontuário: ${p.cd_pessoa_fisica}
            </div>
          </div>
          <button class="btn btn-sm btn-outline-success">Selecionar</button>
        `;
        div.addEventListener('click', () => this.selecionarPaciente(p));
        resultsContainer.appendChild(div);
      });
    } catch (err) {
      resultsContainer.innerHTML = '<div class="text-danger small p-2">Erro ao buscar pacientes.</div>';
    }
  }

  selecionarPaciente(paciente) {
    this.pacienteSelecionado = paciente;
    
    const details = document.getElementById('triagem-confirm-details');
    if (details) {
      details.innerHTML = `
        <h5 class="text-primary">${paciente.nm_pessoa_fisica}</h5>
        <div class="row mt-3">
          <div class="col-md-6">
            <strong>Data Nasc.:</strong> ${paciente.dt_nascimento ? new Date(paciente.dt_nascimento).toLocaleDateString() : '-'}
          </div>
          <div class="col-md-6">
            <strong>CPF:</strong> ${paciente.nr_cpf || '-'}
          </div>
          <div class="col-md-6 mt-2">
            <strong>Prontuário:</strong> ${paciente.cd_pessoa_fisica}
          </div>
        </div>
        
        <div class="mt-4 border-top pt-3">
          <label class="form-label fw-bold">Condição de Identificação</label>
          <select class="form-select" id="triagem-condicao-ident">
            <option value="identificado">Identificado (Documento Apresentado)</option>
            <option value="sem_doc">Não apresentou documento (Referido)</option>
          </select>
        </div>
      `;
    }

    this.showStep('confirmacao');
  }

  async salvarNovoPaciente() {
    const btn = document.getElementById('btn-triagem-salvar-paciente');
    const nome = document.getElementById('triagem-form-nome').value.trim();
    const cpf = document.getElementById('triagem-form-cpf').value.trim();
    const nasc = document.getElementById('triagem-form-nascimento').value;

    if (!nome || !cpf || !nasc) {
      this.ui.showToast('Nome completo, CPF e data de nascimento são obrigatórios', 'error');
      return;
    }

    this.ui.setLoading(btn, true);
    try {
      const payload = {
        nm_pessoa_fisica: nome,
        dt_nascimento: nasc,
        nr_cpf: cpf.replace(/\D/g, '')
      };

      const res = await this.api.post('/api/triagem-pa/pacientes', payload);
      
      this.ui.showToast('Paciente cadastrado com sucesso!', 'success');
      
      // Auto selecionar
      this.selecionarPaciente({
        cd_pessoa_fisica: res.cd_pessoa_fisica,
        nm_pessoa_fisica: nome,
        dt_nascimento: nasc,
        nr_cpf: cpf
      });
    } catch (err) {
      const duplicado = err.status === 409 && err.data?.error?.details?.duplicados?.[0];
      if (duplicado) {
        this.ui.showToast('CPF já cadastrado. Use o cadastro existente para continuar.', 'warning');
        this.selecionarPaciente(duplicado);
        return;
      }
      this.ui.showToast(err.message || 'Erro ao cadastrar', 'error');
    } finally {
      this.ui.setLoading(btn, false);
    }
  }

  async iniciarNaoIdentificado() {
    try {
      this.ui.showToast('Iniciando atendimento...', 'info');
      const res = await this.api.post('/api/triagem-pa/iniciar', {
        nrSeqPacSenhaFila: this.senhaAtiva?.nrSeq || null,
        condicaoIdentificacao: 'NAO_IDENTIFICADO'
      });
      if (!res?.nr_atendimento || !res?.cd_pessoa_fisica) {
        throw new Error(res?.message || 'Não foi possível iniciar a triagem.');
      }
      this.pacienteSelecionado = { cd_pessoa_fisica: res.cd_pessoa_fisica };
      this.ui.showToast(`Triagem iniciada! Atendimento: ${res.nr_atendimento}`, 'success');
    } catch (err) {
      this.ui.showToast(err.message || 'Erro ao gerar paciente não identificado', 'error');
    }
  }

  async iniciarTriagem() {
    if (!this.pacienteSelecionado) return;

    const btn = document.getElementById('btn-triagem-confirmar-inicio');
    this.ui.setLoading(btn, true);

    try {
      const condicaoEl = document.getElementById('triagem-condicao-ident');
      const condicaoSelecionada = this.pacienteSelecionado.condicao || (condicaoEl ? condicaoEl.value : 'identificado');
      const condicao = {
        identificado: 'IDENTIFICADO',
        sem_doc: 'NAO_APRESENTOU_IDENTIFICACAO',
        nao_identificado: 'NAO_IDENTIFICADO'
      }[condicaoSelecionada] || condicaoSelecionada;

      const payload = {
        cdPessoaFisica: this.pacienteSelecionado.cd_pessoa_fisica,
        nrSeqPacSenhaFila: this.senhaAtiva?.nrSeq || null,
        condicaoIdentificacao: condicao
      };

      const res = await this.api.post('/api/triagem-pa/iniciar', payload);

      this.ui.showToast(`Triagem Iniciada! Atendimento: ${res.nr_atendimento}`, 'success');
      
      const modalEl = document.getElementById('modal-triagem-identificacao');
      if (modalEl && window.bootstrap) {
        bootstrap.Modal.getInstance(modalEl).hide();
      }
      
      // Update the UI card status if necessary, or let polling handle it
      if (window.conectaCore && window.conectaCore.carregarSenhasTriagem) {
        window.conectaCore.carregarSenhasTriagem(false);
      }

    } catch (err) {
      this.ui.showToast(err.message || 'Erro ao iniciar triagem', 'error');
    } finally {
      this.ui.setLoading(btn, false);
    }
  }
}
