with open('backend/src/modules/triagem-pa/TriagemPaClinicoRepository.js', 'r') as f:
    content = f.read()

content = content.replace("module.exports = new TriagemPaClinicoRepository();", "")
content += "\nmodule.exports = new TriagemPaClinicoRepository();"

with open('backend/src/modules/triagem-pa/TriagemPaClinicoRepository.js', 'w') as f:
    f.write(content)
