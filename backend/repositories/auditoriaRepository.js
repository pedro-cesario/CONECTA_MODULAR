const { getConnection } = require('../database');

const TIPO_HIGIENE_MAOS = 'HIGIENE_MAOS';
const TIPO_AUDITORIA_PROCESSOS = 'AUDITORIA_PROCESSOS';
const OPORTUNIDADES = [
  'ANTES_CONTATO_PACIENTE',
  'ANTES_PROCEDIMENTO_ASSEPTICO',
  'APOS_FLUIDOS',
  'APOS_CONTATO_PACIENTE',
  'APOS_CONTATO_AMBIENTE'
];

async function listarOpcoes() {
  const conn = await getConnection();
  try {
    const setores = await conn.execute(`SELECT cd_setor_atendimento, ds_setor_atendimento
                      FROM setor_atendimento
                     WHERE ie_situacao = 'A'
                       AND cd_classif_setor = 3
                     ORDER BY ds_setor_atendimento`);
    const avaliadores = await conn.execute(`SELECT cd_pessoa_fisica, nm_usuario,
                           obter_nome_usuario(nm_usuario) AS nome
                      FROM usuario
                     WHERE cd_setor_atendimento = :cd_setor_atendimento
                       AND ie_situacao = 'A'
                     ORDER BY obter_nome_usuario(nm_usuario), nm_usuario`, { cd_setor_atendimento: 48 });
    const categorias = await conn.execute(`SELECT DS_VALOR_DOMINIO FROM VALOR_DOMINIO WHERE CD_DOMINIO = 72 AND IE_SITUACAO = 'A' ORDER BY DS_VALOR_DOMINIO`);

    return { setores: setores.rows || [], avaliadores: avaliadores.rows || [], profissionais: categorias.rows || [] };
  } finally {
    await conn.close();
  }
}

async function validarReferencias(conn, dados) {
  const setor = await conn.execute(`SELECT cd_setor_atendimento, ds_setor_atendimento
                    FROM setor_atendimento
                   WHERE cd_setor_atendimento = :cd_setor_atendimento
                     AND ie_situacao = 'A'
                     AND cd_classif_setor = 3`, { cd_setor_atendimento: dados.cd_setor_atendimento });
  const avaliador = await conn.execute(`SELECT cd_pessoa_fisica, obter_nome_usuario(nm_usuario) AS nome
                    FROM usuario
                   WHERE cd_pessoa_fisica = :cd_pessoa_fisica
                     AND cd_setor_atendimento = :cd_setor_atendimento
                     AND ie_situacao = 'A'`, { cd_pessoa_fisica: dados.cd_avaliador, cd_setor_atendimento: 48 });
  const categoria = await conn.execute(`SELECT DS_VALOR_DOMINIO FROM VALOR_DOMINIO WHERE CD_DOMINIO = 72 AND IE_SITUACAO = 'A' AND DS_VALOR_DOMINIO = :ds_cargo`, { ds_cargo: dados.cd_profissional });

  if (!setor.rows?.[0]) throw new Error('Setor inválido ou inativo.');
  if (!avaliador.rows?.[0]) throw new Error('Avaliador inválido ou inativo.');
  if (!categoria.rows?.[0]) throw new Error('Categoria inválida.');
  return { setor: setor.rows[0], avaliador: avaliador.rows[0], profissional: { NOME: categoria.rows[0].DS_VALOR_DOMINIO } };
}

async function salvarHigieneMaos(dados, nmUsuario) {
  const conn = await getConnection();
  try {
    const referencias = await validarReferencias(conn, dados);
    const seq = await conn.execute(`SELECT CONECTA_AUD_NISA_SEQ.NEXTVAL AS nr_sequencia FROM dual`);
    const nrAuditoria = Number(seq.rows[0].NR_SEQUENCIA);
    const seqProfissional = await conn.execute(`SELECT CONECTA_AUD_NISA_SEQ.NEXTVAL AS nr_sequencia FROM dual`);
    const nrAuditoriaProfissional = Number(seqProfissional.rows[0].NR_SEQUENCIA);

    await conn.execute(`INSERT INTO CONECTA_AUD_NISA
      (nr_sequencia, ie_tipo_auditoria, dt_auditoria, cd_setor_atendimento, nm_setor,
       cd_avaliador, nm_avaliador, ie_turno, ds_observacao, nm_usuario,
       dt_criacao, dt_atualizacao, ie_situacao)
      VALUES
      (:nr_sequencia, :ie_tipo_auditoria, TO_DATE(:dt_auditoria, 'YYYY-MM-DD'), :cd_setor_atendimento, :nm_setor,
       :cd_avaliador, :nm_avaliador, :ie_turno, :ds_observacao, :nm_usuario,
       SYSDATE, SYSDATE, 'A')`, {
      nr_sequencia: nrAuditoria,
      ie_tipo_auditoria: TIPO_HIGIENE_MAOS,
      dt_auditoria: dados.dt_auditoria,
      cd_setor_atendimento: dados.cd_setor_atendimento,
      nm_setor: referencias.setor.DS_SETOR_ATENDIMENTO,
      cd_avaliador: dados.cd_avaliador,
      nm_avaliador: referencias.avaliador.NOME,
      ie_turno: dados.ie_turno,
      ds_observacao: dados.ds_observacao || null,
      nm_usuario: nmUsuario
    });

    await conn.execute(`INSERT INTO CONECTA_AUD_NISA_PROF
      (nr_sequencia, nr_seq_auditoria, cd_pessoa_fisica, nm_profissional, dt_criacao, dt_atualizacao, ie_situacao)
      VALUES (:nr_sequencia, :nr_seq_auditoria, :cd_pessoa_fisica, :nm_profissional, SYSDATE, SYSDATE, 'A')`, {
      nr_sequencia: nrAuditoriaProfissional,
      nr_seq_auditoria: nrAuditoria,
      cd_pessoa_fisica: null, /* We now save Categoria string in nm_profissional */
      nm_profissional: referencias.profissional.NOME
    });

    for (const oportunidade of dados.oportunidades) {
      await conn.execute(`INSERT INTO CONECTA_AUD_NISA_OPORT
        (nr_sequencia, nr_seq_auditoria_profissional, ie_tipo_oportunidade, ie_resultado, dt_criacao, dt_atualizacao, ie_situacao)
        VALUES (CONECTA_AUD_NISA_SEQ.NEXTVAL, :nr_seq_auditoria_profissional, :ie_tipo_oportunidade, :ie_resultado, SYSDATE, SYSDATE, 'A')`, {
        nr_seq_auditoria_profissional: nrAuditoriaProfissional,
        ie_tipo_oportunidade: oportunidade.ie_tipo_oportunidade,
        ie_resultado: oportunidade.ie_resultado
      });
    }

    await conn.commit();
    return { nr_sequencia: nrAuditoria };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    await conn.close();
  }
}

async function listarHistorico() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`SELECT a.nr_sequencia,
             TO_CHAR(a.dt_auditoria, 'YYYY-MM-DD') AS dt_auditoria,
             a.nm_setor, a.nm_avaliador, a.ie_turno, p.nm_profissional,
             COUNT(o.nr_sequencia) AS total_oportunidades,
             SUM(CASE WHEN o.ie_resultado IN ('A', 'S') THEN 1 ELSE 0 END) AS oportunidades_conformes
        FROM conecta_aud_nisa a
        JOIN conecta_aud_nisa_prof p ON p.nr_seq_auditoria = a.nr_sequencia AND p.ie_situacao = 'A'
        LEFT JOIN conecta_aud_nisa_oport o ON o.nr_seq_auditoria_profissional = p.nr_sequencia AND o.ie_situacao = 'A'
       WHERE a.ie_tipo_auditoria = :ie_tipo_auditoria
         AND a.ie_situacao = 'A'
       GROUP BY a.nr_sequencia, a.dt_auditoria, a.nm_setor, a.nm_avaliador, a.ie_turno, p.nm_profissional
       ORDER BY a.dt_auditoria DESC, a.nr_sequencia DESC`, { ie_tipo_auditoria: TIPO_HIGIENE_MAOS });
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function listarHistoricoConsolidado() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`SELECT TO_CHAR(a.dt_auditoria, 'YYYY-MM-DD') AS dt_auditoria,
             a.nm_setor, a.nm_avaliador, a.ie_turno,
             COUNT(DISTINCT a.nr_sequencia) AS total_auditorias,
             COUNT(o.nr_sequencia) AS total_oportunidades,
             SUM(CASE WHEN o.ie_resultado IN ('A', 'S') THEN 1 ELSE 0 END) AS oportunidades_conformes,
             SUM(CASE WHEN o.ie_resultado = 'A' THEN 1 ELSE 0 END) AS total_alcool,
             SUM(CASE WHEN o.ie_resultado = 'S' THEN 1 ELSE 0 END) AS total_sabonete,
             SUM(CASE WHEN o.ie_resultado = 'P' THEN 1 ELSE 0 END) AS total_perdidas
        FROM conecta_aud_nisa a
        JOIN conecta_aud_nisa_prof p ON p.nr_seq_auditoria = a.nr_sequencia AND p.ie_situacao = 'A'
        LEFT JOIN conecta_aud_nisa_oport o ON o.nr_seq_auditoria_profissional = p.nr_sequencia AND o.ie_situacao = 'A'
       WHERE a.ie_tipo_auditoria = :ie_tipo_auditoria
         AND a.ie_situacao = 'A'
       GROUP BY a.dt_auditoria, a.nm_setor, a.nm_avaliador, a.ie_turno
       ORDER BY a.dt_auditoria DESC, a.nm_setor, a.nm_avaliador, a.ie_turno`, { ie_tipo_auditoria: TIPO_HIGIENE_MAOS });
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function obterPorId(nrSequencia) {
  const conn = await getConnection();
  try {
    const cabecalho = await conn.execute(`SELECT a.nr_sequencia, a.ie_tipo_auditoria,
               TO_CHAR(a.dt_auditoria, 'YYYY-MM-DD') AS dt_auditoria,
               a.cd_setor_atendimento, a.nm_setor, a.cd_avaliador, a.nm_avaliador,
               a.ie_turno, a.ds_observacao, a.nm_usuario,
               TO_CHAR(a.dt_criacao, 'YYYY-MM-DD HH24:MI:SS') AS dt_criacao,
               p.nr_sequencia AS nr_seq_auditoria_profissional, p.cd_pessoa_fisica, p.nm_profissional
          FROM conecta_aud_nisa a
          JOIN conecta_aud_nisa_prof p ON p.nr_seq_auditoria = a.nr_sequencia AND p.ie_situacao = 'A'
         WHERE a.nr_sequencia = :nr_sequencia
           AND a.ie_tipo_auditoria = :ie_tipo_auditoria
           AND a.ie_situacao = 'A'`, { nr_sequencia: nrSequencia, ie_tipo_auditoria: TIPO_HIGIENE_MAOS });
    if (!cabecalho.rows?.[0]) return null;
    const auditoria = cabecalho.rows[0];
    const oportunidades = await conn.execute(`SELECT ie_tipo_oportunidade, ie_resultado
        FROM conecta_aud_nisa_oport
       WHERE nr_seq_auditoria_profissional = :nr_seq_auditoria_profissional
         AND ie_situacao = 'A'
       ORDER BY nr_sequencia`, { nr_seq_auditoria_profissional: auditoria.NR_SEQ_AUDITORIA_PROFISSIONAL });
    return { ...auditoria, oportunidades: oportunidades.rows || [] };
  } finally {
    await conn.close();
  }
}

// ─── Auditoria de Processos ───────────────────────────────────────────────

async function validarReferenciasProcessos(conn, dados) {
  const setor = await conn.execute(`SELECT cd_setor_atendimento, ds_setor_atendimento
                    FROM setor_atendimento
                   WHERE cd_setor_atendimento = :cd_setor_atendimento
                     AND ie_situacao = 'A'
                     AND cd_classif_setor = 3`, { cd_setor_atendimento: dados.cd_setor_atendimento });
  const avaliador = await conn.execute(`SELECT cd_pessoa_fisica, obter_nome_usuario(nm_usuario) AS nome
                    FROM usuario
                   WHERE cd_pessoa_fisica = :cd_pessoa_fisica
                     AND ie_situacao = 'A'`, { cd_pessoa_fisica: dados.cd_avaliador });
  if (!setor.rows?.[0]) throw new Error('Setor inválido ou inativo.');
  if (!avaliador.rows?.[0]) throw new Error('Responsável inválido ou inativo.');
  return { setor: setor.rows[0], avaliador: avaliador.rows[0] };
}

async function salvarAuditoriaProcessos(dados, nmUsuario) {
  const conn = await getConnection();
  try {
    const referencias = await validarReferenciasProcessos(conn, dados);
    const seq = await conn.execute(`SELECT CONECTA_AUD_NISA_SEQ.NEXTVAL AS nr_sequencia FROM dual`);
    const nrAuditoria = Number(seq.rows[0].NR_SEQUENCIA);

    await conn.execute(`INSERT INTO CONECTA_AUD_NISA
      (nr_sequencia, ie_tipo_auditoria, dt_auditoria, cd_setor_atendimento, nm_setor,
       cd_avaliador, nm_avaliador, ie_turno, ds_observacao, nm_usuario,
       dt_criacao, dt_atualizacao, ie_situacao)
      VALUES
      (:nr_sequencia, :ie_tipo_auditoria, TO_DATE(:dt_auditoria, 'YYYY-MM-DD'), :cd_setor_atendimento, :nm_setor,
       :cd_avaliador, :nm_avaliador, :ie_turno, :ds_observacao, :nm_usuario,
       SYSDATE, SYSDATE, 'A')`, {
      nr_sequencia: nrAuditoria,
      ie_tipo_auditoria: TIPO_AUDITORIA_PROCESSOS,
      dt_auditoria: dados.dt_auditoria,
      cd_setor_atendimento: dados.cd_setor_atendimento,
      nm_setor: referencias.setor.DS_SETOR_ATENDIMENTO,
      cd_avaliador: dados.cd_avaliador,
      nm_avaliador: referencias.avaliador.NOME,
      ie_turno: dados.ie_turno || null,
      ds_observacao: dados.ds_observacao || null,
      nm_usuario: nmUsuario
    });

    await conn.execute(`INSERT INTO CONECTA_AUD_PROCESSOS
      (nr_sequencia, nm_paciente, dt_nascimento, nr_idade, dt_admissao,
       ds_unidade_leito, nr_atendimento, cd_paciente, nr_cpf, ds_diagnostico, ie_acompanhante)
      VALUES
      (:nr_sequencia, :nm_paciente, TO_DATE(:dt_nascimento, 'YYYY-MM-DD'),
       :nr_idade, TO_DATE(:dt_admissao, 'YYYY-MM-DD'),
       :ds_unidade_leito, :nr_atendimento, :cd_paciente, :nr_cpf, :ds_diagnostico, :ie_acompanhante)`, {
      nr_sequencia: nrAuditoria,
      nm_paciente: dados.nm_paciente || '',
      dt_nascimento: dados.dt_nascimento || '1900-01-01',
      nr_idade: dados.nr_idade || null,
      dt_admissao: dados.dt_admissao || dados.dt_auditoria,
      ds_unidade_leito: dados.ds_unidade_leito || null,
      nr_atendimento: dados.nr_atendimento || null,
      cd_paciente: dados.cd_paciente || null,
      nr_cpf: dados.nr_cpf || null,
      ds_diagnostico: dados.ds_diagnostico || null,
      ie_acompanhante: dados.ie_acompanhante || 'NA'
    });

    for (const resposta of (dados.respostas || [])) {
      await conn.execute(`INSERT INTO CONECTA_AUD_PROCESSOS_RESPOSTA
        (nr_sequencia, nr_seq_auditoria, cd_grupo, cd_subgrupo, cd_item, ie_resposta, ds_descricao)
        VALUES (CONECTA_AUD_NISA_SEQ.NEXTVAL, :nr_seq_auditoria, :cd_grupo, :cd_subgrupo, :cd_item, :ie_resposta, :ds_descricao)`, {
        nr_seq_auditoria: nrAuditoria,
        cd_grupo: resposta.cd_grupo,
        cd_subgrupo: resposta.cd_subgrupo || null,
        cd_item: resposta.cd_item,
        ie_resposta: resposta.ie_resposta,
        ds_descricao: resposta.ds_descricao || null
      });
    }

    await conn.commit();
    return { nr_sequencia: nrAuditoria };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    await conn.close();
  }
}

async function listarHistoricoProcessos() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`SELECT a.nr_sequencia,
             TO_CHAR(a.dt_auditoria, 'YYYY-MM-DD') AS dt_auditoria,
             a.nm_setor, a.nm_avaliador, a.ie_turno,
             p.nm_paciente, p.ds_unidade_leito, p.nr_atendimento,
             COUNT(r.nr_sequencia) AS total_respostas,
             SUM(CASE WHEN r.ie_resposta = 'S' THEN 1 ELSE 0 END) AS total_sim,
             SUM(CASE WHEN r.ie_resposta = 'N' THEN 1 ELSE 0 END) AS total_nao,
             SUM(CASE WHEN r.ie_resposta = 'NA' THEN 1 ELSE 0 END) AS total_na
        FROM conecta_aud_nisa a
        JOIN conecta_aud_processos p ON p.nr_sequencia = a.nr_sequencia
        LEFT JOIN conecta_aud_processos_resposta r ON r.nr_seq_auditoria = a.nr_sequencia
       WHERE a.ie_tipo_auditoria = :ie_tipo_auditoria
         AND a.ie_situacao = 'A'
       GROUP BY a.nr_sequencia, a.dt_auditoria, a.nm_setor, a.nm_avaliador, a.ie_turno,
                p.nm_paciente, p.ds_unidade_leito, p.nr_atendimento
       ORDER BY a.dt_auditoria DESC, a.nr_sequencia DESC`, { ie_tipo_auditoria: TIPO_AUDITORIA_PROCESSOS });
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function listarHistoricoProcessosConsolidado() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`SELECT TO_CHAR(a.dt_auditoria, 'YYYY-MM-DD') AS dt_auditoria,
             a.nm_setor, a.nm_avaliador, a.ie_turno,
             COUNT(DISTINCT a.nr_sequencia) AS total_auditorias,
             COUNT(r.nr_sequencia) AS total_respostas,
             SUM(CASE WHEN r.ie_resposta = 'S' THEN 1 ELSE 0 END) AS total_sim,
             SUM(CASE WHEN r.ie_resposta = 'N' THEN 1 ELSE 0 END) AS total_nao,
             SUM(CASE WHEN r.ie_resposta = 'NA' THEN 1 ELSE 0 END) AS total_na
        FROM conecta_aud_nisa a
        JOIN conecta_aud_processos p ON p.nr_sequencia = a.nr_sequencia
        LEFT JOIN conecta_aud_processos_resposta r ON r.nr_seq_auditoria = a.nr_sequencia
       WHERE a.ie_tipo_auditoria = :ie_tipo_auditoria
         AND a.ie_situacao = 'A'
       GROUP BY a.dt_auditoria, a.nm_setor, a.nm_avaliador, a.ie_turno
       ORDER BY a.dt_auditoria DESC, a.nm_setor, a.nm_avaliador, a.ie_turno`, { ie_tipo_auditoria: TIPO_AUDITORIA_PROCESSOS });
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function obterProcessosPorId(nrSequencia) {
  const conn = await getConnection();
  try {
    const cabecalho = await conn.execute(`SELECT a.nr_sequencia, a.ie_tipo_auditoria,
               TO_CHAR(a.dt_auditoria, 'YYYY-MM-DD') AS dt_auditoria,
               a.cd_setor_atendimento, a.nm_setor, a.cd_avaliador, a.nm_avaliador,
               a.ie_turno, a.ds_observacao, a.nm_usuario,
               TO_CHAR(a.dt_criacao, 'YYYY-MM-DD HH24:MI:SS') AS dt_criacao,
               p.nm_paciente, TO_CHAR(p.dt_nascimento, 'YYYY-MM-DD') AS dt_nascimento,
               p.nr_idade, TO_CHAR(p.dt_admissao, 'YYYY-MM-DD') AS dt_admissao,
               p.ds_unidade_leito, p.nr_atendimento, p.cd_paciente, p.nr_cpf, p.ds_diagnostico, p.ie_acompanhante
          FROM conecta_aud_nisa a
          JOIN conecta_aud_processos p ON p.nr_sequencia = a.nr_sequencia
         WHERE a.nr_sequencia = :nr_sequencia
           AND a.ie_tipo_auditoria = :ie_tipo_auditoria
           AND a.ie_situacao = 'A'`, { nr_sequencia: nrSequencia, ie_tipo_auditoria: TIPO_AUDITORIA_PROCESSOS });
    if (!cabecalho.rows?.[0]) return null;
    const auditoria = cabecalho.rows[0];
    const respostas = await conn.execute(`SELECT cd_grupo, cd_subgrupo, cd_item, ie_resposta, ds_descricao
        FROM conecta_aud_processos_resposta
       WHERE nr_seq_auditoria = :nr_seq_auditoria
       ORDER BY nr_sequencia`, { nr_seq_auditoria: nrSequencia });
    return { ...auditoria, respostas: respostas.rows || [] };
  } finally {
    await conn.close();
  }
}

async function listarPacientesOntem() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`
      SELECT
        nm_paciente,
        dt_nascimento,
        TRUNC(MONTHS_BETWEEN(SYSDATE, dt_nascimento) / 12) AS idade,
        TRUNC(dt_entrada) AS admissao,
        ds_setor_atendimento || ' - ' || cd_unidade_basica || '/' || cd_unidade_compl AS unidade_leito,
        nr_atendimento
      FROM paciente_internado_atual_v
      WHERE TRUNC(dt_entrada) = TRUNC(SYSDATE) - 1
        AND cd_setor_atendimento NOT IN (83, 68, 59)
      ORDER BY nm_paciente`);
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function pacienteAleatorio() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`
      SELECT * FROM (
        SELECT
          nm_paciente,
          dt_nascimento,
          TRUNC(MONTHS_BETWEEN(SYSDATE, dt_nascimento) / 12) AS idade,
          TRUNC(dt_entrada) AS admissao,
          ds_setor_atendimento || ' - ' || cd_unidade_basica || '/' || cd_unidade_compl AS unidade_leito,
          nr_atendimento
        FROM paciente_internado_atual_v
        WHERE cd_setor_atendimento NOT IN (83, 68, 59)
        ORDER BY DBMS_RANDOM.VALUE
      ) WHERE ROWNUM = 1`);
    return result.rows?.[0] || null;
  } finally {
    await conn.close();
  }
}

module.exports = { TIPO_HIGIENE_MAOS, TIPO_AUDITORIA_PROCESSOS, OPORTUNIDADES, listarOpcoes, salvarHigieneMaos, listarHistorico, listarHistoricoConsolidado, obterPorId, salvarAuditoriaProcessos, listarHistoricoProcessos, listarHistoricoProcessosConsolidado, obterProcessosPorId, listarPacientesOntem, pacienteAleatorio };
