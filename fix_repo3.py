with open('backend/src/modules/triagem-pa/TriagemPaClinicoRepository.js', 'r') as f:
    text = f.read()

# The class ends right before async assinarEvolucao
text = text.replace("  }\n\n  async assinarEvolucao", "  \n  async assinarEvolucao")
# Wait, let's just find "}\n\n  async assinarEvolucao"
# Let's write a simple script that formats it.
import re
text = re.sub(r'}\s*async assinarEvolucao', '  async assinarEvolucao', text)
# And add '}' before module.exports
text = text.replace("module.exports = new TriagemPaClinicoRepository();", "}\n\nmodule.exports = new TriagemPaClinicoRepository();")
# let's be careful about double } 

with open('backend/src/modules/triagem-pa/TriagemPaClinicoRepository.js', 'w') as f:
    f.write(text)
