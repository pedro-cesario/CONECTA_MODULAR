const assert = require('assert');
const rascunhosDb = require('./core/database/rascunhosDatabase');

async function testE2E() {
  console.log("Mocking dependencies for E2E...");
  
  // Mocks
  const PacienteService = require('./modules/core/paciente/PacienteService');
  PacienteService.salvarPessoa = async () => 12345;
  PacienteService.atribuirClassificacao = async () => true;
  
  const FilaRepository = require('./modules/core/fila/FilaRepository');
  FilaRepository.transferirPacienteFila = async (n, a, s, g) => {
    console.log(`TRANSFERIR_PAC_FILA: fila_nova=${n}, fila_atual=${a}, senha=${s}`);
    return true;
  };
  
  const clinicoRepo = require('./modules/triagem-pa/TriagemPaClinicoRepository');
  clinicoRepo.gravarSinaisVitais = async () => { console.log('gravarSinaisVitais'); return true; };
  clinicoRepo.gravarAlergia = async () => { console.log('gravarAlergia'); return true; };
  clinicoRepo.gravarGlasgow = async () => { console.log('gravarGlasgow'); return true; };
  clinicoRepo.atualizarClassificacao = async (atend, nrTriagem) => { 
    console.log(`atualizarClassificacao (NR_SEQ_TRIAGEM=${nrTriagem})`); 
    return true; 
  };
  clinicoRepo.gravarEvolucao = async () => { console.log('gravarEvolucao'); return 888; };
  clinicoRepo.assinarEvolucao = async () => { console.log('assinarEvolucao'); return true; };
  clinicoRepo.atualizarFimTriagem = async () => { console.log('atualizarFimTriagem'); return true; };

  const SettingsService = require('./modules/admin/SettingsService');
  SettingsService.getSettings = async () => ({
    triagem_estab: 1,
    triagem_setor: 2,
    triagem_procedencia: 3,
    triagem_clinica: 5,
    triagem_tipo_atend: 4,
    triagem_motivo: 6,
    triagem_fila_origem: 10,
    triagem_fila_destino: 99,
    recepcao_cd_med_resp: 408120,
    recepcao_cd_convenio_padrao: 3
  });

  SettingsService.getSetting = async (key) => {
    const s = {
      'triagem_estab': 1, 'triagem_setor': 2, 'triagem_procedencia': 3, 'triagem_tipo_atend': 4, 'triagem_clinica': 5,
      'triagem_cor_vermelho': 1, 'triagem_cor_amarelo': 3, 'triagem_cor_verde': 4, 'triagem_cor_azul': 5, 'triagem_fila_destino': 99,
      'recepcao_cd_med_resp': 408120, 'recepcao_cd_convenio_padrao': 3
    };
    return s[key] || null;
  };


  const TriagemPaService = require('./modules/triagem-pa/TriagemPaService');
  const TriagemPaFinalizacaoService = require('./modules/triagem-pa/TriagemPaFinalizacaoService');
  const rascunhoRepo = require('./modules/triagem-pa/TriagemPaRascunhoRepository');

  // Fluxo
  console.log("-> 1. Iniciar Atendimento");
  // Simula Atendimento sendo aberto (mock no AtendimentoRepository)
  const AtendimentoRepository = require('./modules/core/atendimento/AtendimentoRepository');
  
  AtendimentoRepository.verificarAtendimentoPorSenha = async () => null;
  AtendimentoRepository.verificarAtendimentoAberto = async () => null;

  AtendimentoRepository.abrirAtendimento = async () => ({ nr_atendimento: 111 });
  const TriagemService = require('./modules/core/triagem/TriagemService');
  TriagemService.iniciar = async () => true;
AtendimentoRepository.abrirAtendimentoProntoAtendimento = async () => ({ nr_atendimento: 111 });
  const iniciarResult = await TriagemPaService.iniciarAtendimentoTriagem({ 
    nrSeqPacSenhaFila: 55, cd_senha_gerada: 'A01', fila_atual: 10, cdPessoaFisica: 12345, condicaoIdentificacao: 'IDENTIFICADO' 
  }, 'TESTE');
  assert.strictEqual(iniciarResult.nr_atendimento, 111);

  console.log("-> 2. Salvar Rascunho");
  const rascunhoData = {
    queixaPrincipal: "Dor no peito",
    sinaisVitais: { pas: 180, pad: 130 }, // Vermelho rule
    alergias: { novaAlergia: true, novaAlergiaDesc: "AAS", negaAlergias: false },
    glasgow: { ocular: 4, verbal: 5, motora: 6, total: 15 },
    historico: ["HAS"]
  };
  await TriagemPaService.saveRascunho(111, rascunhoData, 'TESTE');

  console.log("-> 3. Recalcular e Finalizar");
  const finResult = await TriagemPaFinalizacaoService.finalizarTriagem(111, {
    nr_seq_senha: 55, cd_senha_gerada: 'A01', fila_atual: 10, cd_pessoa_fisica: 12345
  }, 'TESTE');
  
  assert.ok(finResult.success);

  const fin = await rascunhosDb.getFinalizacao(111);
  assert.strictEqual(fin.status, 'CONCLUIDA');
  
  // O rascunho deve ter sido apagado
  const rCheck = await rascunhoRepo.getRascunho(111);
  assert.strictEqual(rCheck, null);

  console.log("TESTE E2E MOCK PASSOU!");
  process.exit(0);
}

testE2E().catch(console.error);
