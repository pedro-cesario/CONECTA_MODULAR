with open('frontend/src/modules/triagem-pa/TriagemPaClinico.js', 'r') as f:
    content = f.read()

content = content.replace("document.addEventListener('DOMContentLoaded', () => {\n  document.getElementById('btn-triagem-finalizar')?.addEventListener('click', handleFinalizar);\n});", "")

# Add to setupTriagemClinico
content = content.replace("document.getElementById('btn-triagem-avancar-clinico')?.addEventListener('click', goNext);", "document.getElementById('btn-triagem-avancar-clinico')?.addEventListener('click', goNext);\n  document.getElementById('btn-triagem-finalizar')?.addEventListener('click', handleFinalizar);")

with open('frontend/src/modules/triagem-pa/TriagemPaClinico.js', 'w') as f:
    f.write(content)
