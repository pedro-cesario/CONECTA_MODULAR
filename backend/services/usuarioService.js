const usuarioRepository = require('../repositories/usuarioRepository');

async function listarTecnicos() {
  const rows = await usuarioRepository.findTecnicos();
  return rows.map(row => ({
    cd_pessoa_fisica: row.CD_PESSOA_FISICA,
    nm_usuario: row.NM_USUARIO,
    nome: row.NOME || row.NM_USUARIO
  }));
}

async function listarEnfermeiros() {
  const rows = await usuarioRepository.findEnfermeiros();
  return rows.map(row => ({
    cd_pessoa_fisica: row.CD_PESSOA_FISICA,
    nm_usuario: row.NM_USUARIO,
    nome: row.NOME || row.NM_USUARIO
  }));
}

async function listarProfissionaisSetor4(dataReferencia = null) {
  const rows = await usuarioRepository.findProfissionaisSetor4(dataReferencia);
  
  return rows.map(row => ({
    cd_pessoa_fisica: row.CD_PESSOA_FISICA,
    nm_usuario: row.NM_USUARIO,
    nome: row.NOME || row.NM_USUARIO,
    plantoes_ultimas_4_semanas: Number(row.PLANTOES_ULTIMAS_4_SEMANAS || 0)
  }));
}

module.exports = { listarTecnicos, listarEnfermeiros, listarProfissionaisSetor4 };
