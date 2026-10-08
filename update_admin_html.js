const fs = require('fs');
let html = fs.readFileSync('frontend/admin.html', 'utf8');

const newPaneHtml = `
        <div class="tab-pane fade" id="pane-triagem-escala" role="tabpanel">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <h4 class="m-0"><i class="bi bi-list-check text-primary me-2"></i>Configuração da Escala de Triagem P.A.</h4>
            <button class="btn btn-primary" id="btn-save-escala-triagem-ui"><i class="bi bi-save me-1"></i>Salvar Tudo</button>
          </div>
          
          <ul class="nav nav-pills mb-3" id="escala-pills-tab" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active" id="pills-auto-tab" data-bs-toggle="pill" data-bs-target="#pills-auto" type="button" role="tab">Regras Automáticas</button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="pills-manuais-tab" data-bs-toggle="pill" data-bs-target="#pills-manuais" type="button" role="tab">Critérios Manuais</button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="pills-precedencia-tab" data-bs-toggle="pill" data-bs-target="#pills-precedencia" type="button" role="tab">Precedência das Cores</button>
            </li>
          </ul>

          <div class="tab-content" id="escala-pills-tabContent">
            <!-- REGRAS AUTOMATICAS -->
            <div class="tab-pane fade show active" id="pills-auto" role="tabpanel">
              <div class="d-flex justify-content-between mb-3">
                <h5>Regras Clínicas e Limites</h5>
                <button class="btn btn-sm btn-success" id="btn-add-regra-auto"><i class="bi bi-plus"></i> Nova Regra Automática</button>
              </div>
              <div id="container-regras-auto" class="row g-3">
                <!-- Regras renderizadas via JS -->
              </div>
            </div>

            <!-- CRITÉRIOS MANUAIS -->
            <div class="tab-pane fade" id="pills-manuais" role="tabpanel">
              <div class="d-flex justify-content-between mb-3">
                <h5>Comemorativos e Critérios de Usuário</h5>
                <button class="btn btn-sm btn-success" id="btn-add-regra-manual"><i class="bi bi-plus"></i> Novo Critério Manual</button>
              </div>
              <table class="table table-bordered bg-white">
                <thead class="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Cor</th>
                    <th>Ordem</th>
                    <th>Ativo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="tbody-regras-manuais">
                  <!-- Linhas renderizadas via JS -->
                </tbody>
              </table>
            </div>

            <!-- PRECEDÊNCIA -->
            <div class="tab-pane fade" id="pills-precedencia" role="tabpanel">
              <h5>Ordem de Precedência</h5>
              <p class="text-muted small">Defina qual cor ganha em caso de o paciente atingir múltiplos critérios. A primeira cor do topo é a de maior gravidade (prioridade 1).</p>
              
              <ul class="list-group w-50" id="list-precedencia">
                <!-- Items renderizados via JS -->
              </ul>
              
              <div class="mt-3 text-muted small"><i class="bi bi-info-circle"></i> Use as setas para reordenar a prioridade.</div>
            </div>
          </div>
        </div>
`;

// Substituir o pane antigo:
html = html.replace(/<div class="tab-pane fade" id="pane-triagem-escala" role="tabpanel">[\s\S]*?<!-- ADICIONAR NOVOS PANES DE TRIAGEM AQUI -->/, newPaneHtml + '\n        <!-- ADICIONAR NOVOS PANES DE TRIAGEM AQUI -->');

fs.writeFileSync('frontend/admin.html', html);
