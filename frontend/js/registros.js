(() => {
  let pessoaSelecionada = null;
  let tipoRegistroAtual = 'demanda_espontanea';

  const regIds = [
    'registros-sub-menu',
    'workspace-registros-pessoa-busca',
    'workspace-registros-demanda-form'
  ];

  const modeMap = {
    'registros-sub-menu': 'registros-submenu',
    'workspace-registros-pessoa-busca': 'registros-pessoa-busca',
    'workspace-registros-demanda-form': 'registros-demanda-form'
  };

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[match]));
  }
  function isoToday() { return new Date().toISOString().slice(0, 10); }

  function formatarCpf(cpfRaw) {
    if (!cpfRaw) return 'Não informado';
    const c = String(cpfRaw).replace(/\D/g, '');
    if (c.length === 11) {
      return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
    }
    return cpfRaw;
  }

  function formatarDataBR(dataIso) {
    if (!dataIso) return '-';
    const s = String(dataIso).slice(0, 10);
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dataIso;
  }

  function calcularIdade(dtNascIso) {
    if (!dtNascIso) return '-';
    const nasc = new Date(String(dtNascIso).slice(0, 10) + 'T00:00:00');
    if (isNaN(nasc.getTime())) return '-';
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade >= 0 ? `${idade} anos` : '-';
  }

  function formatarSexo(s) {
    if (!s) return 'Não informado';
    const u = String(s).toUpperCase();
    if (u === 'M') return 'Masculino';
    if (u === 'F') return 'Feminino';
    if (u === 'I') return 'Indeterminado';
    return s;
  }

  function formatarTelefoneBR(ddd, tel) {
    const full = (String(ddd || '').trim() + String(tel || '').trim()).replace(/\D/g, '');
    if (!full) return '-';
    if (full.length === 11) {
      return `(${full.slice(0, 2)}) ${full.slice(2, 7)}-${full.slice(7)}`;
    }
    if (full.length === 10) {
      return `(${full.slice(0, 2)}) ${full.slice(2, 6)}-${full.slice(6)}`;
    }
    if (full.length === 9) {
      return `${full.slice(0, 5)}-${full.slice(5)}`;
    }
    if (full.length === 8) {
      return `${full.slice(0, 4)}-${full.slice(4)}`;
    }
    return tel || full;
  }

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

  function hideAll() {
    regIds.forEach(id => byId(id)?.classList.add('d-none'));
  }

  function show(id) {
    const target = byId(id);
    if (!target) return;
    const mode = modeMap[id] || 'registros-submenu';
    if (window.conectaApp && typeof window.conectaApp.activateWorkspace === 'function') {
      window.conectaApp.activateWorkspace(mode, target);
    } else {
      hideAll();
      target.classList.remove('d-none');
    }
    window.scrollTo(0, 0);
  }

  function message(text, type = 'error') {
    return new Promise(resolve => {
      const overlay = byId('modal-overlay');
      if (!overlay) {
        alert(text);
        resolve();
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
        titleEl.textContent = type === 'success' ? 'Sucesso!' : type === 'warning' ? 'Atenção' : 'Aviso';
      }
      if (msgEl) msgEl.textContent = text;

      overlay.classList.remove('d-none');
      document.body.classList.add('modal-open');

      const close = () => {
        overlay.classList.add('d-none');
        document.body.classList.remove('modal-open');
        resolve();
      };
      const closeBtn = byId('modal-close');
      if (closeBtn) closeBtn.onclick = close;
      overlay.onclick = e => { if (e.target === overlay) close(); };
    });
  }

  function clearMessage() {
    const overlay = byId('modal-overlay');
    if (overlay && !overlay.classList.contains('d-none')) {
      overlay.classList.add('d-none');
      document.body.classList.remove('modal-open');
    }
  }

  // --- Navegação Principal do Módulo ---
  function showRegistrosMenu() {
    show('registros-sub-menu');
    clearMessage();
  }

  function abrirBuscaPessoa(tipo = 'demanda_espontanea') {
    tipoRegistroAtual = tipo;
    pessoaSelecionada = null;
    show('workspace-registros-pessoa-busca');
    resetBuscaPessoa();
  }

  function resetBuscaPessoa(limparDraft = false) {
    const termoInput = byId('reg-busca-termo');
    if (termoInput) termoInput.value = '';
    pessoaSelecionada = null;
    byId('reg-busca-feedback')?.classList.add('d-none');
    byId('reg-area-multiplos-resultados')?.classList.add('d-none');
    byId('reg-area-confirmacao-pessoa')?.classList.add('d-none');
    byId('reg-area-nao-encontrado')?.classList.add('d-none');
    fecharModalConferenciaPessoa();
    if (limparDraft && typeof window.conectaApp?.clearModuleDraft === 'function') {
      window.conectaApp.clearModuleDraft('registros');
    }
  }

  // --- Busca de Pessoas ---
  async function executarBuscaPessoa() {
    const termo = byId('reg-busca-termo')?.value?.trim() || '';
    const btn = byId('btn-reg-buscar-pessoa');

    if (!termo || termo.length < 2) {
      message('Informe ao menos 2 caracteres do CPF, Nome ou Código para realizar a busca.', 'warning');
      byId('reg-busca-termo')?.focus();
      return;
    }

    byId('reg-area-multiplos-resultados')?.classList.add('d-none');
    byId('reg-area-confirmacao-pessoa')?.classList.add('d-none');
    byId('reg-area-nao-encontrado')?.classList.add('d-none');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Buscando...';
    }

    try {
      const url = `/api/registros/pessoas?termo=${encodeURIComponent(termo)}&_=${Date.now()}`;
      const res = await request(url);
      const pessoas = res.data || [];

      if (pessoas.length === 0) {
        byId('reg-area-nao-encontrado')?.classList.remove('d-none');
      } else {
        renderizarMultiplosResultados(pessoas);
      }
    } catch (err) {
      message(err.message || 'Erro ao consultar pessoa.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-search"></i> Buscar';
      }
    }
  }

  function renderizarMultiplosResultados(pessoas) {
    const container = byId('reg-lista-candidatos');
    const qtdEl = byId('reg-qtd-encontrados');
    if (qtdEl) qtdEl.textContent = pessoas.length;
    if (!container) return;

    container.innerHTML = pessoas.map(p => {
      const nome = escapeHtml(p.NM_PESSOA_FISICA || '-');
      const cpf = formatarCpf(p.NR_CPF);
      const dtnasc = formatarDataBR(p.DT_NASCIMENTO);
      const idade = calcularIdade(p.DT_NASCIMENTO);
      const sexo = formatarSexo(p.IE_SEXO);
      const telefone = formatarTelefoneBR(p.NR_DDD_CELULAR, p.NR_TELEFONE_CELULAR);
      return `<div class="auditoria-paciente-card" data-cd="${escapeHtml(p.CD_PESSOA_FISICA)}" style="cursor: pointer;">
        <div class="auditoria-paciente-card-head">
          <div class="auditoria-paciente-name">${nome}</div>
          <span class="auditoria-badge-leito" style="background: #0284c7;"><i class="bi bi-person"></i> ${sexo}</span>
        </div>
        <div class="auditoria-paciente-meta-tags">
          <span class="auditoria-meta-tag"><i class="bi bi-person-badge"></i> CPF: ${cpf}</span>
          <span class="auditoria-meta-tag"><i class="bi bi-calendar3"></i> ${dtnasc} (${idade})</span>
          ${telefone !== '-' ? `<span class="auditoria-meta-tag"><i class="bi bi-telephone"></i> ${telefone}</span>` : ''}
        </div>
        <div class="auditoria-paciente-card-foot">
          <span><i class="bi bi-eye"></i> Conferir Dados e Histórico</span>
          <i class="bi bi-arrow-right"></i>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.auditoria-paciente-card').forEach((card, idx) => {
      card.addEventListener('click', () => {
        abrirModalConferenciaPessoa(pessoas[idx]);
      });
    });

    byId('reg-area-multiplos-resultados')?.classList.remove('d-none');
    byId('reg-area-multiplos-resultados')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let historicoPessoaAtual = [];

  async function carregarHistoricoPessoa(cdPessoaFisica) {
    const container = byId('reg-lista-demandas-anteriores');
    const countEl = byId('reg-count-demandas-anteriores');

    historicoPessoaAtual = [];
    if (container) container.innerHTML = '<div class="loading-placeholder"><i class="bi bi-arrow-repeat spin"></i> Carregando demandas anteriores...</div>';

    try {
      const res = await request(`/api/registros/historico?cdPessoaFisica=${encodeURIComponent(cdPessoaFisica)}&_=${Date.now()}`);
      const historico = res.data || [];
      historicoPessoaAtual = historico;

      if (countEl) countEl.textContent = historico.length;

      if (historico.length === 0) {
        if (container) {
          container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--slate-400);">
              <i class="bi bi-journal-x" style="font-size: 2.2rem; opacity: 0.6;"></i>
              <p style="margin: 0.6rem 0 0; font-size: 0.9rem; font-weight: 600; color: var(--slate-600);">Nenhum registro anterior</p>
              <small style="color: var(--slate-400);">Esta pessoa ainda não possui demandas gravadas no TASY.</small>
            </div>`;
        }
        return;
      }

      if (container) {
        container.innerHTML = historico.map(item => `
          <div class="auditoria-history-card" style="background: #ffffff; border: 1px solid var(--slate-200); border-radius: 12px; padding: 1rem 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="auditoria-badge-leito" style="background: #0284c7;"><i class="bi bi-journal-text"></i> ${escapeHtml(item.DS_TIPO_HISTORICO || 'Demanda Espontânea')}</span>
                <span style="font-size: 0.85rem; color: var(--slate-600);"><i class="bi bi-calendar3"></i> Data: <strong>${formatarDataBR(item.DT_INICIAL || item.DT_ATUALIZACAO)}</strong></span>
              </div>
              <span style="font-size: 0.82rem; color: var(--slate-500);"><i class="bi bi-person"></i> Responsável: <strong>${escapeHtml(item.NM_USUARIO || '-')}</strong></span>
            </div>
            <div style="font-size: 0.9rem; color: var(--slate-700); line-height: 1.5; white-space: pre-wrap; background: var(--slate-50); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--slate-100);">
              ${escapeHtml(item.DS_HISTORICO || '-')}
            </div>
          </div>
        `).join('');
      }
    } catch (_) {
      if (container) {
        container.innerHTML = '<p class="text-danger text-center py-3" style="font-size: 0.88rem; margin: 0;">Não foi possível carregar o histórico anterior.</p>';
      }
    }
  }

  function abrirModalConferenciaPessoa(pessoa) {
    pessoaSelecionada = pessoa;
    const modal = byId('modal-registros-conferencia-pessoa');
    if (!modal) return;

    const telFormatted = formatarTelefoneBR(pessoa.NR_DDD_CELULAR, pessoa.NR_TELEFONE_CELULAR);

    byId('reg-conf-nome').value = pessoa.NM_PESSOA_FISICA || '';
    byId('reg-conf-cpf').value = formatarCpf(pessoa.NR_CPF) !== '-' ? formatarCpf(pessoa.NR_CPF) : '';
    byId('reg-conf-nascimento').value = pessoa.DT_NASCIMENTO ? String(pessoa.DT_NASCIMENTO).slice(0, 10) : '';
    byId('reg-conf-sexo').value = pessoa.IE_SEXO || '';
    byId('reg-conf-telefone').value = telFormatted !== '-' ? telFormatted : '';
    byId('reg-conf-codigo').value = pessoa.CD_PESSOA_FISICA || '-';

    if (pessoa.CD_PESSOA_FISICA) {
      carregarHistoricoPessoa(pessoa.CD_PESSOA_FISICA);
    }

    modal.classList.remove('d-none');
    document.body.classList.add('modal-open');
    window.conectaApp?.markModuleDraftDirty?.('registros');
  }

  function fecharModalConferenciaPessoa() {
    const modal = byId('modal-registros-conferencia-pessoa');
    if (modal) {
      modal.classList.add('d-none');
      document.body.classList.remove('modal-open');
    }
  }

  async function confirmarEIniciarRegistro() {
    if (!pessoaSelecionada) return;

    const btn = byId('btn-modal-reg-conferencia-confirmar');
    const nome = byId('reg-conf-nome')?.value?.trim();
    const cpf = byId('reg-conf-cpf')?.value?.trim();
    const dtNasc = byId('reg-conf-nascimento')?.value;
    const sexo = byId('reg-conf-sexo')?.value;
    const telefone = byId('reg-conf-telefone')?.value?.trim();

    if (!nome) {
      message('O nome da pessoa não pode ficar em branco.', 'warning');
      byId('reg-conf-nome')?.focus();
      return;
    }

    // Compara se houve alteração nos dados cadastrais
    const cpfOrig = pessoaSelecionada.NR_CPF ? String(pessoaSelecionada.NR_CPF).replace(/\D/g, '') : '';
    const cpfNovo = cpf ? String(cpf).replace(/\D/g, '') : '';
    const dtNascOrig = pessoaSelecionada.DT_NASCIMENTO ? String(pessoaSelecionada.DT_NASCIMENTO).slice(0, 10) : '';
    const telOrig = formatarTelefoneBR(pessoaSelecionada.NR_DDD_CELULAR, pessoaSelecionada.NR_TELEFONE_CELULAR);

    const houveAlteracao = (
      nome !== (pessoaSelecionada.NM_PESSOA_FISICA || '').trim() ||
      cpfNovo !== cpfOrig ||
      (dtNasc || '') !== dtNascOrig ||
      (sexo || '') !== (pessoaSelecionada.IE_SEXO || '') ||
      (telefone || '') !== (telOrig !== '-' ? telOrig : '')
    );

    if (houveAlteracao) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Atualizando TASY...';
      }
      try {
        const res = await request(`/api/registros/pessoas/${encodeURIComponent(pessoaSelecionada.CD_PESSOA_FISICA)}`, {
          method: 'PUT',
          body: JSON.stringify({
            nm_pessoa_fisica: nome,
            nr_cpf: cpfNovo || null,
            dt_nascimento: dtNasc || null,
            ie_sexo: sexo || null,
            nr_telefone_celular: telefone || null
          })
        });
        if (res.data) {
          pessoaSelecionada = res.data;
        }
      } catch (err) {
        message(err.message || 'Erro ao atualizar dados cadastrais no TASY.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirmar Pessoa e Iniciar Registro';
        }
        return;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirmar Pessoa e Iniciar Registro';
        }
      }
    }

    fecharModalConferenciaPessoa();
    avancarParaFormularioRegistro(pessoaSelecionada);
  }

  // --- Modal de Cadastro Rápido de Pessoa ---
  function abrirModalCadastroPessoa() {
    const modal = byId('modal-registros-cadastrar-pessoa');
    if (!modal) return;

    byId('form-registros-cadastrar-pessoa')?.reset();
    byId('modal-cad-pessoa-feedback')?.classList.add('d-none');

    const termo = byId('reg-busca-termo')?.value?.trim();
    if (termo) {
      const digitsOnly = termo.replace(/\D/g, '');
      if (digitsOnly.length >= 11 || (/^\d+$/.test(termo.replace(/[\.\-\/\s]/g, '')) && digitsOnly.length > 6)) {
        byId('cad-pessoa-cpf').value = termo;
      } else {
        byId('cad-pessoa-nome').value = termo;
      }
    }

    modal.classList.remove('d-none');
    document.body.classList.add('modal-open');
    byId('cad-pessoa-nome')?.focus();
  }

  function fecharModalCadastroPessoa() {
    const modal = byId('modal-registros-cadastrar-pessoa');
    if (modal) {
      modal.classList.add('d-none');
      document.body.classList.remove('modal-open');
    }
  }

  async function salvarCadastroPessoa(e) {
    e.preventDefault();
    const btn = byId('btn-modal-reg-cadastrar-salvar');
    const nome = byId('cad-pessoa-nome')?.value?.trim();
    const cpf = byId('cad-pessoa-cpf')?.value?.trim();
    const dtNasc = byId('cad-pessoa-nascimento')?.value;
    const sexo = byId('cad-pessoa-sexo')?.value;
    const telefone = byId('cad-pessoa-telefone')?.value?.trim();
    const observacao = byId('cad-pessoa-observacao')?.value?.trim();

    if (!nome) {
      message('O nome completo da pessoa é obrigatório.', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
    }

    try {
      const res = await request('/api/registros/pessoas', {
        method: 'POST',
        body: JSON.stringify({
          nm_pessoa_fisica: nome,
          nr_cpf: cpf,
          dt_nascimento: dtNasc || null,
          ie_sexo: sexo || null,
          nr_telefone_celular: telefone || null,
          ds_observacao: observacao || null
        })
      });

      fecharModalCadastroPessoa();
      await message('Pessoa física cadastrada com sucesso!', 'success');
      if (res.data) {
        avancarParaFormularioRegistro(res.data);
      }
    } catch (err) {
      message(err.message || 'Erro ao cadastrar pessoa física.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-circle"></i> Salvar e Prosseguir';
      }
    }
  }

  // --- Formulário Nova Demanda Espontânea ---
  function avancarParaFormularioRegistro(pessoa = pessoaSelecionada) {
    if (!pessoa) {
      message('Nenhuma pessoa foi selecionada.', 'warning');
      return;
    }
    pessoaSelecionada = pessoa;

    const telFormatted = formatarTelefoneBR(pessoa.NR_DDD_CELULAR, pessoa.NR_TELEFONE_CELULAR);

    byId('reg-form-nome').value = pessoa.NM_PESSOA_FISICA || '-';
    byId('reg-form-cpf').value = formatarCpf(pessoa.NR_CPF);
    byId('reg-form-nascimento').value = pessoa.DT_NASCIMENTO ? String(pessoa.DT_NASCIMENTO).slice(0, 10) : '';
    byId('reg-form-idade').value = calcularIdade(pessoa.DT_NASCIMENTO);
    byId('reg-form-telefone').value = telFormatted !== '-' ? telFormatted : (pessoa.NR_TELEFONE_CELULAR || '-');
    byId('reg-form-cd-pessoa').value = pessoa.CD_PESSOA_FISICA || '';

    // Data padrão: hoje
    if (!byId('reg-form-data').value) {
      byId('reg-form-data').value = isoToday();
    }

    show('workspace-registros-demanda-form');
    byId('reg-form-historico')?.focus();
  }

  function limparFormRegistro() {
    if (byId('reg-form-nome')) byId('reg-form-nome').value = '';
    if (byId('reg-form-cpf')) byId('reg-form-cpf').value = '';
    if (byId('reg-form-nascimento')) byId('reg-form-nascimento').value = '';
    if (byId('reg-form-idade')) byId('reg-form-idade').value = '';
    if (byId('reg-form-telefone')) byId('reg-form-telefone').value = '';
    if (byId('reg-form-cd-pessoa')) byId('reg-form-cd-pessoa').value = '';
    if (byId('reg-form-data')) byId('reg-form-data').value = isoToday();
    if (byId('reg-form-historico')) byId('reg-form-historico').value = '';
    pessoaSelecionada = null;
    resetBuscaPessoa(false);
    if (typeof window.conectaApp?.clearModuleDraft === 'function') {
      window.conectaApp.clearModuleDraft('registros');
    }
  }

  async function salvarDemandaEspontanea() {
    const cdPessoa = byId('reg-form-cd-pessoa')?.value || pessoaSelecionada?.CD_PESSOA_FISICA;
    const dtRegistro = byId('reg-form-data')?.value;
    const dsHistorico = byId('reg-form-historico')?.value?.trim();
    const btn = byId('btn-registros-salvar');

    if (!cdPessoa) {
      message('Pessoa não identificada. Retorne à busca para selecionar o cidadão.', 'warning');
      return;
    }
    if (!dtRegistro) {
      message('Informe a data do registro.', 'warning');
      byId('reg-form-data')?.focus();
      return;
    }
    if (!dsHistorico) {
      message('O histórico do registro é obrigatório.', 'warning');
      byId('reg-form-historico')?.focus();
      return;
    }

    // Bloqueia botão contra duplo clique
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';
    }

    try {
      const payload = {
        cd_pessoa_fisica: cdPessoa,
        tipo_id: tipoRegistroAtual || 'demanda_espontanea',
        dt_registro: dtRegistro,
        ds_historico: dsHistorico
      };

      const res = await request('/api/registros', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Limpa draft em memória/storage
      if (typeof window.conectaApp?.clearModuleDraft === 'function') {
        window.conectaApp.clearModuleDraft('registros');
      }

      limparFormRegistro();
      await message('Demanda Espontânea gravada com sucesso no TASY!', 'success');
      showRegistrosMenu();
    } catch (err) {
      message(err.message || 'Erro ao salvar registro de demanda espontânea.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar Registro';
      }
    }
  }

  // --- Sistema de Draft / Cache ---
  function captureRegistrosDraft() {
    const activeScreen = regIds.find(id => !byId(id)?.classList.contains('d-none'));
    if (!activeScreen || activeScreen === 'registros-sub-menu') return null;

    const hist = byId('reg-form-historico')?.value?.trim();
    const termo = byId('reg-busca-termo')?.value?.trim();
    const cdPessoa = byId('reg-form-cd-pessoa')?.value || pessoaSelecionada?.CD_PESSOA_FISICA;

    // Se estiver na busca mas não digitou nada e não selecionou pessoa, não há rascunho
    if (activeScreen === 'workspace-registros-pessoa-busca' && !pessoaSelecionada && !termo) {
      return null;
    }

    return {
      activeScreen,
      tipoRegistroAtual: tipoRegistroAtual || 'demanda_espontanea',
      pessoaSelecionada,
      busca: {
        termo: byId('reg-busca-termo')?.value || ''
      },
      form: {
        cd_pessoa_fisica: byId('reg-form-cd-pessoa')?.value || pessoaSelecionada?.CD_PESSOA_FISICA || '',
        nome: byId('reg-form-nome')?.value || pessoaSelecionada?.NM_PESSOA_FISICA || '',
        cpf: byId('reg-form-cpf')?.value || pessoaSelecionada?.NR_CPF || '',
        dt_nascimento: byId('reg-form-nascimento')?.value || pessoaSelecionada?.DT_NASCIMENTO || '',
        idade: byId('reg-form-idade')?.value || '',
        telefone: byId('reg-form-telefone')?.value || pessoaSelecionada?.NR_TELEFONE_CELULAR || '',
        dt_registro: byId('reg-form-data')?.value || isoToday(),
        ds_historico: byId('reg-form-historico')?.value || ''
      }
    };
  }

  function hydrateRegistrosDraft(draft) {
    if (!draft || !draft.activeScreen) {
      showRegistrosMenu();
      return;
    }

    tipoRegistroAtual = draft.tipoRegistroAtual || 'demanda_espontanea';
    pessoaSelecionada = draft.pessoaSelecionada || null;

    if (draft.activeScreen === 'workspace-registros-demanda-form') {
      if (draft.form) {
        const f = draft.form;
        if (byId('reg-form-cd-pessoa')) byId('reg-form-cd-pessoa').value = f.cd_pessoa_fisica || '';
        if (byId('reg-form-nome')) byId('reg-form-nome').value = f.nome || '';
        if (byId('reg-form-cpf')) byId('reg-form-cpf').value = f.cpf || '';
        if (byId('reg-form-nascimento')) byId('reg-form-nascimento').value = f.dt_nascimento || '';
        if (byId('reg-form-idade')) byId('reg-form-idade').value = f.idade || '';
        if (byId('reg-form-telefone')) byId('reg-form-telefone').value = f.telefone || '';
        if (byId('reg-form-data')) byId('reg-form-data').value = f.dt_registro || isoToday();
        if (byId('reg-form-historico')) byId('reg-form-historico').value = f.ds_historico || '';
      }
      show('workspace-registros-demanda-form');
      if (pessoaSelecionada?.CD_PESSOA_FISICA) {
        carregarHistoricoPessoa(pessoaSelecionada.CD_PESSOA_FISICA);
      }
    } else if (draft.activeScreen === 'workspace-registros-pessoa-busca') {
      show('workspace-registros-pessoa-busca');
      if (draft.busca) {
        if (byId('reg-busca-termo')) byId('reg-busca-termo').value = draft.busca.termo || '';
      }
      if (pessoaSelecionada) {
        selecionarPessoaParaConfirmacao(pessoaSelecionada);
      }
    } else {
      show('registros-sub-menu');
    }
  }

  window.showRegistrosMenu = showRegistrosMenu;
  window.clearRegistrosForm = limparFormRegistro;
  window.captureRegistrosDraft = captureRegistrosDraft;
  window.hydrateRegistrosDraft = hydrateRegistrosDraft;

  // --- Atualização de Acesso (Visibilidade de Botões) ---
  async function refreshAccess() {
    try {
      const [me, modules] = await Promise.all([request('/api/me'), request('/api/modulos')]);
      const perfil = me.data?.perfilAtivo || me.data?.usuario?.perfilAtivo;
      const module = (modules.data || []).find(item => item.id === 'registros');
      const allowed = Boolean(module?.perfisPermitidos?.map(String).includes(String(perfil)));
      byId('btn-abrir-registros')?.classList.toggle('d-none', !allowed);
      byId('nav-registros')?.classList.toggle('d-none', !allowed);

      // Permissões específicas de Registros
      const permissoesAtivas = me.data?.permissoesAtivas?.registros || [];
      const podeDemanda = allowed && (permissoesAtivas.includes('lancar_demanda_espontanea') || perfil === 'admin');
      byId('btn-registro-tipo-demanda')?.classList.toggle('d-none', !podeDemanda);
    } catch (_) {
      byId('btn-abrir-registros')?.classList.add('d-none');
      byId('nav-registros')?.classList.add('d-none');
    }
  }

  // --- Event Listeners ---
  byId('btn-abrir-registros')?.addEventListener('click', () => {
    const draft = window.conectaApp?.getModuleDraft?.('registros');
    if (draft?.activeScreen && typeof hydrateRegistrosDraft === 'function') {
      hydrateRegistrosDraft(draft);
    } else {
      showRegistrosMenu();
    }
  });
  byId('btn-registros-voltar-home')?.addEventListener('click', () => {
    if (window.conectaApp?.showModeChooser) {
      window.conectaApp.showModeChooser();
    } else {
      hideAll();
      byId('mode-selector')?.classList.remove('d-none');
    }
  });

  byId('btn-registro-tipo-demanda')?.addEventListener('click', () => abrirBuscaPessoa('demanda_espontanea'));
  byId('btn-registros-busca-voltar')?.addEventListener('click', () => {
    resetBuscaPessoa(true);
    showRegistrosMenu();
  });
  byId('btn-reg-buscar-pessoa')?.addEventListener('click', executarBuscaPessoa);
  byId('reg-busca-termo')?.addEventListener('keydown', e => { if (e.key === 'Enter') executarBuscaPessoa(); });
  byId('btn-reg-limpar-busca')?.addEventListener('click', () => {
    resetBuscaPessoa(true);
    byId('reg-busca-termo')?.focus();
  });

  byId('btn-reg-trocar-pessoa')?.addEventListener('click', () => {
    pessoaSelecionada = null;
    byId('reg-area-confirmacao-pessoa')?.classList.add('d-none');
    if (typeof window.conectaApp?.clearModuleDraft === 'function') {
      window.conectaApp.clearModuleDraft('registros');
    }
    byId('reg-busca-termo')?.focus();
  });

  byId('btn-reg-abrir-cadastro-pessoa')?.addEventListener('click', abrirModalCadastroPessoa);
  byId('btn-reg-novo-cadastro-header')?.addEventListener('click', abrirModalCadastroPessoa);
  byId('btn-modal-reg-cadastrar-fechar')?.addEventListener('click', fecharModalCadastroPessoa);
  byId('btn-modal-reg-cadastrar-cancelar')?.addEventListener('click', fecharModalCadastroPessoa);
  byId('form-registros-cadastrar-pessoa')?.addEventListener('submit', salvarCadastroPessoa);

  // Modal de Conferência de Dados e Histórico da Pessoa
  byId('btn-modal-reg-conferencia-fechar')?.addEventListener('click', fecharModalConferenciaPessoa);
  byId('btn-modal-reg-conferencia-voltar')?.addEventListener('click', fecharModalConferenciaPessoa);
  byId('btn-modal-reg-conferencia-confirmar')?.addEventListener('click', confirmarEIniciarRegistro);

  function abrirModalHistoricoForm() {
    const modal = byId('modal-registros-historico');
    const container = byId('modal-reg-historico-conteudo');
    if (!modal || !container) return;

    if (historicoPessoaAtual.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--slate-500);"><i class="bi bi-journal-x" style="font-size: 2rem;"></i><p style="margin-top: 0.5rem;">Nenhum registro anterior encontrado para esta pessoa no TASY.</p></div>';
    } else {
      container.innerHTML = historicoPessoaAtual.map(item => `
        <div class="auditoria-history-card" style="background: #ffffff; border: 1px solid var(--slate-200); border-radius: 12px; padding: 1rem 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="auditoria-badge-leito" style="background: #0284c7;"><i class="bi bi-journal-text"></i> ${escapeHtml(item.DS_TIPO_HISTORICO || 'Demanda Espontânea')}</span>
              <span style="font-size: 0.85rem; color: var(--slate-600);"><i class="bi bi-calendar3"></i> Data: <strong>${formatarDataBR(item.DT_INICIAL || item.DT_ATUALIZACAO)}</strong></span>
            </div>
            <span style="font-size: 0.82rem; color: var(--slate-500);"><i class="bi bi-person"></i> Responsável: <strong>${escapeHtml(item.NM_USUARIO || '-')}</strong></span>
          </div>
          <div style="font-size: 0.9rem; color: var(--slate-700); line-height: 1.5; white-space: pre-wrap; background: var(--slate-50); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--slate-100);">
            ${escapeHtml(item.DS_HISTORICO || '-')}
          </div>
        </div>
      `).join('');
    }

    modal.classList.remove('d-none');
    document.body.classList.add('modal-open');
  }

  function fecharModalHistoricoForm() {
    const modal = byId('modal-registros-historico');
    if (modal) {
      modal.classList.add('d-none');
      document.body.classList.remove('modal-open');
    }
  }

  byId('btn-registros-form-voltar')?.addEventListener('click', () => {
    show('workspace-registros-pessoa-busca');
  });
  byId('btn-registros-cancelar')?.addEventListener('click', () => {
    limparFormRegistro();
    showRegistrosMenu();
  });
  byId('btn-registros-ver-historico')?.addEventListener('click', abrirModalHistoricoForm);
  byId('btn-modal-reg-historico-fechar')?.addEventListener('click', fecharModalHistoricoForm);
  byId('btn-modal-reg-historico-fechar-btn')?.addEventListener('click', fecharModalHistoricoForm);
  byId('btn-registros-salvar')?.addEventListener('click', salvarDemandaEspontanea);

  // Monitora alterações nos formulários para marcar draft como sujo (amarelinho no topbar)
  const regBusca = byId('workspace-registros-pessoa-busca');
  if (regBusca) {
    regBusca.addEventListener('input', () => window.conectaApp?.markModuleDraftDirty?.('registros'));
    regBusca.addEventListener('change', () => window.conectaApp?.markModuleDraftDirty?.('registros'));
  }
  const regForm = byId('workspace-registros-demanda-form');
  if (regForm) {
    regForm.addEventListener('input', () => window.conectaApp?.markModuleDraftDirty?.('registros'));
    regForm.addEventListener('change', () => window.conectaApp?.markModuleDraftDirty?.('registros'));
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.id.includes('registro') || button.id === 'btn-abrir-registros' || button.id === 'nav-registros') return;
    if (button.closest('#topbar-nav') || button.closest('.mode-grid') || button.id === 'topbar-brand') {
      regIds.forEach(id => byId(id)?.classList.add('d-none'));
    }
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#user-profile-menu')) setTimeout(refreshAccess, 250);
  });

  setTimeout(refreshAccess, 250);
})();
