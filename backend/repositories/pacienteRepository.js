const { getConnection } = require('../database');
const configCache = require('../config/configCache');

async function findBySetor(cdSetor) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
          a.nr_atendimento AS atendimento,
          b.nm_pessoa_fisica AS nm_pessoa_fisica,
          b.nm_social,
          a.cd_unidade,
          obter_desc_setor_atend(a.cd_setor_atendimento) AS setor,
          a.cd_setor_atendimento
        FROM atendimento_paciente_v a
        JOIN pessoa_fisica b ON a.cd_pessoa_fisica = b.cd_pessoa_fisica
        WHERE a.cd_setor_atendimento = :cd_setor
          AND a.dt_alta IS NULL
          AND a.dt_saida_unidade IS NULL
          AND (
                a.cd_setor_atendimento <> 39
                OR (
                     a.cd_setor_atendimento = 39
                     AND a.dt_entrada >= SYSDATE - 1
                   )
              )
        ORDER BY a.nr_atendimento`,
      { cd_setor: cdSetor }
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function findBySetores(cdSetores) {
  if (!Array.isArray(cdSetores) || cdSetores.length === 0) return [];
  
  const conn = await getConnection();
  try {
    const binds = {};
    const inClause = cdSetores.map((val, index) => {
      const key = `setor_${index}`;
      binds[key] = val;
      return `:${key}`;
    }).join(',');

    const result = await conn.execute(
      `SELECT
          a.nr_atendimento AS atendimento,
          b.nm_pessoa_fisica AS nm_pessoa_fisica,
          b.nm_social,
          a.cd_unidade,
          obter_desc_setor_atend(a.cd_setor_atendimento) AS setor,
          a.cd_setor_atendimento
        FROM atendimento_paciente_v a
        JOIN pessoa_fisica b ON a.cd_pessoa_fisica = b.cd_pessoa_fisica
        WHERE a.cd_setor_atendimento IN (${inClause})
          AND a.dt_alta IS NULL
          AND a.dt_saida_unidade IS NULL
          AND (
                a.cd_setor_atendimento <> 39
                OR (
                     a.cd_setor_atendimento = 39
                     AND a.dt_entrada >= SYSDATE - 1
                   )
              )
        ORDER BY a.nr_atendimento`,
      binds
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function findByAgendaEct() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
          ap.nr_atendimento AS atendimento,
          ap.nm_paciente AS nome,
          pf.nm_pessoa_fisica AS nm_pessoa_fisica,
          pf.nm_social,
          'ECT - Eletroconvulsoterapia' AS setor,
          47 AS cd_setor_atendimento,
          CASE 
            WHEN ap.cd_motivo_cancelamento IS NOT NULL THEN COALESCE(ap.dt_cancelamento, ap.dt_atualizacao)
            ELSE NULL
          END AS dt_cancelamento
        FROM agenda_paciente ap
        LEFT JOIN pessoa_fisica pf ON ap.cd_pessoa_fisica = pf.cd_pessoa_fisica
        WHERE TRUNC(ap.dt_agenda) = TRUNC(SYSDATE)
          AND ap.CD_AGENDA = :cdAgenda
          AND ap.CD_PROCEDIMENTO = :cdProcedimento
          AND (
            ap.cd_motivo_cancelamento IS NULL
            OR TRUNC(COALESCE(ap.dt_cancelamento, ap.dt_atualizacao)) = TRUNC(SYSDATE)
          )`,
      {
        cdAgenda: configCache.getSystemConfig()?.ect_cd_agenda || 138,
        cdProcedimento: configCache.getSystemConfig()?.ect_cd_procedimento || 20104170
      }
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function obterAgendasAtivas() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_agenda, ds_agenda FROM AGENDA WHERE IE_SITUACAO = 'A'`
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function obterProcedimentosAtivos() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT CD_PROCEDIMENTO, DS_PROC_EXAME FROM PROC_INTERNO WHERE IE_SITUACAO = 'A'`
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

module.exports = { findBySetor, findBySetores, findByAgendaEct, obterAgendasAtivas, obterProcedimentosAtivos };
