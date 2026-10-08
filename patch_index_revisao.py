import re

with open('frontend/index.html', 'r') as f:
    content = f.read()

revisao_html = """
            <!-- Revisão -->
            <div id="triagem-modal-step-revisao" class="p-4 d-none triagem-clinical-step">
              <h5 class="fw-bold text-primary mb-4"><i class="bi bi-clipboard-check"></i> Revisão da Triagem</h5>
              
              <div class="row g-4">
                <div class="col-12" id="triagem-revisao-conteudo">
                  <!-- Preenchido via JS -->
                </div>
              </div>
            </div>
"""

# Insert before <div id="triagem-modal-step-confirmacao"
content = content.replace('<div id="triagem-modal-step-confirmacao"', revisao_html + '\n            <div id="triagem-modal-step-confirmacao"')

with open('frontend/index.html', 'w') as f:
    f.write(content)
