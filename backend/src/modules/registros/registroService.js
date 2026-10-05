const registroRepository = require('.//registroRepository');

const TIPOS_REGISTROS = [
  {
    id: 'demanda_espontanea',
    nome: 'Demanda Espontânea',
    area: 'Serviço Social',
    nrSeqTipoHist: 1,
    permissao: 'lancar_demanda_espontanea',
    descricao: 'Registre o acolhimento a demandas espontâneas de pacientes e familiares.',
    icone: 'bi-chat-heart'
  }
];

function listarTiposRegistros() {
  return TIPOS_REGISTROS;
}

function obterTipoRegistro(tipoId) {
  return TIPOS_REGISTROS.find(t => t.id === tipoId || String(t.nrSeqTipoHist) === String(tipoId)) || null;
}

async function buscarPessoas(tipo, valor) {
  const buscaValor = String(valor !== undefined && valor !== null ? valor : (tipo || '')).trim();

  if (!buscaValor) {
    throw Object.assign(new Error('Informe um CPF, Nome ou Código TASY para realizar a busca.'), { status: 400 });
  }

  if (buscaValor.length < 2) {
    throw Object.assign(new Error('Informe ao menos 2 caracteres para pesquisar.'), { status: 400 });
  }

  return registroRepository.buscarPessoasInteligente(buscaValor, 30);
}

async function obterPessoa(cdPessoaFisica) {
  if (!cdPessoaFisica) {
    throw Object.assign(new Error('Código de pessoa física não informado.'), { status: 400 });
  }
  const pessoa = await registroRepository.obterPessoaPorCodigo(cdPessoaFisica);
  if (!pessoa) {
    throw Object.assign(new Error('Pessoa física não encontrada no sistema.'), { status: 404 });
  }
  return pessoa;
}

async function cadastrarPessoa(dados, usuarioLogado) {
  const nome = String(dados.nm_pessoa_fisica || '').trim();
  if (!nome || nome.length < 3) {
    throw Object.assign(new Error('O nome completo da pessoa é obrigatório (mínimo 3 caracteres).'), { status: 400 });
  }

  const cpfLimpo = registroRepository.normalizeCpf(dados.nr_cpf);
  if (cpfLimpo && cpfLimpo.length !== 11) {
    throw Object.assign(new Error('CPF inválido. O CPF deve conter 11 dígitos.'), { status: 400 });
  }

  // Se informou CPF, verifica se já existe
  if (cpfLimpo) {
    const existentes = await registroRepository.buscarPessoasPorCpf(cpfLimpo);
    if (existentes.length > 0) {
      throw Object.assign(new Error(`Já existe uma pessoa cadastrada com o CPF informado: ${existentes[0].NM_PESSOA_FISICA}.`), { status: 409 });
    }
  }

  return registroRepository.cadastrarPessoaFisica(dados, usuarioLogado);
}

async function salvarRegistro(payload, usuarioLogado) {
  const cdPessoaFisica = String(payload.cd_pessoa_fisica || '').trim();
  if (!cdPessoaFisica) {
    throw Object.assign(new Error('Pessoa física não selecionada.'), { status: 400 });
  }

  // Valida se a pessoa existe no TASY
  const pessoa = await registroRepository.obterPessoaPorCodigo(cdPessoaFisica);
  if (!pessoa) {
    throw Object.assign(new Error('Pessoa física não encontrada no cadastro do TASY.'), { status: 404 });
  }

  const dsHistorico = String(payload.ds_historico || '').trim();
  if (!dsHistorico) {
    throw Object.assign(new Error('O histórico do registro não pode estar vazio.'), { status: 400 });
  }

  if (dsHistorico.length > 4000) {
    throw Object.assign(new Error('O histórico excede o limite máximo permitido de 4000 caracteres.'), { status: 400 });
  }

  const dtRegistro = payload.dt_registro ? new Date(payload.dt_registro) : new Date();
  if (isNaN(dtRegistro.getTime())) {
    throw Object.assign(new Error('Data do registro inválida.'), { status: 400 });
  }

  const tipoId = payload.tipo_id || 'demanda_espontanea';
  const tipoConfig = obterTipoRegistro(tipoId);
  const nrSeqTipoHist = tipoConfig ? tipoConfig.nrSeqTipoHist : 1;

  const resultado = await registroRepository.inserirPessoaFisicaHistorico({
    cd_pessoa_fisica: cdPessoaFisica,
    nr_seq_tipo_hist: nrSeqTipoHist,
    ds_historico: dsHistorico,
    dt_registro: dtRegistro
  }, usuarioLogado);

  return {
    success: true,
    ...resultado,
    pessoa: {
      cd_pessoa_fisica: pessoa.CD_PESSOA_FISICA,
      nm_pessoa_fisica: pessoa.NM_PESSOA_FISICA
    }
  };
}

async function atualizarPessoa(cdPessoaFisica, dados, usuarioLogado) {
  if (!cdPessoaFisica) {
    throw Object.assign(new Error('Código de pessoa física não informado.'), { status: 400 });
  }

  const nome = String(dados.nm_pessoa_fisica || '').trim();
  if (!nome || nome.length < 3) {
    throw Object.assign(new Error('O nome completo da pessoa é obrigatório (mínimo 3 caracteres).'), { status: 400 });
  }

  const cpfLimpo = registroRepository.normalizeCpf(dados.nr_cpf);
  if (cpfLimpo && cpfLimpo.length !== 11) {
    throw Object.assign(new Error('CPF inválido. O CPF deve conter 11 dígitos.'), { status: 400 });
  }

  if (cpfLimpo) {
    const existentes = await registroRepository.buscarPessoasPorCpf(cpfLimpo);
    const conflito = existentes.find(p => String(p.CD_PESSOA_FISICA) !== String(cdPessoaFisica));
    if (conflito) {
      throw Object.assign(new Error(`O CPF informado já está vinculado ao cadastro de: ${conflito.NM_PESSOA_FISICA}.`), { status: 409 });
    }
  }

  return registroRepository.atualizarPessoaFisica(cdPessoaFisica, dados, usuarioLogado);
}

async function listarHistorico(cdPessoaFisica, limit = 20) {
  return registroRepository.listarHistoricoPorPessoa(cdPessoaFisica, limit);
}

module.exports = {
  listarTiposRegistros,
  obterTipoRegistro,
  buscarPessoas,
  obterPessoa,
  cadastrarPessoa,
  atualizarPessoa,
  salvarRegistro,
  listarHistorico
};
