import sys

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

bad_footer = """          <!-- Footer do Modal com Botões de Navegação -->
                    <div class="modal-footer bg-light d-flex justify-content-between">
            <button type="button" class="btn btn-outline-secondary d-none" id="btn-triagem-voltar-step">
              <i class="bi bi-arrow-left"></i> Voltar
            </button>
            <button type="button" class="btn btn-light" id="btn-triagem-cancelar" data-bs-dismiss="modal">
              Cancelar
            </button>
            <div class="d-flex gap-2 ms-auto">
              <!-- Botoes Fase 1 a 3 -->
              <button type="button" class="btn btn-success fw-bold px-4 d-none" id="btn-triagem-salvar-paciente">
                <i class="bi bi-check-circle me-1"></i> Salvar e Iniciar Triagem
              </button>
              <button type="button" class="btn btn-primary fw-bold px-4 d-none" id="btn-triagem-confirmar-inicio">
                Iniciar Triagem <i class="bi bi-arrow-right ms-1"></i>
              </button>
              
              <!-- Botoes Fase 4 -->
              <button type="button" class="btn btn-primary fw-bold px-4 d-none" id="btn-triagem-avancar-clinico">
              <button type="button" class="btn btn-success fw-bold px-4 d-none" id="btn-triagem-finalizar">
                Finalizar Triagem <i class="bi bi-check-circle ms-1"></i>
              </button>
                Próxima Etapa <i class="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>"""

good_footer = """          <!-- Footer do Modal com Botões de Navegação -->
          <div class="modal-footer bg-light d-flex justify-content-between">
            <button type="button" class="btn btn-outline-secondary" id="modal-btn-voltar-passo">
              <i class="bi bi-arrow-left"></i> Voltar
            </button>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-primary" id="modal-btn-avancar-passo">
                Avançar <i class="bi bi-arrow-right"></i>
              </button>
              <button type="button" class="btn btn-success d-none" id="modal-btn-fechar-atendimento" data-bs-dismiss="modal">
                <i class="bi bi-check-lg"></i> Concluir Atendimento
              </button>
            </div>
          </div>"""

new_content = content.replace(bad_footer, good_footer)

if new_content == content:
    print("Warning: Content not replaced. Trying a more robust regex approach.")
    import re
    pattern = r"<!-- Footer do Modal com Botões de Navegação -->\s*<div class=\"modal-footer bg-light d-flex justify-content-between\">[\s\S]*?</div>\s*</div>"
    new_content = re.sub(pattern, good_footer, content)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
    print("Replaced successfully.")
