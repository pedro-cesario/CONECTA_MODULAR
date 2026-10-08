import re

with open('frontend/src/modules/triagem-pa/TriagemPaClinico.js', 'r') as f:
    content = f.read()

content = content.replace("const STEPS = ['paciente', 'queixa', 'alergias', 'sinais', 'historico', 'sintomas', 'glasgow'];", "const STEPS = ['paciente', 'queixa', 'alergias', 'sinais', 'historico', 'sintomas', 'glasgow', 'revisao'];")

# Update goNext to show Finalizar button at revisao step
content = content.replace(
"""  if (idx === STEPS.length - 1) {
    btnNext.innerHTML = 'Concluir Fase 4 (WIP) <i class="bi bi-check"></i>';
    btnNext.classList.replace('btn-primary', 'btn-success');
  } else {
    btnNext.innerHTML = 'Próxima Etapa <i class="bi bi-arrow-right ms-1"></i>';
    btnNext.classList.replace('btn-success', 'btn-primary');
  }""",
"""  const btnFinalizar = document.getElementById('btn-triagem-finalizar');
  if (idx === STEPS.length - 1) {
    btnNext.classList.add('d-none');
    btnFinalizar.classList.remove('d-none');
    preencherRevisao();
  } else {
    btnNext.classList.remove('d-none');
    btnFinalizar.classList.add('d-none');
    btnNext.innerHTML = 'Próxima Etapa <i class="bi bi-arrow-right ms-1"></i>';
  }"""
)

with open('frontend/src/modules/triagem-pa/TriagemPaClinico.js', 'w') as f:
    f.write(content)
