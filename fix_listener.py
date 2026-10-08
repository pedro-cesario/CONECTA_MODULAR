import re
with open('frontend/src/modules/triagem-pa/TriagemPaClinico.js', 'r') as f:
    content = f.read()
    
content = content.replace("document.addEventListener('DOMContentLoaded', () => {", "")
content = content.replace("  document.getElementById('btn-triagem-finalizar')?.addEventListener('click', handleFinalizar);\n});", "document.getElementById('btn-triagem-finalizar')?.addEventListener('click', handleFinalizar);")

# Wait, the module might be imported multiple times or initialized in init()
# It has an init() function! Let's find it.
