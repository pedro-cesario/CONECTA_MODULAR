import re
import sys

with open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

match = re.search(r'<!-- Modal Triagem: Identificação e Abertura -->', content)
if not match:
    print("Modal não encontrado")
    sys.exit(1)

start_index = match.start()

new_modal = """<!-- Modal Triagem: Identificação e Abertura -->
    <div class="modal fade" id="modal-triagem-identificacao" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style="max-width: 1200px;">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; height: 90vh;">
          
          <!-- Header (Azul/Navy) -->
          <div class="modal-header d-flex justify-content-between align-items-center flex-shrink-0" style="background-color: var(--primary); color: white; border-bottom: none;">
            <div class="d-flex align-items-center gap-3">
              <h5 class="mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-person-bounding-box"></i> Triagem P.A.
              </h5>
              <span class="badge bg-white text-primary px-3 py-2" id="triagem-modal-senha-badge" style="font-size: 0.9rem; border-radius: 6px;">
                <i class="bi bi-ticket-perforated-fill me-1"></i> Senha: <strong>---</strong>
              </span>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          
          <!-- Stepper -->
          <nav class="modal-stepper flex-shrink-0" id="triagem-stepper" aria-label="Etapas da Triagem" style="background-color: #f8fafc; border-bottom: 1px solid var(--slate-200); padding: 0.5rem 1rem;">
            <button class="modal-step-item active" data-t-step="paciente" type="button">
              <span class="modal-step-badge">1</span><span>Identificação</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="queixa" type="button">
              <span class="modal-step-badge">2</span><span>Queixa</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="alergias" type="button">
              <span class="modal-step-badge">3</span><span>Alergias</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="sinais" type="button">
              <span class="modal-step-badge">4</span><span>Sinais Vitais</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="historico" type="button">
              <span class="modal-step-badge">5</span><span>Histórico</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="glasgow" type="button">
              <span class="modal-step-badge">6</span><span>Glasgow</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="escala" type="button">
              <span class="modal-step-badge">7</span><span>Escala</span>
            </button>
            <span class="modal-step-divider"></span>
            <button class="modal-step-item" data-t-step="revisao" type="button">
              <span class="modal-step-badge">8</span><span>Revisão</span>
            </button>
          </nav>

          <div class="modal-body p-0 d-flex flex-column" style="overflow-y: auto; background-color: #ffffff;">
            
            <!-- Resumo Compacto do Paciente -->
            <div id="triagem-resumo-paciente" class="d-none bg-light border-bottom p-2 px-4 d-flex justify-content-between align-items-center text-muted" style="font-size: 0.85rem;">
              <div class="fw-bold text-dark"><i class="bi bi-person-circle me-1"></i> <span id="resumo-paciente-nome">---</span></div>
              <div>Atendimento #<span id="resumo-paciente-atendimento">---</span> &bull; <span id="resumo-paciente-setor">P.A. - NORMAL</span> &bull; <span id="resumo-paciente-senha" class="fw-bold">---</span></div>
            </div>

            <!-- ETAPA 1: Busca e Condição -->
            <div id="triagem-modal-step-paciente" class="p-4 triagem-clinical-step">
              <h6 class="fw-bold text-primary mb-3"><i class="bi bi-card-checklist"></i> Condição de Identificação</h6>
              <div class="row g-3 mb-4">
                <div class="col-md-4">
                  <input type="radio" class="btn-check" name="triagem_condicao" id="cond_identificado" value="IDENTIFICADO" checked>
                  <label class="btn btn-outline-primary w-100 text-start p-3 h-100" for="cond_identificado" style="border-radius: 8px;">
                    <div class="d-flex align-items-center mb-1"><i class="bi bi-person-badge text-primary me-2"></i> <strong>Identificado</strong></div>
                    <small class="text-muted">Paciente apresentou documento oficial.</small>
                  </label>
                </div>
                <div class="col-md-4">
                  <input type="radio" class="btn-check" name="triagem_condicao" id="cond_sem_doc" value="NAO_APRESENTOU_IDENTIFICACAO">
                  <label class="btn btn-outline-primary w-100 text-start p-3 h-100" for="cond_sem_doc" style="border-radius: 8px;">
                    <div class="d-flex align-items-center mb-1"><i class="bi bi-person text-primary me-2"></i> <strong>Não apresentou identificação</strong></div>
                    <small class="text-muted">Paciente informou quem é, mas sem documento.</small>
                  </label>
                </div>
                <div class="col-md-4">
                  <input type="radio" class="btn-check" name="triagem_condicao" id="cond_nao_ident" value="NAO_IDENTIFICADO">
                  <label class="btn btn-outline-primary w-100 text-start p-3 h-100" for="cond_nao_ident" style="border-radius: 8px;">
                    <div class="d-flex align-items-center mb-1"><i class="bi bi-person-x text-primary me-2"></i> <strong>Não identificado</strong></div>
                    <small class="text-muted">Paciente não consegue informar quem é.</small>
                  </label>
                </div>
              </div>

              <div id="triagem-modal-search-section">
                <p class="text-muted fw-bold mb-2"><i class="bi bi-search me-1"></i> Buscar paciente no TASY</p>
                <div class="input-group input-group-lg shadow-sm mb-3">
                  <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                  <input type="text" class="form-control border-start-0 ps-0 fw-bold" id="triagem-modal-search-input" placeholder="Nome, CPF, prontuário ou data de nascimento">
                </div>

                <div id="triagem-modal-search-results" class="d-flex flex-column gap-2" style="max-height: 250px; overflow-y: auto;">
                  <div class="text-center text-muted py-3">
                    <i class="bi bi-keyboard" style="font-size: 2rem; opacity: 0.3;"></i>
                    <p class="mt-2 small">Digite para pesquisar no TASY...</p>
                  </div>
                </div>
                
                <div class="mt-3 text-center border-top pt-3">
                  <button class="btn btn-outline-primary fw-bold px-4" id="btn-triagem-show-cadastro">
                    <i class="bi bi-person-plus-fill me-1"></i> Cadastrar Novo Paciente (Básico)
                  </button>
                </div>
              </div>
            </div>

            <!-- ETAPA 1B: Cadastro Novo -->
            <div id="triagem-modal-step-cadastro" class="p-4 d-none triagem-clinical-step">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-bold text-primary m-0"><i class="bi bi-person-plus"></i> Novo Cadastro</h6>
                <button class="btn btn-sm btn-link text-muted" id="btn-triagem-back-busca"><i class="bi bi-arrow-left"></i> Voltar à busca</button>
              </div>
              
              <form id="form-triagem-novo-paciente">
                <div class="mb-3">
                  <label class="form-label fw-bold text-muted small mb-1">Nome Completo <span class="text-danger">*</span></label>
                  <input type="text" class="form-control fw-bold" id="triagem-form-nome" required>
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label fw-bold text-muted small mb-1">CPF</label>
                    <input type="text" class="form-control" id="triagem-form-cpf" placeholder="000.000.000-00">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-bold text-muted small mb-1">Data Nasc. <span class="text-danger">*</span></label>
                    <input type="date" class="form-control" id="triagem-form-nascimento" required>
                  </div>
                </div>
              </form>
            </div>

            <!-- ETAPA 1C: Confirmação -->
            <div id="triagem-modal-step-confirmacao" class="p-4 d-none triagem-clinical-step">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-bold text-primary m-0"><i class="bi bi-person-check"></i> Paciente selecionado</h6>
                <button class="btn btn-sm btn-link text-muted" id="btn-triagem-back-busca-conf"><i class="bi bi-arrow-left"></i> Voltar à busca</button>
              </div>
              <div class="card bg-light border-primary mb-3">
                <div class="card-body" id="triagem-confirm-details">
                  <!-- preenchido dinamicamente -->
                </div>
              </div>
              <div class="alert alert-success d-flex align-items-center"><i class="bi bi-check-circle-fill me-2"></i> Paciente localizado no TASY</div>
            </div>
            
            <!-- ETAPA 2: Queixa Principal -->
            <div id="triagem-modal-step-queixa" class="p-4 d-none triagem-clinical-step">
              <h5 class="fw-bold text-primary mb-3"><i class="bi bi-chat-square-text"></i> Queixa Principal</h5>
              <div class="mb-3">
                <label class="form-label fw-bold text-muted">Queixa principal <span class="text-danger">*</span></label>
                <textarea class="form-control" id="triagem-queixa-principal" rows="4" placeholder="Relate a queixa do paciente..."></textarea>
                <div class="invalid-feedback">Informe a queixa principal.</div>
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold text-muted">Observações iniciais (opcional)</label>
                <textarea class="form-control" id="triagem-observacoes" rows="2" placeholder="Outras observações relevantes..."></textarea>
              </div>
            </div>

            <!-- ETAPA 3: Alergias -->
            <div id="triagem-modal-step-alergias" class="p-4 d-none triagem-clinical-step">
              <h5 class="fw-bold text-primary mb-3"><i class="bi bi-shield-exclamation"></i> Alergias</h5>
              <div class="row h-100">
                <div class="col-md-6 border-end">
                  <h6 class="fw-bold text-secondary mb-3">Alergias cadastradas no TASY</h6>
                  <div id="triagem-alergias-existentes" class="p-3 bg-light rounded" style="min-height: 150px;">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div> Buscando...
                  </div>
                </div>
                <div class="col-md-6 ps-4">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold text-secondary m-0">Registrar nova alergia</h6>
                    <div class="form-check form-switch mb-0">
                      <input class="form-check-input" type="checkbox" id="triagem-nega-alergias">
                      <label class="form-check-label fw-bold text-muted" for="triagem-nega-alergias">Nega alergias</label>
                    </div>
                  </div>
                  <div class="mb-3" id="triagem-nova-alergia-container">
                    <label class="form-label text-muted small fw-bold">Descrição da Alergia</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="triagem-nova-alergia-input" placeholder="Ex: Dipirona">
                      <button class="btn btn-outline-primary fw-bold" type="button" id="btn-triagem-add-alergia"><i class="bi bi-plus-lg"></i> Adicionar</button>
                    </div>
                  </div>
                  <ul class="list-group" id="triagem-novas-alergias-list"></ul>
                </div>
              </div>
            </div>

            <!-- ETAPA 4: Sinais Vitais -->
            <div id="triagem-modal-step-sinais" class="p-4 d-none triagem-clinical-step">
              <div class="row">
                <div class="col-md-9">
                  <h5 class="fw-bold text-primary mb-4"><i class="bi bi-heart-pulse"></i> Sinais Vitais</h5>
                  <div class="row g-4">
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">PA Sistólica</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-pas" min="0" max="350">
                        <span class="input-group-text bg-light">mmHg</span>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">PA Diastólica</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-pad" min="0" max="250">
                        <span class="input-group-text bg-light">mmHg</span>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">Freq. Cardíaca</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-fc" min="0" max="350">
                        <span class="input-group-text bg-light">bpm</span>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">Freq. Respiratória</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-fr" min="0" max="150">
                        <span class="input-group-text bg-light">irpm</span>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">Temperatura</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-temp" min="15" max="45" step="0.1">
                        <span class="input-group-text bg-light">°C</span>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">Saturação O2</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-spo2" min="0" max="100">
                        <span class="input-group-text bg-light">%</span>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label text-muted fw-bold small mb-1">Peso</label>
                      <div class="input-group">
                        <input type="number" class="form-control fw-bold" id="triagem-sv-peso" min="0" max="600" step="0.01">
                        <span class="input-group-text bg-light">kg</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-md-3 border-start">
                  <h6 class="fw-bold text-secondary mb-3">Resumo Rápido</h6>
                  <div class="bg-light rounded p-3 text-muted small" id="triagem-sv-resumo">
                    <em>Preencha os sinais vitais para visualizar a interpretação.</em>
                  </div>
                </div>
              </div>
            </div>

            <!-- ETAPA 5: Histórico -->
            <div id="triagem-modal-step-historico" class="p-4 d-none triagem-clinical-step">
              <h5 class="fw-bold text-primary mb-4"><i class="bi bi-journal-medical"></i> Histórico e Comportamento</h5>
              
              <div class="row g-4">
                <div class="col-md-6">
                  <h6 class="fw-bold text-secondary border-bottom pb-2 mb-3">Histórico de Saúde</h6>
                  <div class="row g-2" id="triagem-historico-container">
                    <div class="col-12 text-center text-muted"><div class="spinner-border spinner-border-sm"></div></div>
                  </div>
                </div>
                
                <div class="col-md-6">
                  <h6 class="fw-bold text-secondary border-bottom pb-2 mb-3">Estado Geral</h6>
                  <div class="row g-2" id="triagem-estado-geral-container">
                    <div class="col-12 text-center text-muted"><div class="spinner-border spinner-border-sm"></div></div>
                  </div>
                </div>

                <div class="col-md-6">
                  <h6 class="fw-bold text-secondary border-bottom pb-2 mb-3">Comportamento</h6>
                  <div class="row g-2" id="triagem-comportamento-container">
                    <div class="col-12 text-center text-muted"><div class="spinner-border spinner-border-sm"></div></div>
                  </div>
                </div>
                
                <div class="col-md-6">
                  <h6 class="fw-bold text-secondary border-bottom pb-2 mb-3">Sintomas Gripais</h6>
                  <div class="card bg-light border-0">
                    <div class="card-body">
                      <div class="form-check form-switch form-switch-lg mb-3">
                        <input class="form-check-input" type="checkbox" id="triagem-sintomas-gripais-check">
                        <label class="form-check-label fw-bold ms-2 mt-1" for="triagem-sintomas-gripais-check">Paciente apresenta sintomas gripais?</label>
                      </div>
                      <div id="triagem-sintomas-gripais-desc-container" class="d-none">
                        <label class="form-label text-muted small fw-bold">Observação (opcional)</label>
                        <textarea class="form-control" id="triagem-sintomas-gripais-desc" rows="2"></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ETAPA 6: Glasgow -->
            <div id="triagem-modal-step-glasgow" class="p-4 d-none triagem-clinical-step">
              <h5 class="fw-bold text-primary mb-4"><i class="bi bi-eye"></i> Escala de Coma de Glasgow</h5>
              <div class="row g-4">
                <div class="col-md-4">
                  <label class="form-label text-muted fw-bold small mb-1">Abertura Ocular</label>
                  <select class="form-select" id="triagem-glasgow-ocular">
                    <option value="">Selecione...</option>
                    <option value="4">4 - Espontânea</option>
                    <option value="3">3 - À voz</option>
                    <option value="2">2 - À dor</option>
                    <option value="1">1 - Nenhuma</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label text-muted fw-bold small mb-1">Resposta Verbal</label>
                  <select class="form-select" id="triagem-glasgow-verbal">
                    <option value="">Selecione...</option>
                    <option value="5">5 - Orientada</option>
                    <option value="4">4 - Confusa</option>
                    <option value="3">3 - Palavras inapropriadas</option>
                    <option value="2">2 - Sons ininteligíveis</option>
                    <option value="1">1 - Nenhuma</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label text-muted fw-bold small mb-1">Resposta Motora</label>
                  <select class="form-select" id="triagem-glasgow-motora">
                    <option value="">Selecione...</option>
                    <option value="6">6 - Obedece a comandos</option>
                    <option value="5">5 - Localiza a dor</option>
                    <option value="4">4 - Flexão normal (Retirada)</option>
                    <option value="3">3 - Flexão anormal (Decorticação)</option>
                    <option value="2">2 - Extensão (Descerebração)</option>
                    <option value="1">1 - Nenhuma</option>
                  </select>
                </div>
              </div>
              <div class="mt-5 text-center p-4 bg-light rounded border" style="max-width: 300px; margin: 0 auto;">
                <div class="text-muted fw-bold mb-1">Total Glasgow</div>
                <h2 class="fw-bold text-primary m-0" id="triagem-glasgow-total">-</h2>
              </div>
              
              <div class="mt-4">
                <h6 class="fw-bold text-secondary mb-3">Escala de Triagem P.A. (preview)</h6>
                <div id="triagem-preview-escala" class="p-3 bg-light rounded text-muted small">
                  Critérios identificados aparecerão aqui...
                </div>
              </div>
            </div>

            <!-- ETAPA 7: Escala -->
            <div id="triagem-modal-step-escala" class="p-4 d-none triagem-clinical-step">
              <h5 class="fw-bold text-primary mb-4"><i class="bi bi-clipboard2-pulse"></i> Escala de Triagem P.A.</h5>
              <div class="row">
                <div class="col-md-8">
                  <h6 class="fw-bold text-secondary mb-3">Critérios Automáticos (Motor)</h6>
                  <ul class="list-group mb-4" id="triagem-criterios-automaticos">
                    <li class="list-group-item text-muted small">Nenhum critério detectado.</li>
                  </ul>
                  
                  <h6 class="fw-bold text-secondary mb-3">Critérios Manuais (Admin)</h6>
                  <div class="row g-2" id="triagem-criterios-manuais-container">
                    <div class="col-12 text-center text-muted"><div class="spinner-border spinner-border-sm"></div></div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-0 shadow-sm h-100">
                    <div class="card-header bg-primary text-white fw-bold">Classificação Sugerida</div>
                    <div class="card-body text-center p-4 d-flex flex-column align-items-center justify-content-center">
                      <div id="triagem-classificacao-preview-cor" class="mb-3 d-flex align-items-center justify-content-center fw-bold" style="width: 80px; height: 80px; border-radius: 50%; background-color: #e2e8f0; color: #333; font-size: 1.5rem;"></div>
                      <h4 class="fw-bold m-0" id="triagem-classificacao-preview-texto">Aguardando...</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ETAPA 8: Revisão -->
            <div id="triagem-modal-step-revisao" class="p-4 d-none triagem-clinical-step">
              <div class="row mb-4">
                <div class="col-md-8">
                  <h5 class="fw-bold text-primary mb-3"><i class="bi bi-check-all"></i> Revisão da Triagem P.A.</h5>
                </div>
                <div class="col-md-4 text-end">
                  <div class="p-2 rounded text-center fw-bold shadow-sm text-white" id="triagem-revisao-classificacao-card" style="background-color: #64748b;">
                    CLASSIFICAÇÃO PENDENTE
                  </div>
                </div>
              </div>
              
              <div class="row g-3" id="triagem-revisao-conteudo">
                <!-- Preenchido via JS -->
              </div>
              
              <div class="mt-4 p-3 bg-light rounded border text-center d-flex justify-content-between align-items-center" id="triagem-revisao-final-callout">
                <div>
                  <h6 class="fw-bold text-dark m-0"><i class="bi bi-info-circle text-primary me-2"></i> Triagem pronta para finalização</h6>
                  <div class="small text-muted mt-1 text-start ms-4">Ao finalizar, os dados estruturados serão salvos no TASY e a evolução será gerada.</div>
                </div>
              </div>
            </div>
            
          </div>
          
          <!-- Footer Unificado -->
          <div class="modal-footer bg-light flex-shrink-0 d-flex justify-content-between align-items-center" style="border-top: 1px solid var(--slate-200);">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-outline-secondary px-4 d-none" id="btn-triagem-voltar-step">
                <i class="bi bi-arrow-left"></i> Voltar
              </button>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-light text-primary fw-bold" id="btn-triagem-salvar-rascunho" onclick="if(window.salvarRascunho)window.salvarRascunho()">
                <i class="bi bi-save me-1"></i> Salvar rascunho
              </button>
              <button type="button" class="btn btn-primary fw-bold px-4 d-none" id="btn-triagem-avancar-clinico">
                Avançar <i class="bi bi-arrow-right ms-1"></i>
              </button>
              <button type="button" class="btn btn-primary fw-bold px-4 d-none" id="btn-triagem-iniciar">
                Avançar e Iniciar Triagem <i class="bi bi-arrow-right ms-1"></i>
              </button>
              <button type="button" class="btn btn-success fw-bold px-4 d-none" id="btn-triagem-finalizar">
                <i class="bi bi-check-circle me-1"></i> Finalizar Triagem
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
"""

new_content = content[:start_index] + new_modal + "\n</body>\n</html>"
with open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Modal atualizado com sucesso no index.html!")
