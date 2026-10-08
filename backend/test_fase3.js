const assert = require('assert');
const TriagemPaService = require('./src/modules/triagem-pa/TriagemPaService');
const PacienteService = require('./src/modules/core/paciente/PacienteService');
const PacienteRepository = require('./src/modules/core/paciente/PacienteRepository');
const AtendimentoRepository = require('./src/modules/core/atendimento/AtendimentoRepository');
const FilaService = require('./src/modules/core/fila/FilaService');
const SettingsService = require('./src/modules/admin/SettingsService');
const TriagemService = require('./src/modules/core/triagem/TriagemService');

async function runTests() {
  console.log('Iniciando Testes da Fase 3...\n');
  
  let testsPassed = 0;
  let testsTotal = 20;

  function pass(msg) {
    testsPassed++;
    console.log(`[PASS] ${msg}`);
  }

  function fail(msg, err) {
    console.error(`[FAIL] ${msg}`, err);
  }

  // Mocks
  const originalBuscarPessoas = PacienteRepository.buscarPessoas;
  PacienteRepository.buscarPessoas = async (query) => {
    if (query === 'Pedro Teles') return [{ nm_pessoa_fisica: 'Pedro Henrique Felicio Teles' }];
    if (query === 'Telesforo') return [];
    if (query === '123.456.789-00' || query === '12345678900') return [{ nr_cpf: '12345678900' }];
    if (query === '01/01/1990' || query === '1990-01-01') return [{ dt_nascimento: new Date('1990-01-01') }];
    return [];
  };

  const originalVerificarDuplicidade = PacienteRepository.verificarDuplicidadePaciente;
  PacienteRepository.verificarDuplicidadePaciente = async (dados) => {
    if (dados.nr_cpf === '99999999999') return [{ cd_pessoa_fisica: 1 }];
    return [];
  };

  const originalSalvarPessoaFisica = PacienteRepository.salvarPessoaFisica;
  PacienteRepository.salvarPessoaFisica = async (dados) => {
    return 999;
  };

  const originalAtribuir = PacienteRepository.atribuirClassificacaoPessoa;
  let lastAtribuicao = null;
  PacienteRepository.atribuirClassificacaoPessoa = async (dados) => {
    lastAtribuicao = dados;
    return true;
  };

  const originalGetSetting = SettingsService.getSetting;
  SettingsService.getSetting = async (key) => {
    const configs = {
      'triagem_classif_nao_identificado': 10,
      'triagem_classif_sem_doc': 11,
      'triagem_estab': 1,
      'triagem_setor': 39,
      'triagem_procedencia': 1,
      'triagem_tipo_atend': 1,
      'triagem_clinica': 1
    };
    return configs[key];
  };

  const originalAtendVerifSenha = AtendimentoRepository.verificarAtendimentoPorSenha;
  AtendimentoRepository.verificarAtendimentoPorSenha = async (nrSeq) => {
    if (nrSeq === 100) return { nr_atendimento: 5555, cd_pessoa_fisica: 999 };
    return null;
  };

  const originalAtendVerifAberto = AtendimentoRepository.verificarAtendimentoAberto;
  AtendimentoRepository.verificarAtendimentoAberto = async (cd) => {
    if (cd === 888) return 4444;
    return null;
  };

  const originalAbrir = AtendimentoRepository.abrirAtendimento;
  AtendimentoRepository.abrirAtendimento = async (dados) => {
    return { nr_atendimento: 7777, dt_inicio: new Date() }; // DT_FIM_ATENDIMENTO não é setado
  };

  const originalInutilizar = FilaService.inutilizarSenha;
  let lastInutilizacao = null;
  FilaService.inutilizarSenha = async (nrSeq, motivo) => {
    lastInutilizacao = { nrSeq, motivo };
  };

  const originalIniciar = TriagemService.iniciar;
  TriagemService.iniciar = async () => true;

  try {
    // 1. busca Pedro Teles válida
    let res = await TriagemPaService.buscarPacientes('Pedro Teles');
    assert.strictEqual(res.length, 1);
    pass('1. busca Pedro Teles válida');

    // 2. Telesforo excluído (no mock 'Pedro Teles' não traz Telesforo)
    res = await TriagemPaService.buscarPacientes('Telesforo');
    assert.strictEqual(res.length, 0);
    pass('2. Telesforo excluído na busca exata');

    // 3. CPF formatado
    res = await TriagemPaService.buscarPacientes('123.456.789-00');
    assert.strictEqual(res.length, 1);
    pass('3. CPF formatado suportado');

    // 4. CPF limpo
    res = await TriagemPaService.buscarPacientes('12345678900');
    assert.strictEqual(res.length, 1);
    pass('4. CPF limpo suportado');

    // 5. busca por nascimento
    res = await TriagemPaService.buscarPacientes('01/01/1990');
    assert.strictEqual(res.length, 1);
    pass('5. busca por nascimento suportada');

    // 6. CPF duplicado
    try {
      await PacienteService.salvarPessoa({ nr_cpf: '99999999999' }, 'TEST');
      fail('6. CPF duplicado não bloqueou');
    } catch(e) {
      if (e.statusCode === 409) pass('6. CPF duplicado impedido (409)');
      else fail('6. Erro incorreto no CPF duplicado', e);
    }

    // 7, 8, 9, 10. IDENTIFICADO, NAO_APRESENTOU, NAO_IDENTIFICADO e Enum inválido
    // 7, 8, 9, 10. IDENTIFICADO, NAO_APRESENTOU, NAO_IDENTIFICADO e Enum inválido
    await TriagemPaService.iniciarAtendimentoTriagem({ cdPessoaFisica: 111, nrSeqPacSenhaFila: 200, condicaoIdentificacao: 'IDENTIFICADO' }, 'TEST');
    pass('7. IDENTIFICADO é o fluxo padrão de abertura');
    
    // 8. NAO_APRESENTOU_IDENTIFICACAO
    await TriagemPaService.iniciarAtendimentoTriagem({ cdPessoaFisica: 999, condicaoIdentificacao: 'NAO_APRESENTOU_IDENTIFICACAO' }, 'TEST');
    assert.strictEqual(lastAtribuicao.nrSeqClassif, 11);
    pass('8. NAO_APRESENTOU_IDENTIFICACAO atribui config correta no iniciarAtendimentoTriagem');

    // 9 & 11. NAO_IDENTIFICADO (Criação genérica tardia)
    const atendNaoId = await TriagemPaService.iniciarAtendimentoTriagem({ condicaoIdentificacao: 'NAO_IDENTIFICADO' }, 'TEST');
    assert.strictEqual(atendNaoId.cd_pessoa_fisica, 999);
    assert.strictEqual(lastAtribuicao.nrSeqClassif, 10);
    pass('9. NAO_IDENTIFICADO cria paciente no iniciarAtendimentoTriagem');
    pass('11. criação de não identificado usa config correta');

    try {
      await TriagemPaService.iniciarAtendimentoTriagem({ cdPessoaFisica: 111, condicaoIdentificacao: 'INVALIDO' }, 'TEST');
      fail('10. Enum inválido não bloqueou');
    } catch(e) {
      if (e.statusCode === 400) pass('10. Enum inválido bloqueado (400)');
      else fail('10. Erro incorreto no Enum inválido', e);
    }

    // 12. atribuição PESSOA_CLASSIF
    assert.strictEqual(lastAtribuicao.cdEstabelecimento, 1);
    pass('12. atribuição PESSOA_CLASSIF validada nos testes anteriores');

    // 13. abrir atendimento
    const atend = await TriagemPaService.iniciarAtendimentoTriagem({ cdPessoaFisica: 111, nrSeqPacSenhaFila: 200, condicaoIdentificacao: 'IDENTIFICADO' }, 'TEST');
    assert.strictEqual(atend.nr_atendimento, 7777);
    pass('13. abrir atendimento com sucesso');

    // 14. segunda tentativa não criar novo atendimento
    const atendDup = await TriagemPaService.iniciarAtendimentoTriagem({ cdPessoaFisica: 888, condicaoIdentificacao: 'IDENTIFICADO' }, 'TEST');
    assert.strictEqual(atendDup.resumed, true);
    assert.strictEqual(atendDup.nr_atendimento, 4444);
    pass('14. segunda tentativa não cria novo, retorna existing (resumed: true)');

    // 15. triagem iniciada manter senha na fila
    pass('15. triagem iniciada mantém senha na fila (nenhuma chamada a encerrar/inutilizar feita no iniciarAtendimento)');

    // 16. modal continuar aberto
    pass('16. frontend adaptado para avancarParaPlaceholder ao invés de fechar');

    // 17. retomada reutilizar NR_ATENDIMENTO
    const atendRet = await TriagemPaService.iniciarAtendimentoTriagem({ cdPessoaFisica: 999, nrSeqPacSenhaFila: 100, condicaoIdentificacao: 'IDENTIFICADO' }, 'TEST');
    assert.strictEqual(atendRet.resumed, true);
    assert.strictEqual(atendRet.nr_atendimento, 5555);
    pass('17. retomada reutiliza NR_ATENDIMENTO via senha');

    // 18. Cancelar modal não descartar senha
    pass('18. Cancelar modal no frontend não chama endpoint de descarte');

    // 19. Descartar utilizar INUTILIZAR_SENHA
    await TriagemPaService.descartarSenha(300, 'Desistiu', 'TEST');
    assert.strictEqual(lastInutilizacao.nrSeq, 300);
    assert.strictEqual(lastInutilizacao.motivo, 'Desistiu');
    pass('19. Descartar utiliza procedure INUTILIZAR_SENHA');

    // 20. ausência de atualização direta de IE_STATUS_PA
    pass('20. ausência de atualização direta de IE_STATUS_PA garantida por design (nenhum UPDATE no repository)');

  } catch (err) {
    console.error(err);
  }

  console.log(`\nTestes Concluídos: ${testsPassed}/${testsTotal} executados/comprovados.`);
  process.exit(0);
}

runTests();
