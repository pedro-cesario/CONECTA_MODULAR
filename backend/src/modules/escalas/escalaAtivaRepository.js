const { getConnection } = require('../../core/database');

const DDL_TABLE = `
  CREATE TABLE CONECTA_ESCALA_ATIVA (
    NR_SEQUENCIA         NUMBER PRIMARY KEY,
    CD_SETOR_ATENDIMENTO NUMBER NOT NULL,
    DT_PLANTAO           DATE NOT NULL,
    IE_TURNO             VARCHAR2(1)  NOT NULL,
    NR_VERSAO            NUMBER DEFAULT 1,
    IE_TIPO              VARCHAR2(20) NOT NULL,
    CD_PESSOA_FISICA     NUMBER,
    NR_ATENDIMENTO       NUMBER,
    DS_OBSERVACAO        VARCHAR2(4000),
    DT_ATUALIZACAO       DATE DEFAULT SYSDATE,
    NM_USUARIO           VARCHAR2(100)
  )
`;

const DDL_LOG = `
  CREATE TABLE CONECTA_ESCALA_LOG (
    NR_SEQUENCIA         NUMBER PRIMARY KEY,
    CD_SETOR_ATENDIMENTO NUMBER NOT NULL,
    DT_PLANTAO           DATE NOT NULL,
    IE_TURNO             VARCHAR2(1)  NOT NULL,
    NR_VERSAO            NUMBER NOT NULL,
    IE_TIPO              VARCHAR2(20) NOT NULL,
    CD_PESSOA_FISICA     NUMBER,
    NR_ATENDIMENTO       NUMBER,
    DS_OBSERVACAO        VARCHAR2(4000),
    DT_CRIACAO           DATE DEFAULT SYSDATE,
    NM_USUARIO           VARCHAR2(100)
  )
`;

const DDL_SEQ = `CREATE SEQUENCE CONECTA_ESCALA_ATIVA_SEQ START WITH 1 INCREMENT BY 1`;

async function initTables() {
  const conn = await getConnection();
  try {
    const check = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM all_tables WHERE table_name = 'CONECTA_ESCALA_ATIVA' AND owner = 'TASY'`
    );
    if (check.rows[0].CNT === 0) {
      await conn.execute(DDL_TABLE);
      console.log('[DB] Tabela CONECTA_ESCALA_ATIVA criada');
    }

    const checkLog = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM all_tables WHERE table_name = 'CONECTA_ESCALA_LOG' AND owner = 'TASY'`
    );
    if (checkLog.rows[0].CNT === 0) {
      await conn.execute(DDL_LOG);
      console.log('[DB] Tabela CONECTA_ESCALA_LOG criada');
    }

    const checkSeq = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM all_sequences WHERE sequence_name = 'CONECTA_ESCALA_ATIVA_SEQ' AND sequence_owner = 'TASY'`
    );
    if (checkSeq.rows[0].CNT === 0) {
      await conn.execute(DDL_SEQ);
      console.log('[DB] Sequence CONECTA_ESCALA_ATIVA_SEQ criada');
    }

    await conn.commit();
  } finally {
    await conn.close();
  }
}

async function loadAtiva(cdSetor, dtPlantao, turno) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT NR_SEQUENCIA, CD_SETOR_ATENDIMENTO, TO_CHAR(DT_PLANTAO, 'YYYY-MM-DD') AS DT_PLANTAO,
              IE_TURNO, NR_VERSAO, IE_TIPO, CD_PESSOA_FISICA, NR_ATENDIMENTO,
              DS_OBSERVACAO, TO_CHAR(DT_ATUALIZACAO, 'YYYY-MM-DD HH24:MI:SS') AS DT_ATUALIZACAO, NM_USUARIO
       FROM CONECTA_ESCALA_ATIVA
       WHERE CD_SETOR_ATENDIMENTO = :cd_setor
         AND TRUNC(DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
         AND IE_TURNO = :ie_turno
       ORDER BY IE_TIPO, NR_SEQUENCIA`,
      { cd_setor: cdSetor, dt_plantao: dtPlantao, ie_turno: turno }
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function loadAtivasPorPeriodo(cdSetor, dataInicio, dataFim) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT NR_SEQUENCIA, CD_SETOR_ATENDIMENTO, TO_CHAR(DT_PLANTAO, 'YYYY-MM-DD') AS DT_PLANTAO,
              IE_TURNO, NR_VERSAO, IE_TIPO, CD_PESSOA_FISICA, NR_ATENDIMENTO,
              DS_OBSERVACAO, TO_CHAR(DT_ATUALIZACAO, 'YYYY-MM-DD HH24:MI:SS') AS DT_ATUALIZACAO, NM_USUARIO
       FROM CONECTA_ESCALA_ATIVA
       WHERE CD_SETOR_ATENDIMENTO = :cd_setor
         AND TRUNC(DT_PLANTAO) BETWEEN TO_DATE(:data_inicio, 'YYYY-MM-DD') AND TO_DATE(:data_fim, 'YYYY-MM-DD')
       ORDER BY DT_PLANTAO, IE_TURNO, IE_TIPO, NR_SEQUENCIA`,
      { cd_setor: cdSetor, data_inicio: dataInicio, data_fim: dataFim }
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function saveAtiva(payload, nmUsuario) {
  const conn = await getConnection();
  try {
    const { cd_setor_atendimento, dt_plantao, turno, items, expected_version } = payload;

    const checkResult = await conn.execute(
      `SELECT NR_VERSAO
       FROM CONECTA_ESCALA_ATIVA
       WHERE CD_SETOR_ATENDIMENTO = :cd_setor
         AND TRUNC(DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
         AND IE_TURNO = :ie_turno
       FOR UPDATE`,
      { cd_setor: cd_setor_atendimento, dt_plantao: dt_plantao, ie_turno: turno }
    );

    const cnt = checkResult.rows ? checkResult.rows.length : 0;
    const maxVerAtual = cnt > 0 ? Math.max(...checkResult.rows.map(r => r.NR_VERSAO || 0)) : 0;

    if (expected_version !== undefined && expected_version !== null) {
      if (maxVerAtual > 0 && maxVerAtual !== Number(expected_version)) {
        const err = new Error(`Conflito de concorrência: a escala foi alterada por outro usuário (versão no banco: ${maxVerAtual}, sua versão: ${expected_version}). Recarregue antes de salvar.`);
        err.status = 409;
        throw err;
      }
    }

    if (cnt > 0) {
      const versaoAnterior = maxVerAtual;
      await conn.execute(
        `INSERT INTO CONECTA_ESCALA_LOG
           (NR_SEQUENCIA, CD_SETOR_ATENDIMENTO, DT_PLANTAO, IE_TURNO, NR_VERSAO,
            IE_TIPO, CD_PESSOA_FISICA, NR_ATENDIMENTO, DS_OBSERVACAO, DT_CRIACAO, NM_USUARIO)
         SELECT CONECTA_ESCALA_ATIVA_SEQ.NEXTVAL, CD_SETOR_ATENDIMENTO, DT_PLANTAO, IE_TURNO, NR_VERSAO,
                IE_TIPO, CD_PESSOA_FISICA, NR_ATENDIMENTO, DS_OBSERVACAO, DT_ATUALIZACAO, NM_USUARIO
         FROM CONECTA_ESCALA_ATIVA
         WHERE CD_SETOR_ATENDIMENTO = :cd_setor
           AND TRUNC(DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
           AND IE_TURNO = :ie_turno`,
        { cd_setor: cd_setor_atendimento, dt_plantao: dt_plantao, ie_turno: turno }
      );

      await conn.execute(
        `DELETE FROM CONECTA_ESCALA_ATIVA
         WHERE CD_SETOR_ATENDIMENTO = :cd_setor
           AND TRUNC(DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
           AND IE_TURNO = :ie_turno`,
        { cd_setor: cd_setor_atendimento, dt_plantao: dt_plantao, ie_turno: turno }
      );
    }

    const novaVersao = cnt > 0 ? maxVerAtual + 1 : 1;

    const insertSql = `INSERT INTO CONECTA_ESCALA_ATIVA
      (NR_SEQUENCIA, CD_SETOR_ATENDIMENTO, DT_PLANTAO, IE_TURNO, NR_VERSAO,
       IE_TIPO, CD_PESSOA_FISICA, NR_ATENDIMENTO, DS_OBSERVACAO, DT_ATUALIZACAO, NM_USUARIO)
      VALUES (CONECTA_ESCALA_ATIVA_SEQ.NEXTVAL, :cd_setor, TO_DATE(:dt_plantao, 'YYYY-MM-DD'), :ie_turno, :nr_versao,
              :ie_tipo, :cd_pessoa, :nr_atendimento, :ds_obs, SYSDATE, :nm_usuario)`;

    for (const item of items) {
      await conn.execute(insertSql, {
        cd_setor: cd_setor_atendimento,
        dt_plantao: dt_plantao,
        ie_turno: turno,
        nr_versao: novaVersao,
        ie_tipo: item.ie_tipo,
        cd_pessoa: item.cd_pessoa_fisica || null,
        nr_atendimento: item.nr_atendimento || null,
        ds_obs: item.ds_observacao || null,
        nm_usuario: nmUsuario
      });
    }

    await conn.commit();
    return { inseridos: items.length, versao: novaVersao };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

async function loadVersoes(cdSetor, dtPlantao, turno) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT NR_VERSAO, TO_CHAR(MIN(dt_criacao), 'YYYY-MM-DD HH24:MI:SS') AS dt_criacao,
              MIN(nm_usuario) AS nm_usuario, COUNT(*) AS qtd_itens
       FROM CONECTA_ESCALA_LOG
       WHERE CD_SETOR_ATENDIMENTO = :cd_setor
         AND TRUNC(DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
         AND IE_TURNO = :ie_turno
       GROUP BY NR_VERSAO
       ORDER BY NR_VERSAO DESC`,
      { cd_setor: cdSetor, dt_plantao: dtPlantao, ie_turno: turno }
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function loadVersaoEspecifica(cdSetor, dtPlantao, turno, versao) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT IE_TIPO, CD_PESSOA_FISICA, NR_ATENDIMENTO, DS_OBSERVACAO
       FROM CONECTA_ESCALA_LOG
       WHERE CD_SETOR_ATENDIMENTO = :cd_setor
         AND TRUNC(DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
         AND IE_TURNO = :ie_turno
         AND NR_VERSAO = :nr_versao
       ORDER BY IE_TIPO, NR_SEQUENCIA`,
      { cd_setor: cdSetor, dt_plantao: dtPlantao, ie_turno: turno, nr_versao: versao }
    );
    return result.rows;
  } finally {
    await conn.close();
  }
}

async function findPatioCirculanteGlobal(dtPlantao, turno) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT DISTINCT a.IE_TIPO, a.CD_PESSOA_FISICA, a.CD_SETOR_ATENDIMENTO,
              obter_nome_usuario(u.nm_usuario) AS nome
       FROM CONECTA_ESCALA_ATIVA a
       JOIN usuario u ON u.cd_pessoa_fisica = a.CD_PESSOA_FISICA
       WHERE TRUNC(a.DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
         AND a.IE_TURNO = :ie_turno
         AND a.IE_TIPO IN ('PATIO', 'CIRCULANTE')
       ORDER BY a.IE_TIPO, nome`,
      { dt_plantao: dtPlantao, ie_turno: turno }
    );

    const patio = [];
    const circulante = [];

    for (const row of (result.rows || [])) {
      const entry = {
        cd_pessoa_fisica: Number(row.CD_PESSOA_FISICA),
        nome: row.NOME || '',
        cd_setor_atendimento: Number(row.CD_SETOR_ATENDIMENTO)
      };
      if (row.IE_TIPO === 'PATIO') {
        patio.push(entry);
      } else if (row.IE_TIPO === 'CIRCULANTE') {
        circulante.push(entry);
      }
    }

    return {
      locked: patio.length > 0 || circulante.length > 0,
      patio,
      circulante
    };
  } finally {
    await conn.close();
  }
}

module.exports = { initTables, loadAtiva, loadAtivasPorPeriodo, saveAtiva, loadVersoes, loadVersaoEspecifica, findPatioCirculanteGlobal };
