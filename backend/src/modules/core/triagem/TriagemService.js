const TriagemRepository = require('./TriagemRepository');
const { AppError } = require('../../../core/errors/AppError');

async function atualizarClassificacao(nrAtendimento, nrSeqTriagem, nmUsuario) {
  if (!nrAtendimento || !nrSeqTriagem) {
    throw new AppError('Atendimento e Classificação são obrigatórios.', 400);
  }
  return await TriagemRepository.atualizarClassificacaoRisco(nrAtendimento, nrSeqTriagem, nmUsuario);
}

async function iniciar(nrAtendimento, nmUsuario) {
  if (!nrAtendimento) throw new AppError('Atendimento obrigatório.', 400);
  return await TriagemRepository.iniciarTriagem(nrAtendimento, nmUsuario);
}

async function finalizar(nrAtendimento, nmUsuario) {
  if (!nrAtendimento) throw new AppError('Atendimento obrigatório.', 400);
  return await TriagemRepository.finalizarTriagem(nrAtendimento, nmUsuario);
}

module.exports = {
  atualizarClassificacao,
  iniciar,
  finalizar
};
