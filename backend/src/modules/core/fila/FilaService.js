const FilaRepository = require('./FilaRepository');

async function chamarProximaSenha(nrSeqFila, dsMaquina, nmUsuario) {
  return await FilaRepository.chamarProximaSenha(nrSeqFila, dsMaquina, nmUsuario);
}

async function inutilizarSenha(nrSeqSenha, cdSenhaGerada, cdFila, nmUsuario, nrSeqMotivo) {
  return await FilaRepository.inutilizarSenha(nrSeqSenha, cdSenhaGerada, cdFila, nmUsuario, nrSeqMotivo);
}

async function transferirFila(nrSeqFilaNova, nrSeqFilaAtual, nrSeqSenha, cdSenhaGerada = 0) {
  return await FilaRepository.transferirPacienteFila(nrSeqFilaNova, nrSeqFilaAtual, nrSeqSenha, cdSenhaGerada);
}

module.exports = {
  chamarProximaSenha,
  inutilizarSenha,
  transferirFila
};
