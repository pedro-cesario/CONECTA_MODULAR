const db = require('../../../core/database/index.js');
const oracledb = require('oracledb');

async function atualizarClassificacaoRisco(nrAtendimento, nrSeqTriagem, nmUsuario) {
  const conn = await db.getConnection();
  try {
    await conn.execute(
      `UPDATE atendimento_paciente
       SET nr_seq_triagem = :nrSeqTriagem,
           dt_atualizacao = SYSDATE,
           nm_usuario = :nmUsuario
       WHERE nr_atendimento = :nrAtendimento`,
      { nrSeqTriagem, nmUsuario, nrAtendimento },
      { autoCommit: true }
    );
    return true;
  } finally {
    if (conn) await conn.close();
  }
}

async function iniciarTriagem(nrAtendimento, nmUsuario) {
  const conn = await db.getConnection();
  try {
    await conn.execute(
      `UPDATE atendimento_paciente
       SET dt_inicio_atendimento = SYSDATE,
           dt_atualizacao = SYSDATE,
           nm_usuario = :nmUsuario
       WHERE nr_atendimento = :nrAtendimento
         AND dt_inicio_atendimento IS NULL`,
      { nmUsuario, nrAtendimento },
      { autoCommit: true }
    );
    return true;
  } finally {
    if (conn) await conn.close();
  }
}

async function finalizarTriagem(nrAtendimento, nmUsuario) {
  const conn = await db.getConnection();
  try {
    await conn.execute(
      `UPDATE atendimento_paciente
       SET dt_fim_triagem = SYSDATE,
           dt_atualizacao = SYSDATE,
           nm_usuario = :nmUsuario
       WHERE nr_atendimento = :nrAtendimento
         AND dt_fim_triagem IS NULL`,
      { nmUsuario, nrAtendimento },
      { autoCommit: true }
    );
    return true;
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = {
  atualizarClassificacaoRisco,
  iniciarTriagem,
  finalizarTriagem
};
