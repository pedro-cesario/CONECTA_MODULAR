const { getConnection } = require('../database');

const TIPO_HIGIENE_MAOS = 'HIGIENE_MAOS';
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
    const profissionais = await conn.execute(`SELECT cd_pessoa_fisica, nm_usuario,
                           obter_nome_usuario(nm_usuario) AS nome
                      FROM usuario
                     WHERE ie_tipo_evolucao IN (3, 13)
                       AND ie_situacao = 'A'
                     ORDER BY obter_nome_usuario(nm_usuario), nm_usuario`);

    return { setores: setores.rows || [], avaliadores: avaliadores.rows || [], profissionais: profissionais.rows || [] };
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
  const profissional = await conn.execute(`SELECT cd_pessoa_fisica, obter_nome_usuario(nm_usuario) AS nome
                    FROM usuario
                   WHERE cd_pessoa_fisica = :cd_pessoa_fisica
                     AND ie_tipo_evolucao IN (3, 13)
                     AND ie_situacao = 'A'`, { cd_pessoa_fisica: dados.cd_profissional });

  if (!setor.rows?.[0]) throw new Error('Setor inválido ou inativo.');
  if (!avaliador.rows?.[0]) throw new Error('Avaliador inválido ou inativo.');
  if (!profissional.rows?.[0]) throw new Error('Profissional inválido ou inativo.');
  return { setor: setor.rows[0], avaliador: avaliador.rows[0], profissional: profissional.rows[0] };
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
      cd_pessoa_fisica: dados.cd_profissional,
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

module.exports = { TIPO_HIGIENE_MAOS, OPORTUNIDADES, listarOpcoes, salvarHigieneMaos, listarHistorico, listarHistoricoConsolidado, obterPorId };
