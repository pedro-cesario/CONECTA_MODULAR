with open('backend/src/test_e2e_triagem_mock.js', 'r') as f:
    c = f.read()

new_mocks = """
  AtendimentoRepository.abrirAtendimento = async () => ({ nr_atendimento: 111 });
  const TriagemService = require('./modules/core/triagem/TriagemService');
  TriagemService.iniciar = async () => true;
"""

c = c.replace("AtendimentoRepository.abrirAtendimentoProntoAtendimento = async () => ({ nr_atendimento: 111 });", 
new_mocks + "AtendimentoRepository.abrirAtendimentoProntoAtendimento = async () => ({ nr_atendimento: 111 });")

with open('backend/src/test_e2e_triagem_mock.js', 'w') as f:
    f.write(c)
