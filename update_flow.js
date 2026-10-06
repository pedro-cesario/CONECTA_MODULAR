const fs = require('fs');
const file = 'frontend/src/modules/dashboard/dashboard.js';
let content = fs.readFileSync(file, 'utf8');

// Adicionar nome da mae na busca
content = content.replace(
  /const cdPf = p\.CD_PESSOA_FISICA \|\| '';/,
  `const cdPf = p.CD_PESSOA_FISICA || '';
        const mae = p.NM_MAE || '';`
);

content = content.replace(
  /JSON\.stringify\(\{nome, cpf, nasc, cdPf\}\)/,
  `JSON.stringify({nome, cpf, nasc, cdPf, mae})`
);

// Pegar o miolo antigo da prepararConfirmacaoTriagem
const idxStart = content.indexOf('window.conectaCore.prepararConfirmacaoTriagem = async function(base64Data) {');
const idxEnd = content.indexOf('async function salvarENovoAtendimentoTriagem() {');

const oldFunc = content.substring(idxStart, idxEnd);

// Criar o novo prepararConfirmacaoTriagem
const newPreparar = `window.conectaCore.prepararConfirmacaoTriagem = async function(base64Data) {
  try {
    const paciente = JSON.parse(decodeURIComponent(atob(base64Data)));
    const container = document.getElementById('triagem-confirm-details');
    
    document.getElementById('triagem-modal-step-busca').classList.add('d-none');
    document.getElementById('triagem-modal-step-confirmacao').classList.remove('d-none');

    container.innerHTML = \`
      <div class="text-center mb-4">
        <h5 class="fw-bold text-primary">Deseja iniciar a triagem do paciente abaixo?</h5>
        <p class="text-muted small mb-0">Valide os dados do paciente antes de prosseguir.</p>
      </div>
      <div class="card bg-white border shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label small fw-bold text-muted mb-0">Nome Completo</label>
              <div class="fw-bold fs-5 text-dark">\${utils.escapeHtml(paciente.nome)}</div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold text-muted mb-0">Data de Nascimento</label>
              <div class="fw-bold text-dark">\${utils.escapeHtml(paciente.nasc) || 'Não informado'}</div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold text-muted mb-0">CPF</label>
              <div class="fw-bold text-dark">\${utils.escapeHtml(paciente.cpf) || 'Não informado'}</div>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold text-muted mb-0">Nome da Mãe</label>
              <div class="fw-bold text-dark">\${utils.escapeHtml(paciente.mae) || 'Não informado'}</div>
            </div>
          </div>
        </div>
      </div>
    \`;

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
};`;

// Pegar o que a antiga prepararConfirmacao fazia (fetch do ehr template) e colocar em carregarTemplateEHR
// Vou recriar a lógica baseada na anterior

const newCarregar = `window.conectaCore.carregarTemplateEHR = async function(paciente) {
  ensureFluxoModals();
  try {
    const container = document.getElementById('triagem-confirm-details');
    
    // Mostra loading inicial
    container.innerHTML = \`
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 fw-bold text-muted small">Carregando Template Triagem P.A...</p>
      </div>
    \`;
    
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

    let html = \`
      <h5 class="fw-bold text-primary mb-3"><i class="bi bi-person-fill"></i> \${utils.escapeHtml(paciente.nome)}</h5>
      <hr>
      <h6 class="fw-bold text-secondary mb-3"><i class="bi bi-file-medical"></i> \${utils.escapeHtml(template.DS_TEMPLATE || 'Triagem P.A.')}</h6>
      <form id="form-ehr-triagem" class="row g-3">
    \`;

    // Renderiza campos dinamicamente
    elements.forEach(el => {
       const label = el.DS_LABEL || el.DS_LABEL_TELA || el.NM_ELEMENTO;
       if (!label) return; // ignora elementos sem identificação

       if (el.NR_SEQ_ELEMENTO === null || label === el.DS_LABEL) {
          if (!el.IE_COMPONENTE && !el.NR_SEQ_TIPO_DADO) {
            html += \`<div class="col-12 mt-3 mb-2 border-bottom"><h6 class="text-primary mb-1">\${utils.escapeHtml(label)}</h6></div>\`;
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
          fieldHtml = \`
            <div class="col-md-12 mb-2">
               <label class="form-label small fw-bold \${isRequired ? 'text-danger' : ''}">\${utils.escapeHtml(label)} \${isRequired ? '*' : ''}</label>
               <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-diagram-3"></i></span>
                  <input type="text" class="form-control bg-white" name="elem_\${el.NR_SEQUENCIA}_display" id="display_\${el.NR_SEQUENCIA}" placeholder="Clique no botão para preencher: \${utils.escapeHtml(label)}" readonly \${isRequired ? 'required' : ''}>
                  <input type="hidden" name="fluxo_\${el.NR_SEQUENCIA}" id="fluxo_\${el.NR_SEQUENCIA}" value="">
                  <input type="hidden" name="fluxo_tipo_\${el.NR_SEQUENCIA}" value="\${utils.escapeHtml(label)}">
                  <button class="btn btn-outline-secondary" type="button" onclick="window.conectaCore.abrirFluxoNativo('\${utils.escapeHtml(label)}', \${el.NR_SEQUENCIA})"><i class="bi bi-box-arrow-up-right"></i></button>
               </div>
            </div>
          \`;
       } else if (isCheckbox) {
          fieldHtml = \`
            <div class="col-md-3 col-sm-4 col-6 mb-2">
               <div class="form-check form-switch mt-1">
                  <input class="form-check-input" type="checkbox" name="elem_\${el.NR_SEQUENCIA}" value="Sim" id="cb_\${el.NR_SEQUENCIA}" \${isReadonly ? 'disabled' : ''}>
                  <label class="form-check-label small" for="cb_\${el.NR_SEQUENCIA}">\${utils.escapeHtml(label)}</label>
               </div>
            </div>
          \`;
       } else if (isTextarea) {
          fieldHtml = \`
            <div class="col-md-12 mb-2">
               <label class="form-label small fw-bold \${isRequired ? 'text-danger' : ''}">\${utils.escapeHtml(label)} \${isRequired ? '*' : ''}</label>
               <textarea class="form-control" name="elem_\${el.NR_SEQUENCIA}" rows="3" \${isRequired ? 'required' : ''} \${isReadonly ? 'readonly' : ''} maxlength="\${tamanho}"></textarea>
            </div>
          \`;
       } else {
          fieldHtml = \`
            <div class="col-md-6 col-lg-4 mb-2">
               <label class="form-label small fw-bold text-truncate w-100 \${isRequired ? 'text-danger' : ''}" title="\${utils.escapeHtml(label)}">\${utils.escapeHtml(label)} \${isRequired ? '*' : ''}</label>
               <input type="text" class="form-control" name="elem_\${el.NR_SEQUENCIA}" \${isRequired ? 'required' : ''} \${isReadonly ? 'readonly' : ''} maxlength="\${tamanho}">
            </div>
          \`;
       }

       html += fieldHtml;
    });

    html += \`</form>\`;
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
`;

content = content.replace(oldFunc, newPreparar + '\n\n' + newCarregar + '\n\n');

fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
