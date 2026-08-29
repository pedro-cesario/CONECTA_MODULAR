const { getConnection } = require('../../core/database');

async function findAll() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_setor_atendimento, ds_setor_atendimento
       FROM setor_atendimento
       WHERE (cd_classif_setor = 3 OR cd_setor_atendimento = 39)
         AND cd_setor_atendimento NOT IN (59, 83, 68)
         AND ie_situacao = 'A'
       ORDER BY ds_setor_atendimento`
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function findAllAtivos() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_setor_atendimento, ds_setor_atendimento
       FROM setor_atendimento
       WHERE ie_situacao = 'A'
       ORDER BY ds_setor_atendimento`
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

module.exports = { findAll, findAllAtivos };