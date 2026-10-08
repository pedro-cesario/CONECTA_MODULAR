const db = require('../../../core/database/index.js');
const oracledb = require('oracledb');

/**
 * Cria o atendimento no banco Oracle/TASY.
 * Todas as configs (estabelecimento, procedência, etc) devem ser resolvidas
 * e passadas pela camada de Service, mantendo o repositório agnóstico.
 */
async function abrirAtendimento(dados, nmUsuario) {
  const conn = await db.getConnection();
  try {
    const seqRes = await conn.execute(`SELECT ATENDIMENTO_PACIENTE_SEQ.NEXTVAL AS id FROM dual`);
    const nrAtendimento = seqRes.rows[0].ID;

    // Valores explícitos validados pelo service
    const {
      cdPessoaFisica, cdEstabelecimento, cdSetorAtendimento, cdProcedencia,
      ieTipoAtendimento, cdMedicoResp, nrSeqClassificacao, nrSeqPacSenhaFila,
      cdConvenio, cdCategoria, cdPlanoConvenio, cdUsuarioConvenio, ieClinica
    } = dados;

    // 1. Criação do ATENDIMENTO_PACIENTE
    await conn.execute(
      `INSERT INTO atendimento_paciente (
         nr_atendimento, cd_pessoa_fisica, dt_entrada, cd_estabelecimento,
         cd_procedencia, ie_tipo_atendimento, cd_medico_resp,
         nr_seq_pac_senha_fila, ie_status_atendimento,
         dt_atualizacao, nm_usuario, dt_atualizacao_nrec, nm_usuario_nrec,
         ie_clinica, ie_carater_inter_sus, nr_seq_classificacao, ie_responsavel
       ) VALUES (
         :atend, :cd_pf, SYSDATE, :estab,
         :proc, :tipo_atend, :med,
         :senha, 'E',
         SYSDATE, :usuario, SYSDATE, :usuario,
         :clinica, 1, :classif, 3
       )`,
      {
        atend: nrAtendimento,
        cd_pf: String(cdPessoaFisica),
        estab: cdEstabelecimento,
        proc: cdProcedencia,
        tipo_atend: ieTipoAtendimento,
        med: String(cdMedicoResp),
        classif: nrSeqClassificacao,
        senha: nrSeqPacSenhaFila || null,
        clinica: ieClinica,
        usuario: nmUsuario
      }
    );

    // 2. Vínculo de Convênio em ATEND_CATEGORIA_CONVENIO
    await conn.execute(
      `INSERT INTO atend_categoria_convenio (
         nr_seq_interno, nr_atendimento, cd_convenio, cd_categoria, cd_plano_convenio,
         cd_usuario_convenio, dt_inicio_vigencia, dt_atualizacao, nm_usuario,
         nr_doc_convenio, cd_tipo_acomodacao, ie_tipo_guia, ie_regime_internacao,
         nm_usuario_original, cd_municipio_convenio
       ) VALUES (
         ATEND_CATEGORIA_CONVENIO_SEQ.NEXTVAL, :atend, :conv, :cat, :plano,
         :carteira, SYSDATE, SYSDATE, :usuario,
         :doc_conv, 3, 'C', '1',
         :usuario, 30570000
       )`,
      {
        atend: nrAtendimento,
        conv: cdConvenio,
        cat: String(cdCategoria),
        plano: cdPlanoConvenio ? String(cdPlanoConvenio) : null,
        carteira: cdUsuarioConvenio ? String(cdUsuarioConvenio) : '0',
        usuario: nmUsuario,
        doc_conv: String(nrAtendimento)
      }
    );

    // 3. Alocação de Setor e Unidade/Leito em ATEND_PACIENTE_UNIDADE
    await conn.execute(
      `INSERT INTO atend_paciente_unidade (
         nr_seq_interno, nr_atendimento, nr_sequencia,
         cd_setor_atendimento, cd_unidade_basica, cd_unidade_compl,
         dt_entrada_unidade, nm_usuario, cd_tipo_acomodacao,
         dt_atualizacao, dt_atualizacao_nrec, nm_usuario_nrec, cd_procedencia_atend
       )
       SELECT
         ATEND_PACIENTE_UNIDADE_SEQ.NEXTVAL,
         :atend,
         1,
         ua.cd_setor_atendimento,
         ua.cd_unidade_basica,
         ua.cd_unidade_compl,
         SYSDATE,
         :usuario,
         NVL(ua.cd_tipo_acomodacao, 3),
         SYSDATE,
         SYSDATE,
         :usuario,
         :proc
       FROM unidade_atendimento ua
       WHERE ua.cd_setor_atendimento = :setor
         AND ua.ie_situacao = 'A'
         AND ROWNUM = 1`,
      {
        atend: nrAtendimento,
        setor: cdSetorAtendimento,
        usuario: nmUsuario,
        proc: cdProcedencia
      }
    );

    // 4. CONTA_PACIENTE
    await conn.execute(
      `MERGE INTO CONTA_PACIENTE cp
       USING (
           SELECT 
               acc.nr_atendimento,
               MAX(acc.cd_convenio) cd_convenio,
               MAX(acc.cd_categoria) cd_categoria,
               MAX(acc.cd_plano_convenio) cd_plano_convenio
           FROM ATEND_CATEGORIA_CONVENIO acc
           WHERE acc.nr_atendimento = :atend
           GROUP BY acc.nr_atendimento
       ) x
       ON (cp.nr_atendimento = x.nr_atendimento)
       WHEN NOT MATCHED THEN
       INSERT (
           NR_INTERNO_CONTA,
           NR_ATENDIMENTO,
           CD_ESTABELECIMENTO,
           CD_CONVENIO_PARAMETRO,
           CD_CATEGORIA_PARAMETRO,
           DT_PERIODO_INICIAL,
           DT_MESANO_REFERENCIA,
           IE_TIPO_ATEND_CONTA,
           NM_USUARIO,
           DT_ATUALIZACAO,
           IE_STATUS_ACERTO,
           CD_PLANO,
           DT_ACERTO_CONTA,
           DT_PERIODO_FINAL
       )
       VALUES (
           CONTA_PACIENTE_SEQ.NEXTVAL,
           x.nr_atendimento,
           :estab,
           x.cd_convenio,
           x.cd_categoria,
           SYSDATE,
           TRUNC(SYSDATE, 'MM'),
           1,
           :usuario,
           SYSDATE,
           1,
           x.cd_plano_convenio,
           SYSDATE,
           SYSDATE
       )`,
      {
        atend: nrAtendimento,
        estab: cdEstabelecimento,
        usuario: nmUsuario
      }
    );

    // 5. Lançamento automático é uma etapa da Recepção, não da Triagem P.A.
    // A chamada é opt-in para impedir que a abertura clínica antecipe o fluxo
    // financeiro/administrativo da recepção.
    if (dados.gerarLancamentoAutomatico === true) {
      await conn.execute(
        `DECLARE
          v_nr_interno_conta NUMBER;
        BEGIN
          SELECT MAX(nr_interno_conta)
          INTO v_nr_interno_conta
          FROM conta_paciente
          WHERE nr_atendimento = :atend;

          IF (v_nr_interno_conta IS NOT NULL) THEN
            GERAR_LANCAMENTO_AUTOMATICO(
              NR_ATENDIMENTO_P      => :atend,
              CD_LOCAL_ESTOQUE_P    => NULL,
              NR_SEQ_EVENTO_P       => 26,
              NM_USUARIO_P          => :usuario,
              NR_SEQUENCIA_P        => NULL,
              DS_ADICIONAL_1_P      => NULL,
              DS_ADICIONAL_2_P      => NULL,
              DS_ADICIONAL_3_P      => NULL,
              DS_ADICIONAL_4_P      => NULL,
              NR_INTERNO_CONTA_P    => v_nr_interno_conta
            );
          END IF;
        END;`,
        {
          atend: nrAtendimento,
          usuario: nmUsuario
        }
      );
    }

    await conn.commit();
    return { nr_atendimento: nrAtendimento };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
}

async function verificarAtendimentoAberto(cdPessoaFisica) {
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`
      SELECT nr_atendimento FROM atendimento_paciente 
      WHERE cd_pessoa_fisica = :pf 
        AND dt_alta IS NULL 
        AND dt_cancelamento IS NULL
        AND ROWNUM = 1
    `, { pf: String(cdPessoaFisica) });
    return res.rows.length > 0 ? res.rows[0].NR_ATENDIMENTO : null;
  } finally {
    if (conn) await conn.close();
  }
}

async function verificarAtendimentoPorSenha(nrSeqPacSenhaFila) {
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`SELECT nr_atendimento, cd_pessoa_fisica FROM atendimento_paciente WHERE nr_seq_pac_senha_fila = :senha AND dt_cancelamento IS NULL AND ROWNUM = 1`, { senha: parseInt(nrSeqPacSenhaFila, 10) });
    return res.rows.length > 0 ? { nr_atendimento: res.rows[0].NR_ATENDIMENTO, cd_pessoa_fisica: res.rows[0].CD_PESSOA_FISICA } : null;
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = {
  abrirAtendimento,
  verificarAtendimentoAberto,
  verificarAtendimentoPorSenha
};
