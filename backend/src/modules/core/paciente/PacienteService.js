const PacienteRepository = require('./PacienteRepository');
const { AppError } = require('../../../core/errors/AppError');

async function buscarPessoas(query) {
  if (!query || query.length < 3) {
    throw new AppError('Termo de busca deve ter no mínimo 3 caracteres', 400);
  }
  return await PacienteRepository.buscarPessoas(query);
}

async function verificarDuplicidade(dados) {
  return await PacienteRepository.verificarDuplicidadePaciente(dados);
}

async function salvarPessoa(dados, nmUsuario) {
  // Lógica comum extraída
  const dups = await PacienteRepository.verificarDuplicidadePaciente(dados);
  if (dups && dups.length > 0 && !dados.cd_pessoa_fisica) {
    throw new AppError('Já existe um paciente cadastrado com este CPF ou Data de Nascimento', 409, { duplicados: dups });
  }
  return await PacienteRepository.salvarPessoaFisica(dados, nmUsuario);
}

async function atribuirClassificacao(cdPessoaFisica, nrSeqClassif, nmUsuario, cdEstabelecimento = 1) {
  if (!cdPessoaFisica || !nrSeqClassif) {
    throw new AppError('Paciente e Classificação são obrigatórios.', 400);
  }
  return await PacienteRepository.atribuirClassificacaoPessoa({
    cdPessoaFisica, nrSeqClassif, cdEstabelecimento, nmUsuario
  });
}

/**
 * Cria um paciente não identificado de forma limpa, 
 * atribuindo a classificação parametrizada (geralmente vinda do Admin).
 */
async function criarPacienteNaoIdentificado(nrSeqClassif, nmUsuario, cdEstabelecimento = 1) {
  const dados = {
    nm_pessoa_fisica: 'Paciente não identificado',
    nr_cpf: null,
    dt_nascimento: null,
    nm_mae: null
  };
  const cdPessoaFisica = await PacienteRepository.salvarPessoaFisica(dados, nmUsuario);

  if (nrSeqClassif) {
    await PacienteRepository.atribuirClassificacaoPessoa({
      cdPessoaFisica, nrSeqClassif, cdEstabelecimento, nmUsuario
    });
  }
  return cdPessoaFisica;
}

module.exports = {
  buscarPessoas,
  verificarDuplicidade,
  salvarPessoa,
  atribuirClassificacao,
  criarPacienteNaoIdentificado
};
