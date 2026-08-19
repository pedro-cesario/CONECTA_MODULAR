const { getConnection } = require('../database');

async function findByUsername(nmUsuario) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT nm_usuario, cd_pessoa_fisica, ie_profissional, obter_nome_usuario(nm_usuario) AS nome
       FROM usuario
       WHERE (UPPER(nm_usuario) = UPPER(:nm_usuario) OR UPPER(ds_login) = UPPER(:nm_usuario))
       AND ie_situacao = 'A'`,
      { nm_usuario: nmUsuario }
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    await conn.close();
  }
}

async function findTecnicos() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_pessoa_fisica,
              nm_usuario,
              obter_nome_usuario(nm_usuario) nome
       FROM usuario
       WHERE ie_tipo_evolucao = 13
       AND ie_situacao = 'A'
       ORDER BY nm_usuario`
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function findEnfermeiros() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_pessoa_fisica,
              nm_usuario,
              obter_nome_usuario(nm_usuario) nome
        FROM usuario
        WHERE ie_tipo_evolucao = 3
          AND ie_situacao = 'A'
        ORDER BY nm_usuario`
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function findProfissionaisSetor4(dataReferencia = null) {
  const conn = await getConnection();
  try {
    const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(String(dataReferencia || '')) ? dataReferencia : null;
    const result = await conn.execute(
      `SELECT cd_pessoa_fisica,
              nm_usuario,
              obter_nome_usuario(nm_usuario) AS nome,
              CASE WHEN :data_referencia IS NULL THEN 0 ELSE (
                SELECT COUNT(DISTINCT TO_CHAR(TRUNC(cea.dt_plantao), 'YYYYMMDD') || ':' || cea.ie_turno)
                FROM conecta_escala_ativa cea
                WHERE cea.ie_tipo = 'PSICOLOGO'
                  AND cea.cd_pessoa_fisica = usuario.cd_pessoa_fisica
                  AND TRUNC(cea.dt_plantao) >= TO_DATE(:data_referencia, 'YYYY-MM-DD') - 28
                  AND TRUNC(cea.dt_plantao) < TO_DATE(:data_referencia, 'YYYY-MM-DD')
              ) END AS plantoes_ultimas_4_semanas
        FROM usuario
        WHERE cd_setor_atendimento = 4
          AND ie_situacao = 'A'
          AND ie_tipo_evolucao IN (5, 16)
        ORDER BY nm_usuario`,
      { data_referencia: dataValida }
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

module.exports = { findByUsername, findTecnicos, findEnfermeiros, findProfissionaisSetor4 };
