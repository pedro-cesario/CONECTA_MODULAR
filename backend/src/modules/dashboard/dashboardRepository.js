const { getConnection } = require('../../core/database');
const configCache = require('../../core/config/configCache');

function getInicioPlantao(turno) {
  const now = new Date();
  const hora = now.getHours();

  const turnoEfetivo = turno || (hora >= 7 && hora < 19 ? 'M' : 'N');

  let dtInicio;

  if (turnoEfetivo === 'M') {
    dtInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
  } else {
    const ontem = new Date(now);
    ontem.setDate(ontem.getDate() - 1);
    dtInicio = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 19, 0, 0);
  }

  return dtInicio;
}

async function findSetoresInternacao() {
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

async function findPacientesComStatus(cdSetor, turno) {
  const conn = await getConnection();
  const setorNum = Number(cdSetor);
  const setorStr = String(cdSetor);

  if (!Number.isInteger(setorNum) || setorNum <= 0) {
    throw new Error('Setor inválido');
  }

  const dtInicioPlantao = getInicioPlantao(turno);

  try {
    const atendimentosResult = await conn.execute(
      `SELECT a.nr_atendimento
       FROM atendimento_paciente_v a
       WHERE a.cd_setor_atendimento = :cd_setor
         AND a.dt_alta IS NULL
         AND a.dt_saida_unidade IS NULL`,
      { cd_setor: setorStr }
    );

    const atendimentos = (atendimentosResult.rows || [])
      .map((row) => row.NR_ATENDIMENTO)
      .filter((nrAtendimento) => nrAtendimento !== null && nrAtendimento !== undefined);

    if (atendimentos.length === 0) {
      return [];
    }

    const bindsPacientes = { cd_setor: setorStr };
    atendimentos.forEach((nrAtendimento, index) => {
      bindsPacientes[`at${index}`] = nrAtendimento;
    });
    const placeholders = atendimentos.map((_, index) => `:at${index}`).join(', ');

    const pacientesResult = await conn.execute(
      `SELECT
         a.nr_atendimento,
         b.nm_pessoa_fisica nome,
         b.nm_social,
         a.cd_unidade unidade,
         decode(c.nr_seq_classificacao, 1, 'Involuntário', 2, 'Voluntário', 3, 'Compulsória / determinação judicial') classific_atend,
         obter_desc_convenio(obter_convenio_atendimento(a.nr_atendimento)) AS convenio,
         a.cd_setor_atendimento,
         obter_desc_setor_atend(a.cd_setor_atendimento) AS setor
       FROM atendimento_paciente_v a, pessoa_fisica b, atendimento_paciente c
       WHERE a.nr_atendimento IN (${placeholders})
         AND a.nr_atendimento = c.nr_atendimento
         AND a.cd_pessoa_fisica = b.cd_pessoa_fisica
         AND a.cd_setor_atendimento = :cd_setor
         AND a.dt_alta IS NULL
         AND a.dt_saida_unidade IS NULL
         AND (
               a.cd_setor_atendimento <> 39
               OR (
                    a.cd_setor_atendimento = 39
                    AND a.dt_entrada >= SYSDATE - 2
                  )
             )`,
      bindsPacientes
    );

    const pacientes = pacientesResult.rows || [];

    const binds = { dt_inicio_plantao: dtInicioPlantao };
    const bindsAtendimentos = {};
    atendimentos.forEach((nrAtendimento, index) => {
      binds[`at${index}`] = nrAtendimento;
      bindsAtendimentos[`at${index}`] = nrAtendimento;
    });

    // CARD_VERMELHO: prescrição de agora pendente de checagem (adep_pend_v)
    const cardVermelhoResult = await conn.execute(
      `SELECT 'CARD_VERMELHO' AS tipo, nr_atendimento
       FROM adep_pend_v
       WHERE nr_atendimento IN (${placeholders})
         AND cd_intervalo = '228'
         AND TRUNC(dt_prescricao) =
             CASE
                WHEN TO_NUMBER(TO_CHAR(SYSDATE, 'HH24')) < 7
                     THEN TRUNC(SYSDATE) - 1
                ELSE TRUNC(SYSDATE)
             END
       GROUP BY nr_atendimento`,
      bindsAtendimentos
    );

    // Demais cards: queries individuais sequenciais
    const cardLaranjaResult = await conn.execute(
      `SELECT 'CARD_LARANJA' AS tipo, nr_atendimento
       FROM cpoe_material
       WHERE nr_atendimento IN (${placeholders})
         AND dt_atualizacao >= TRUNC(SYSDATE)
         AND dt_atualizacao < TRUNC(SYSDATE) + 1
         AND dt_suspensao IS NOT NULL
       GROUP BY nr_atendimento`,
      bindsAtendimentos
    );

    const cardAmareloResult = await conn.execute(
      `SELECT 'CARD_AMARELO' AS tipo, nr_atendimento
       FROM adep_pend_v
       WHERE nr_atendimento IN (${placeholders})
         AND DT_PRESCRICAO >= :dt_inicio_plantao
       GROUP BY nr_atendimento`,
      binds
    );

    const cardVerdeResult = await conn.execute(
      `SELECT 'CARD_VERDE' AS tipo, nr_atendimento
       FROM cpoe_procedimento
       WHERE nr_atendimento IN (${placeholders})
         AND nr_seq_proc_interno IN (997, 1023)
         AND cd_intervalo = 'SN'
       GROUP BY nr_atendimento`,
      bindsAtendimentos
    );

    const cardAzulResult = await conn.execute(
      `SELECT 'CARD_AZUL' AS tipo, nr_atendimento
       FROM atendimento_paciente
       WHERE nr_atendimento IN (${placeholders})
         AND dt_alta_medico IS NOT NULL
         AND dt_alta IS NULL
       GROUP BY nr_atendimento`,
      bindsAtendimentos
    );

    const cardLaranja2Result = await conn.execute(
      `SELECT 'CARD_LARANJA_2' AS tipo, a.nr_atendimento
       FROM cpoe_material a, MATERIAL b
       WHERE a.nr_atendimento IN (${placeholders})
         AND a.cd_intervalo = '228'
         AND b.NR_SEQ_GRUPO_REC = 2
         AND a.dt_inicio >= :dt_inicio_plantao
         AND a.cd_material = b.cd_material
       GROUP BY a.nr_atendimento`,
      binds
    );

    // Merge de todos os resultados
    const allStatusRows = [
      ...(cardVermelhoResult.rows || []),
      ...(cardLaranjaResult.rows || []),
      ...(cardAmareloResult.rows || []),
      ...(cardVerdeResult.rows || []),
      ...(cardAzulResult.rows || []),
      ...(cardLaranja2Result.rows || [])
    ];

    const prescricoesAgoraResult = await conn.execute(
      `SELECT
         a.nr_atendimento,
         obter_desc_material(a.cd_material) mat_med_prescrito_agora
       FROM cpoe_material a, MATERIAL b
       WHERE a.cd_intervalo = '228'
         AND b.NR_SEQ_GRUPO_REC = 1
         AND TRUNC(a.dt_inicio) = TRUNC(SYSDATE)
         AND a.cd_material = b.cd_material
         AND a.dt_suspensao IS NULL
         AND a.nr_atendimento IN (${placeholders})`,
      bindsAtendimentos
    );

    // NEWS: Query 1 - Buscar última data de atualização de cada paciente
    const newsMaxDateBinds = {};
    atendimentos.forEach((nrAtendimento, index) => {
      newsMaxDateBinds[`n${index}`] = nrAtendimento;
    });
    const newsPlaceholders = atendimentos.map((_, index) => `:n${index}`).join(', ');

    const newsMaxResult = await conn.execute(
      `SELECT nr_atendimento, MAX(dt_atualizacao) AS max_dt
       FROM escala_news
       WHERE nr_atendimento IN (${newsPlaceholders})
         AND dt_liberacao IS NOT NULL
         AND dt_inativacao IS NULL
       GROUP BY nr_atendimento`,
      newsMaxDateBinds
    );

    // NEWS: Query 2 - Buscar dados NEWS usando tuplas (nr_atendimento, dt_atualizacao)
    const newsMaxRows = newsMaxResult.rows || [];
    const newsMap = new Map();

    if (newsMaxRows.length > 0) {
      const orConditions = [];
      const newsDataBinds = {};

      newsMaxRows.forEach((row, index) => {
        orConditions.push(`(nr_atendimento = :a${index} AND dt_atualizacao = :b${index})`);
        newsDataBinds[`a${index}`] = row.NR_ATENDIMENTO;
        newsDataBinds[`b${index}`] = row.MAX_DT;
      });

      const newsDataResult = await conn.execute(
        `SELECT nr_atendimento, QT_PONTUACAO, obter_resultado_news(nr_atendimento) resultado
         FROM escala_news
         WHERE (${orConditions.join(' OR ')})
           AND dt_liberacao IS NOT NULL
           AND dt_inativacao IS NULL`,
        newsDataBinds
      );

      (newsDataResult.rows || []).forEach((row) => {
        newsMap.set(row.NR_ATENDIMENTO, {
          pontuacao: row.QT_PONTUACAO,
          resultado: row.RESULTADO || '-'
        });
      });
    }

    const statusMap = new Map();
    allStatusRows.forEach((row) => {
      const nrAtendimento = row.NR_ATENDIMENTO;
      const tipo = row.TIPO;

      if (!statusMap.has(nrAtendimento)) {
        statusMap.set(nrAtendimento, new Set());
      }

      statusMap.get(nrAtendimento).add(tipo);
    });

    const prescricoesAgoraMap = new Map();
    (prescricoesAgoraResult.rows || []).forEach((row) => {
      const nrAtendimento = row.NR_ATENDIMENTO;
      const descricao = String(row.MAT_MED_PRESCRITO_AGORA || '').trim();

      if (!descricao) return;

      if (!prescricoesAgoraMap.has(nrAtendimento)) {
        prescricoesAgoraMap.set(nrAtendimento, new Set());
      }

      prescricoesAgoraMap.get(nrAtendimento).add(descricao);
    });

    return pacientes.map((paciente) => {
      const status = new Set(statusMap.get(paciente.NR_ATENDIMENTO) || []);

      const prescricoesAgora = Array.from(
        prescricoesAgoraMap.get(paciente.NR_ATENDIMENTO) || []
      );

      const news = newsMap.get(paciente.NR_ATENDIMENTO) || null;

      return {
        NR_ATENDIMENTO: paciente.NR_ATENDIMENTO,
        NOME: paciente.NOME || '-',
        NM_PESSOA_FISICA: paciente.NOME || '-',
        NM_SOCIAL: paciente.NM_SOCIAL,
        CONVENIO: paciente.CONVENIO || '-',
        CD_UNIDADE: paciente.UNIDADE,
        CLASSIFIC_ATEND: paciente.CLASSIFIC_ATEND || '-',
        CD_SETOR_ATENDIMENTO: paciente.CD_SETOR_ATENDIMENTO,
        SETOR: paciente.SETOR || '-',
        STATUS: status,
        PRESCRICOES_AGORA: prescricoesAgora,
        NEWS_PONTUACAO: news ? news.pontuacao : null,
        NEWS_RESULTADO: news ? news.resultado : null,
      };
    });
  } finally {
    await conn.close();
  }
}

async function findPacientesParticularesAlta() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         a.nr_atendimento,
         b.nm_pessoa_fisica nome,
         b.nm_social,
         a.cd_unidade unidade,
         obter_desc_convenio(obter_convenio_atendimento(a.nr_atendimento)) AS convenio,
         a.cd_setor_atendimento,
         obter_desc_setor_atend(a.cd_setor_atendimento) AS setor
       FROM atendimento_paciente_v a
       INNER JOIN pessoa_fisica b ON a.cd_pessoa_fisica = b.cd_pessoa_fisica
        WHERE a.cd_convenio = 1
          AND a.cd_setor_atendimento = 39
          AND a.dt_alta >= SYSDATE - 1
        GROUP BY a.nr_atendimento, b.nm_pessoa_fisica, b.nm_social, a.cd_unidade, a.cd_setor_atendimento
        ORDER BY b.nm_pessoa_fisica`
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function findPacientesAltaMedica() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         c.nr_atendimento,
         d.nm_pessoa_fisica nome,
         d.nm_social,
         c.cd_unidade unidade,
         obter_desc_convenio(obter_convenio_atendimento(c.nr_atendimento)) AS convenio,
         c.cd_setor_atendimento,
         obter_desc_setor_atend(c.cd_setor_atendimento) AS setor
       FROM ehr_registro a
       INNER JOIN atendimento_paciente_v c ON c.nr_atendimento = a.nr_atendimento
       INNER JOIN pessoa_fisica d ON c.cd_pessoa_fisica = d.cd_pessoa_fisica
       WHERE a.nr_seq_templ = 100084
          AND a.dt_liberacao >= SYSDATE - 1
          AND a.dt_inativacao IS NULL
        GROUP BY c.nr_atendimento, d.nm_pessoa_fisica, d.nm_social, c.cd_unidade, c.cd_setor_atendimento
        ORDER BY d.nm_pessoa_fisica`,
      []
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function findPacientesSalaObservacao() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         a.nr_atendimento,
         b.nm_pessoa_fisica nome,
         b.nm_social,
         a.cd_unidade unidade,
         obter_desc_convenio(obter_convenio_atendimento(a.nr_atendimento)) AS convenio,
         a.cd_setor_atendimento,
         obter_desc_setor_atend(a.cd_setor_atendimento) AS setor
       FROM atendimento_paciente_v a
       INNER JOIN pessoa_fisica b ON a.cd_pessoa_fisica = b.cd_pessoa_fisica
        WHERE a.cd_setor_atendimento = 37
          AND a.dt_entrada >= SYSDATE - 1
        GROUP BY a.nr_atendimento, b.nm_pessoa_fisica, b.nm_social, a.cd_unidade, a.cd_setor_atendimento
        ORDER BY b.nm_pessoa_fisica`
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function findPacientesIndicacaoInternacao() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         nr_atendimento,
         nome,
         nm_social,
         unidade,
         cd_convenio,
         convenio,
         cd_setor_atendimento,
         setor,
         nr_seq_templ
       FROM (
         SELECT
           c.nr_atendimento,
           d.nm_pessoa_fisica nome,
           d.nm_social,
           c.cd_unidade unidade,
           obter_convenio_atendimento(c.nr_atendimento) AS cd_convenio,
           obter_desc_convenio(obter_convenio_atendimento(c.nr_atendimento)) AS convenio,
           c.cd_setor_atendimento,
           obter_desc_setor_atend(c.cd_setor_atendimento) AS setor,
           a.nr_seq_templ,
           ROW_NUMBER() OVER (PARTITION BY c.nr_atendimento ORDER BY a.dt_liberacao DESC) AS rn
         FROM ehr_registro a
         INNER JOIN atendimento_paciente_v c ON c.nr_atendimento = a.nr_atendimento
         INNER JOIN pessoa_fisica d ON c.cd_pessoa_fisica = d.cd_pessoa_fisica
          WHERE a.nr_seq_templ IN (100083, 100082)
            AND a.dt_inativacao IS NULL
            AND a.dt_liberacao IS NOT NULL
            AND a.dt_liberacao >= SYSDATE - 1
            AND NOT EXISTS (
              SELECT 1
              FROM GESTAO_VAGA g
              JOIN GESTAO_VAGA_HIST h ON h.NR_SEQ_GESTAO = g.NR_SEQUENCIA
              WHERE g.NR_ATENDIMENTO = c.nr_atendimento
                AND g.IE_TIPO_VAGA = 'PSI'
                AND h.NR_SEQ_MOTIVO_HISTORICO IN (1, 2)
            )
        )
        WHERE rn = 1
        ORDER BY nome`,
      []
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function findPacientesDecididos() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         nr_atendimento,
         nome,
         nm_social,
         unidade,
         cd_convenio,
         convenio,
         cd_setor_atendimento,
         setor,
         nr_seq_templ,
         decisao,
         dt_decisao,
         nm_usuario_decisao,
         decidido_por,
         motivo,
         cd_setor_desejado,
         ds_setor_desejado
       FROM (
         SELECT
           c.nr_atendimento,
           d.nm_pessoa_fisica nome,
           d.nm_social,
           c.cd_unidade unidade,
           obter_convenio_atendimento(c.nr_atendimento) AS cd_convenio,
           obter_desc_convenio(obter_convenio_atendimento(c.nr_atendimento)) AS convenio,
           c.cd_setor_atendimento,
           obter_desc_setor_atend(c.cd_setor_atendimento) AS setor,
           ind.nr_seq_templ,
            CASE WHEN h.NR_SEQ_MOTIVO_HISTORICO = 1 THEN 'aceito' ELSE 'recusado' END AS decisao,
            TO_CHAR(h.DT_HISTORICO, 'YYYY-MM-DD HH24:MI:SS') AS dt_decisao,
            h.NM_USUARIO AS nm_usuario_decisao,
           obter_nome_usuario(h.NM_USUARIO) AS decidido_por,
           h.DS_HISTORICO AS motivo,
           g.cd_setor_desejado,
           obter_desc_setor_atend(g.cd_setor_desejado) AS ds_setor_desejado,
           ROW_NUMBER() OVER (PARTITION BY c.nr_atendimento ORDER BY h.DT_HISTORICO DESC) AS rn
         FROM (
           SELECT c2.nr_atendimento, a.nr_seq_templ
           FROM ehr_registro a
           INNER JOIN atendimento_paciente_v c2 ON c2.nr_atendimento = a.nr_atendimento
           WHERE a.nr_seq_templ IN (100083, 100082)
             AND a.dt_inativacao IS NULL
             AND a.dt_liberacao IS NOT NULL
             AND a.dt_liberacao >= SYSDATE - 1
         ) ind
         INNER JOIN atendimento_paciente_v c ON c.nr_atendimento = ind.nr_atendimento
         INNER JOIN pessoa_fisica d ON c.cd_pessoa_fisica = d.cd_pessoa_fisica
         INNER JOIN GESTAO_VAGA g ON g.NR_ATENDIMENTO = ind.nr_atendimento AND g.IE_TIPO_VAGA = 'PSI'
         INNER JOIN GESTAO_VAGA_HIST h ON h.NR_SEQ_GESTAO = g.NR_SEQUENCIA AND h.NR_SEQ_MOTIVO_HISTORICO IN (1, 2)
       )
       WHERE rn = 1
       ORDER BY nome`,
      []
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function findDetalhesInternacao(nrAtendimento, nrSeqTempl) {
  const conn = await getConnection();
  try {
    let conteudos;
    if (nrSeqTempl == 100082) {
      conteudos = [289669, 289670];
    } else {
      conteudos = [289673, 289674, 289675];
    }

    const placeholders = conteudos.map((_, i) => `:c${i}`).join(', ');
    const binds = { nr_atendimento: nrAtendimento };
    conteudos.forEach((c, i) => { binds[`c${i}`] = c; });

    const result = await conn.execute(
      `SELECT ds_resultado, nr_seq_temp_conteudo
       FROM (
         SELECT
           a.ds_resultado,
           a.nr_seq_temp_conteudo,
           ROW_NUMBER() OVER (
             PARTITION BY a.nr_seq_temp_conteudo
             ORDER BY a.dt_atualizacao DESC
           ) AS rn
         FROM
           ehr_reg_elemento a
           JOIN ehr_reg_template b ON a.nr_seq_reg_template = b.nr_sequencia
           JOIN ehr_registro c ON b.nr_seq_reg = c.nr_sequencia
         WHERE
           c.nr_atendimento = :nr_atendimento
           AND c.dt_inativacao IS NULL
           AND c.dt_liberacao IS NOT NULL
           AND a.nr_seq_temp_conteudo IN (${placeholders})
       )
       WHERE rn = 1`,
      binds
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function aceitarInternacao(nrAtendimento, nmUsuario, motivo, cdPessoaFisica, cdSetorDesejado, cdConvenio) {
  const conn = await getConnection();
  try {
    const exists = await conn.execute(
      `SELECT NR_SEQUENCIA FROM GESTAO_VAGA WHERE NR_ATENDIMENTO = :nr_atendimento AND IE_TIPO_VAGA = 'PSI'`,
      { nr_atendimento: nrAtendimento }
    );

    if (exists.rows.length > 0 && (!motivo || !String(motivo).trim())) {
      const err = new Error('Justifique o motivo da alteração da decisão');
      err.status = 400;
      throw err;
    }

    await conn.execute(`BEGIN wheb_usuario_pck.set_ie_executar_trigger('N'); END;`);

    if (exists.rows.length > 0) {
      await conn.execute(
        `UPDATE GESTAO_VAGA
         SET IE_STATUS = 'O',
             CD_SETOR_DESEJADO = :cd_setor_desejado,
             CD_CONVENIO = :cd_convenio,
             DT_ATUALIZACAO = SYSDATE,
             NM_USUARIO = :nm_usuario
         WHERE nr_atendimento = :nr_atendimento AND IE_TIPO_VAGA = 'PSI'`,
        { nr_atendimento: nrAtendimento, cd_setor_desejado: cdSetorDesejado || null, cd_convenio: cdConvenio || 1, nm_usuario: nmUsuario }
      );
    } else {
      await conn.execute(
        `INSERT INTO GESTAO_VAGA (
          NR_SEQUENCIA, CD_ESTABELECIMENTO, DT_ATUALIZACAO, NM_USUARIO,
          DT_SOLICITACAO, IE_SOLICITACAO, CD_CONVENIO, IE_STATUS,
          IE_TIPO_VAGA, NR_ATENDIMENTO, CD_SETOR_DESEJADO,
          DT_ATUALIZACAO_NREC, NM_USUARIO_NREC
        ) VALUES (
          GESTAO_VAGA_SEQ.NEXTVAL, 1, SYSDATE, :nm_usuario,
          SYSDATE, 'I', :cd_convenio, 'O',
          'PSI', :nr_atendimento, :cd_setor_desejado,
          SYSDATE, :nm_usuario
        )`,
        {
          nr_atendimento: nrAtendimento,
          nm_usuario: nmUsuario,
          cd_convenio: cdConvenio || 1,
          cd_setor_desejado: cdSetorDesejado || null
        }
      );
    }

    await conn.execute(
      `INSERT INTO GESTAO_VAGA_HIST (
        NR_SEQUENCIA,
        NR_SEQ_GESTAO,
        DT_ATUALIZACAO,
        NM_USUARIO,
        DT_HISTORICO,
        CD_PESSOA_FISICA,
        DT_ATUALIZACAO_NREC,
        NM_USUARIO_NREC,
        DT_LIBERACAO,
        NM_USUARIO_LIBERACAO,
        DS_HISTORICO,
        NR_SEQ_MOTIVO_HISTORICO
      )
      SELECT
        GESTAO_VAGA_HIST_SEQ.NEXTVAL,
        a.NR_SEQUENCIA,
        SYSDATE,
        a.NM_USUARIO,
        SYSDATE,
        :cd_pessoa_fisica,
        SYSDATE,
        :nm_usuario,
        SYSDATE,
        :nm_usuario,
        :motivo,
        1
      FROM GESTAO_VAGA a
      WHERE a.NR_ATENDIMENTO = :nr_atendimento AND a.IE_TIPO_VAGA = 'PSI'`,
      { nr_atendimento: nrAtendimento, nm_usuario: nmUsuario, motivo: motivo || 'Aceito via Dashboard P.A.', cd_pessoa_fisica: cdPessoaFisica }
    );

    await conn.execute(`BEGIN wheb_usuario_pck.set_ie_executar_trigger('S'); END;`);

    await conn.commit();
    let warnings = [];

    // Tenta transferir a senha se houver configuração de fila destino e a decisão for Aceitar ('O')
    try {
      const configPA = configCache.getDashboardPAConfig();
      if (configPA && configPA.nr_sequencia_fila) {
        const nrFilaDestino = configPA.nr_sequencia_fila;

        // Busca se existe senha vinculada ativa para o atendimento
        const pwQuery = await conn.execute(
          `SELECT
             ap.nr_seq_pac_senha_fila,
             psf.cd_senha_gerada,
             psf.nr_seq_fila_senha as nr_fila_origem,
             psf.ds_maquina_chamada as ds_maquina,
             (SELECT h.ds_maquina_chamada
              FROM (
                SELECT h2.ds_maquina_chamada
                FROM paciente_senha_fila_hist h2
                WHERE h2.nr_seq_senha = ap.nr_seq_pac_senha_fila
                  AND h2.ds_maquina_chamada IS NOT NULL
                  AND h2.dt_atualizacao >= SYSDATE - 1
                ORDER BY h2.dt_atualizacao DESC
              ) h
              WHERE ROWNUM = 1) as ds_maquina_hist
           FROM atendimento_paciente ap
           LEFT JOIN paciente_senha_fila psf ON psf.nr_sequencia = ap.nr_seq_pac_senha_fila
           WHERE ap.nr_atendimento = :nr_atendimento
             AND psf.dt_inutilizacao IS NULL`,
          { nr_atendimento: nrAtendimento }
        );

        if (pwQuery.rows.length > 0 && pwQuery.rows[0].NR_SEQ_PAC_SENHA_FILA) {
          const pwd = pwQuery.rows[0];

          if (pwd.NR_FILA_ORIGEM !== nrFilaDestino) {
            const dsMaquina = pwd.DS_MAQUINA || pwd.DS_MAQUINA_HIST || '';

            await conn.execute(
              `UPDATE paciente_senha_fila 
               SET nr_seq_fila_senha = :nr_fila_destino,
                   dt_fim_atendimento = NULL
               WHERE nr_sequencia = :nr_seq_senha`,
              {
                nr_fila_destino: nrFilaDestino,
                nr_seq_senha: pwd.NR_SEQ_PAC_SENHA_FILA
              }
            );

            await conn.execute(
              `UPDATE paciente_senha_fila 
               SET dt_primeira_chamada = SYSDATE,
                   dt_chamada = SYSDATE,
                   ds_maquina_chamada = :ds_maquina
               WHERE nr_sequencia = :nr_seq_senha`,
              {
                nr_seq_senha: pwd.NR_SEQ_PAC_SENHA_FILA,
                ds_maquina: dsMaquina
              }
            );

            await conn.commit();
          }
        }
      }
    } catch (pwErr) {
      console.error('[Dashboard P.A.] Erro ao transferir senha da vaga aceita:', pwErr.message);
      warnings.push({
        code: 'SENHA_TRANSFERENCIA_FALHOU',
        message: 'A internação foi aceita, mas ocorreu uma falha ao tentar transferir a senha no TASY.'
      });
    }

    return { success: true, warnings: warnings.length ? warnings : undefined };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    try {
      await conn.execute(`BEGIN wheb_usuario_pck.set_ie_executar_trigger('S'); END;`);
    } catch (e) {}
    await conn.close();
  }
}

async function recusarInternacao(nrAtendimento, nmUsuario, motivo, cdPessoaFisica, cdSetorDesejado, cdConvenio) {
  const conn = await getConnection();
  try {
    const exists = await conn.execute(
      `SELECT NR_SEQUENCIA FROM GESTAO_VAGA WHERE NR_ATENDIMENTO = :nr_atendimento AND IE_TIPO_VAGA = 'PSI'`,
      { nr_atendimento: nrAtendimento }
    );

    if (exists.rows.length > 0 && (!motivo || !String(motivo).trim())) {
      const err = new Error('Justifique o motivo da alteração da decisão');
      err.status = 400;
      throw err;
    }

    await conn.execute(`BEGIN wheb_usuario_pck.set_ie_executar_trigger('N'); END;`);

    if (exists.rows.length > 0) {
      await conn.execute(
        `UPDATE GESTAO_VAGA
         SET IE_STATUS = 'N',
             CD_SETOR_DESEJADO = :cd_setor_desejado,
             CD_CONVENIO = :cd_convenio,
             DT_ATUALIZACAO = SYSDATE,
             NM_USUARIO = :nm_usuario
         WHERE nr_atendimento = :nr_atendimento AND IE_TIPO_VAGA = 'PSI'`,
        { nr_atendimento: nrAtendimento, cd_setor_desejado: cdSetorDesejado || null, cd_convenio: cdConvenio || 1, nm_usuario: nmUsuario }
      );
    } else {
      await conn.execute(
        `INSERT INTO GESTAO_VAGA (
          NR_SEQUENCIA, CD_ESTABELECIMENTO, DT_ATUALIZACAO, NM_USUARIO,
          DT_SOLICITACAO, IE_SOLICITACAO, CD_CONVENIO, IE_STATUS,
          IE_TIPO_VAGA, NR_ATENDIMENTO, CD_SETOR_DESEJADO,
          DT_ATUALIZACAO_NREC, NM_USUARIO_NREC
        ) VALUES (
          GESTAO_VAGA_SEQ.NEXTVAL, 1, SYSDATE, :nm_usuario,
          SYSDATE, 'I', :cd_convenio, 'N',
          'PSI', :nr_atendimento, :cd_setor_desejado,
          SYSDATE, :nm_usuario
        )`,
        {
          nr_atendimento: nrAtendimento,
          nm_usuario: nmUsuario,
          cd_convenio: cdConvenio || 1,
          cd_setor_desejado: cdSetorDesejado || null
        }
      );
    }

    await conn.execute(
      `INSERT INTO GESTAO_VAGA_HIST (
        NR_SEQUENCIA,
        NR_SEQ_GESTAO,
        DT_ATUALIZACAO,
        NM_USUARIO,
        DT_HISTORICO,
        CD_PESSOA_FISICA,
        DT_ATUALIZACAO_NREC,
        NM_USUARIO_NREC,
        DT_LIBERACAO,
        NM_USUARIO_LIBERACAO,
        DS_HISTORICO,
        NR_SEQ_MOTIVO_HISTORICO
      )
      SELECT
        GESTAO_VAGA_HIST_SEQ.NEXTVAL,
        a.NR_SEQUENCIA,
        SYSDATE,
        a.NM_USUARIO,
        SYSDATE,
        :cd_pessoa_fisica,
        SYSDATE,
        :nm_usuario,
        SYSDATE,
        :nm_usuario,
        :motivo,
        2
      FROM GESTAO_VAGA a
      WHERE a.NR_ATENDIMENTO = :nr_atendimento AND a.IE_TIPO_VAGA = 'PSI'`,
      { nr_atendimento: nrAtendimento, nm_usuario: nmUsuario, motivo: motivo || 'Recusado via Dashboard P.A.', cd_pessoa_fisica: cdPessoaFisica }
    );

    await conn.execute(`BEGIN wheb_usuario_pck.set_ie_executar_trigger('S'); END;`);

    await conn.commit();
    let warnings = [];

    // Tenta inutilizar/remover a senha da fila administrativa se a decisão final for RECUSAR ('N') e ela estiver na fila 18
    try {
      const configPA = configCache.getDashboardPAConfig();
      if (configPA && configPA.nr_sequencia_fila) {
        const nrFilaDestino = configPA.nr_sequencia_fila;

        const pwQuery = await conn.execute(
          `SELECT
             ap.nr_seq_pac_senha_fila,
             psf.cd_senha_gerada,
             psf.nr_seq_fila_senha as nr_fila_atual,
             psf.nr_seq_fila_senha_origem
           FROM atendimento_paciente ap
           LEFT JOIN paciente_senha_fila psf ON psf.nr_sequencia = ap.nr_seq_pac_senha_fila
           WHERE ap.nr_atendimento = :nr_atendimento
             AND psf.dt_inutilizacao IS NULL`,
          { nr_atendimento: nrAtendimento }
        );

        if (pwQuery.rows.length > 0 && pwQuery.rows[0].NR_SEQ_PAC_SENHA_FILA) {
          const pwd = pwQuery.rows[0];

          if (pwd.NR_FILA_ATUAL === nrFilaDestino) {
            const nrFilaVolta = pwd.NR_SEQ_FILA_SENHA_ORIGEM || 9;

            await conn.execute(
              `UPDATE paciente_senha_fila 
               SET nr_seq_fila_senha = :nr_fila_volta,
                   dt_fim_atendimento = SYSDATE
               WHERE nr_sequencia = :nr_seq_senha`,
              {
                nr_fila_volta: nrFilaVolta,
                nr_seq_senha: pwd.NR_SEQ_PAC_SENHA_FILA
              }
            );

            await conn.commit();
          }
        }
      }
    } catch (pwErr) {
      console.error('[Dashboard P.A.] Erro ao retirar senha da vaga recusada:', pwErr.message);
      warnings.push({
        code: 'SENHA_RETIRADA_FALHOU',
        message: 'A recusa foi salva, mas ocorreu uma falha ao tentar remover a senha administrativa no TASY.'
      });
    }

    return { success: true, warnings: warnings.length ? warnings : undefined };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    try {
      await conn.execute(`BEGIN wheb_usuario_pck.set_ie_executar_trigger('S'); END;`);
    } catch (e) {}
    await conn.close();
  }
}

module.exports = {
  findSetoresInternacao,
  findPacientesComStatus,
  findPacientesParticularesAlta,
  findPacientesAltaMedica,
  findPacientesSalaObservacao,
  findPacientesIndicacaoInternacao,
  findPacientesDecididos,
  findDetalhesInternacao,
  aceitarInternacao,
  recusarInternacao
};
