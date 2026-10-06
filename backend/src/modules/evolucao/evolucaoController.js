
const { getConnection } = require('../../core/database');
const crypto = require('crypto');
const oracledb = require('oracledb');

async function validarAssinatura(req, res) {
  let conn;
  try {
    const { nrAtendimento } = req.params;
    if (!nrAtendimento) {
      return res.status(400).json({ success: false, message: 'nrAtendimento é obrigatório' });
    }

    conn = await getConnection();

    const sqlEvolucao = `
      SELECT e.cd_evolucao, e.nr_seq_assinatura, TO_CHAR(e.dt_liberacao, 'DD/MM/YYYY HH24:MI:SS') as data_liberacao, e.cd_medico, pf.nm_pessoa_fisica as nm_medico 
      FROM evolucao_paciente e
      LEFT JOIN pessoa_fisica pf ON pf.cd_pessoa_fisica = e.cd_medico
      WHERE e.nr_atendimento = :nrAtendimento AND e.ie_situacao = 'A' AND e.ie_evolucao_clinica = 'EC'
      ORDER BY e.cd_evolucao DESC
    `;
    const resultEvolucao = await conn.execute(sqlEvolucao, { nrAtendimento });

    if (!resultEvolucao.rows || resultEvolucao.rows.length === 0) {
      return res.json({ success: false, assinado: false, message: 'Nenhuma evolução clínica (EC) ativa encontrada para este atendimento' });
    }

    const evolucao = resultEvolucao.rows[0];
    const getRowVal = (row, key) => row[key] !== undefined ? row[key] : row[key.toUpperCase()];

    const CD_EVOLUCAO = getRowVal(evolucao, 'cd_evolucao');
    const NR_SEQ_ASSINATURA = getRowVal(evolucao, 'nr_seq_assinatura');
    const DATA_LIBERACAO = getRowVal(evolucao, 'data_liberacao');
    const NM_MEDICO = getRowVal(evolucao, 'nm_medico');

    const sqlVerifica = `SELECT verifica_se_assinado('EVOLUCAO_PACIENTE', 183, :cd_evolucao, 'L') AS is_assinado FROM dual`;
    const resultVerifica = await conn.execute(sqlVerifica, { cd_evolucao: CD_EVOLUCAO });
    const isAssinado = getRowVal(resultVerifica.rows[0], 'is_assinado') === 'S';

    if (!isAssinado) {
      return res.json({ 
        success: true, 
        assinado: false, 
        cd_evolucao: CD_EVOLUCAO,
        message: 'Evolução pendente de assinatura digital no Tasy'
      });
    }

    const sqlInfo = `SELECT obter_inf_assinatura_digital(:nr_seq_assinatura, 0) AS inf_assinatura FROM dual`;
    let detalhesAssinatura = null;
    if (NR_SEQ_ASSINATURA) {
        const resultInfo = await conn.execute(sqlInfo, { nr_seq_assinatura: NR_SEQ_ASSINATURA });
        detalhesAssinatura = resultInfo.rows.length > 0 ? getRowVal(resultInfo.rows[0], 'inf_assinatura') : null;
    }

    let eventosAuditoria = [];
    if (NR_SEQ_ASSINATURA) {
        const sqlEventos = `
        SELECT ie_evento
        FROM tasy_assinat_dig_log 
        WHERE nr_seq_assinatura = :nr_seq_assinatura 
        ORDER BY nr_sequencia ASC
        `;
        const resultEventos = await conn.execute(sqlEventos, { nr_seq_assinatura: NR_SEQ_ASSINATURA });
        eventosAuditoria = resultEventos.rows.map(row => getRowVal(row, 'ie_evento'));
    }

    return res.json({
      success: true,
      assinado: true,
      cd_evolucao: CD_EVOLUCAO,
      nr_seq_assinatura: NR_SEQ_ASSINATURA,
      medico: NM_MEDICO,
      data_liberacao: DATA_LIBERACAO,
      detalhes_assinatura: detalhesAssinatura,
      eventos_auditoria: eventosAuditoria
    });

  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return res.status(500).json({ success: false, message: 'Erro ao validar assinatura', error: error.message });
  } finally {
    if (conn) {
      try { await conn.release(); } catch (err) {}
    }
  }
}

async function criarEvolucaoTeste(req, res) {
  let conn;
  try {
    const { nrAtendimento, texto } = req.body;
    if (!nrAtendimento) {
      return res.status(400).json({ success: false, message: 'nrAtendimento é obrigatório' });
    }

    const usuario = req.session?.usuario;
    const cdMedico = usuario?.cd_pessoa_fisica || '1';

    conn = await getConnection();

    const sqlPaciente = `SELECT cd_pessoa_fisica FROM atendimento_paciente WHERE nr_atendimento = :nrAtendimento`;
    const resPaciente = await conn.execute(sqlPaciente, { nrAtendimento });
    if (!resPaciente.rows || resPaciente.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Atendimento não encontrado no Tasy' });
    }
    const cdPessoaFisicaPaciente = resPaciente.rows[0].CD_PESSOA_FISICA || resPaciente.rows[0].cd_pessoa_fisica;

    const nmUsuarioLogado = usuario?.nm_usuario || 'CONECTA';

    const sqlInsert = `
      INSERT INTO evolucao_paciente (
        cd_evolucao, nr_atendimento, cd_medico, dt_evolucao, dt_liberacao, ds_evolucao, 
        ie_evolucao_clinica, ie_situacao, nm_usuario, ie_tipo_evolucao, cd_pessoa_fisica, dt_atualizacao
      ) VALUES (
        EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, :cdMedico, SYSDATE, SYSDATE, :texto, 
        'EC', 'A', :nmUsuario, '1', :cdPessoaFisicaPaciente, SYSDATE
      ) RETURNING cd_evolucao INTO :cdEvolucaoOut
    `;

    const resultInsert = await conn.execute(sqlInsert, { 
      nrAtendimento, 
      cdMedico,
      texto: texto || 'Evolução Clínica de Teste - Conecta',
      nmUsuario: nmUsuarioLogado,
      cdPessoaFisicaPaciente,
      cdEvolucaoOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    }, { autoCommit: false }); // Will commit later after everything

    const cdEvolucao = resultInsert.outBinds.cdEvolucaoOut[0];

    // Obter XML Canonico
    const sqlQuery = `
    SELECT
          a.*,
          SUBSTR(obter_nome_pessoa_fisica(cd_pessoa_fisica, NULL),1,200) NM_PESSOA_FISICA,
          SUBSTR(obter_nome_pessoa_fisica(cd_medico, NULL),1,200) NM_MEDICO,
          SUBSTR(obter_valor_dominio(72, ie_tipo_evolucao),1,200) DS_TIPO_EVOLUCAO,
          SUBSTR(obter_desc_espec_medica(CD_ESPECIALIDADE),1,50) DS_ESPECIALIDADE,
          SUBSTR(obter_desc_espec_medica(CD_ESPECIALIDADE_MEDICO),1,50) DS_ESPECIALIDADE_PROF,
          SUBSTR(obter_nome_pessoa_fisica(cd_medico_parecer, NULL),1,200) NM_MEDICO_PARECER,
          SUBSTR(obter_nome_setor(cd_setor_atendimento),1,40) DS_SETOR_ATENDIMENTO,
          SUBSTR(obter_desc_cido_topografia(CD_TOPOGRAFIA),1,100) DS_TOPOGRAFIA,
          SUBSTR(obter_cor_tipo_evolucao(IE_EVOLUCAO_CLINICA),1,15) DS_COR_TIPO_EVOLUCAO,
          SUBSTR(Obter_Descricao_Padrao('CAN_ESTADO_DOENCA','DS_ESTADO',a.CD_ESTADO_DOENCA),1,255) DS_ESTADO_DOENCA,
          SUBSTR(Obter_Descricao_Padrao('CAN_ESTADO_PACIENTE','DS_ESTADO',a.IE_ESTADO_PAC_FIM_TRAT),1,255) DS_ESTADO_PAC_FIM_TRAT,
          TO_CHAR(DT_EVOLUCAO, 'DD/MM/YYYY') AS DT_EVOLUCAO_STR,
          TO_CHAR(DT_LIBERACAO, 'DD/MM/YYYY HH24:MI:SS') AS DT_LIBERACAO_STR
    FROM evolucao_paciente a
    WHERE a.cd_evolucao = :cdEvolucao
    `;
    const resultRow = await conn.execute(sqlQuery, { cdEvolucao }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const row = resultRow.rows[0];

    const safeXml = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes('<')) return `<![CDATA[${val}]]>`;
        return val;
    };
    
    const getRowVal = (row, key) => row[key] !== undefined ? row[key] : row[key.toUpperCase()];
    
    const xmlCanonico = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Evolucoes>
<Evolucao>
<CD_ESPECIALIDADE>${safeXml(getRowVal(row, 'cd_especialidade'))}</CD_ESPECIALIDADE>
<CD_MEDICO_PARECER>${safeXml(getRowVal(row, 'cd_medico_parecer'))}</CD_MEDICO_PARECER>
<NR_ATENDIMENTO>${safeXml(getRowVal(row, 'nr_atendimento'))}</NR_ATENDIMENTO>
<DS_EVOLUCAO><![CDATA[${getRowVal(row, 'ds_evolucao')}]]></DS_EVOLUCAO>
<DT_EVOLUCAO>${safeXml(getRowVal(row, 'dt_evolucao_str'))}</DT_EVOLUCAO>
<CD_EVOLUCAO>${safeXml(getRowVal(row, 'cd_evolucao'))}</CD_EVOLUCAO>
<CD_MEDICO>${safeXml(getRowVal(row, 'cd_medico'))}</CD_MEDICO>
<DT_LIBERACAO>${safeXml(getRowVal(row, 'dt_liberacao_str'))}</DT_LIBERACAO>
<IE_EVOLUCAO_CLINICA>${safeXml(getRowVal(row, 'ie_evolucao_clinica'))}</IE_EVOLUCAO_CLINICA>
<IE_RECEM_NATO>${safeXml(getRowVal(row, 'ie_recem_nato'))}</IE_RECEM_NATO>
<CD_ESPECIALIDADE_MEDICO>${safeXml(getRowVal(row, 'cd_especialidade_medico'))}</CD_ESPECIALIDADE_MEDICO>
<IE_TIPO_EVOLUCAO>${safeXml(getRowVal(row, 'ie_tipo_evolucao'))}</IE_TIPO_EVOLUCAO>
<CD_PESSOA_FISICA>${safeXml(getRowVal(row, 'cd_pessoa_fisica'))}</CD_PESSOA_FISICA>
<CD_SETOR_ATENDIMENTO>${safeXml(getRowVal(row, 'cd_setor_atendimento'))}</CD_SETOR_ATENDIMENTO>
<QT_PESO>${safeXml(getRowVal(row, 'qt_peso'))}</QT_PESO>
<QT_ALTURA>${safeXml(getRowVal(row, 'qt_altura'))}</QT_ALTURA>
<QT_SUPERF_CORPORIA>${safeXml(getRowVal(row, 'qt_superf_corporia'))}</QT_SUPERF_CORPORIA>
<CD_TOPOGRAFIA>${safeXml(getRowVal(row, 'cd_topografia'))}</CD_TOPOGRAFIA>
<CD_TUMOR_PRIM_PAT>${safeXml(getRowVal(row, 'cd_tumor_prim_pat'))}</CD_TUMOR_PRIM_PAT>
<CD_LINFONODO_REG_PAT>${safeXml(getRowVal(row, 'cd_linfonodo_reg_pat'))}</CD_LINFONODO_REG_PAT>
<CD_METASTASE_DIST_PAT>${safeXml(getRowVal(row, 'cd_metastase_dist_pat'))}</CD_METASTASE_DIST_PAT>
<CD_ESTADIO_OUTRO>${safeXml(getRowVal(row, 'cd_estadio_outro'))}</CD_ESTADIO_OUTRO>
<DT_INICIO_TRAT_PROPOSTO>${safeXml(getRowVal(row, 'dt_inicio_trat_proposto'))}</DT_INICIO_TRAT_PROPOSTO>
<DT_FINAL_TRAT_PROPOSTO>${safeXml(getRowVal(row, 'dt_final_trat_proposto'))}</DT_FINAL_TRAT_PROPOSTO>
<CD_ESTADO_DOENCA>${safeXml(getRowVal(row, 'cd_estado_doenca'))}</CD_ESTADO_DOENCA>
<IE_ESTADO_PAC_FIM_TRAT>${safeXml(getRowVal(row, 'ie_estado_pac_fim_trat'))}</IE_ESTADO_PAC_FIM_TRAT>
<NM_MEDICO>${safeXml(getRowVal(row, 'nm_medico'))}</NM_MEDICO>
<DS_TIPO_EVOLUCAO>${safeXml(getRowVal(row, 'ds_tipo_evolucao'))}</DS_TIPO_EVOLUCAO>
<NM_PESSOA_FISICA>${safeXml(getRowVal(row, 'nm_pessoa_fisica'))}</NM_PESSOA_FISICA>
<DS_ESTADO_DOENCA>${safeXml(getRowVal(row, 'ds_estado_doenca'))}</DS_ESTADO_DOENCA>
<DS_ESTADO_PAC_FIM_TRAT>${safeXml(getRowVal(row, 'ds_estado_pac_fim_trat'))}</DS_ESTADO_PAC_FIM_TRAT>
<DS_ESPECIALIDADE>${safeXml(getRowVal(row, 'ds_especialidade'))}</DS_ESPECIALIDADE>
<DS_ESPECIALIDADE_PROF>${safeXml(getRowVal(row, 'ds_especialidade_prof'))}</DS_ESPECIALIDADE_PROF>
<NM_MEDICO_PARECER>${safeXml(getRowVal(row, 'nm_medico_parecer'))}</NM_MEDICO_PARECER>
<DS_SETOR_ATENDIMENTO>${safeXml(getRowVal(row, 'ds_setor_atendimento'))}</DS_SETOR_ATENDIMENTO>
<DS_TOPOGRAFIA>${safeXml(getRowVal(row, 'ds_topografia'))}</DS_TOPOGRAFIA>
<DS_COR_TIPO_EVOLUCAO>${safeXml(getRowVal(row, 'ds_cor_tipo_evolucao'))}</DS_COR_TIPO_EVOLUCAO>
</Evolucao>
</Evolucoes>
`;

    const md5Hash = crypto.createHash('md5').update(Buffer.from(xmlCanonico, 'latin1')).digest('hex');

    const sqlCpf = `SELECT nr_cpf FROM pessoa_fisica WHERE cd_pessoa_fisica = :cdMedico`;
    const resCpf = await conn.execute(sqlCpf, { cdMedico });
    const cpfMedico = resCpf.rows.length > 0 ? (resCpf.rows[0].NR_CPF || resCpf.rows[0].nr_cpf) : null;

    await conn.commit();

    return res.json({ 
        success: true, 
        message: 'Evolução criada com sucesso!',
        cd_evolucao: cdEvolucao,
        xmlCanonico,
        md5Hash,
        cpfMedico,
        nmUsuarioLogado,
        cdMedico
    });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch(e){} }
    console.error('Erro ao criar evolução:', error);
    return res.status(500).json({ success: false, message: 'Erro ao criar evolução', error: error.message });
  } finally {
    if (conn) { try { await conn.release(); } catch (err) {} }
  }
}

async function assinarEvolucaoTeste(req, res) {
    let conn;
    try {
        const { cd_evolucao, signedData, md5Hash, cd_medico, nm_usuario, xmlCanonico, xmlEnvelope } = req.body;
        if (!cd_evolucao || !signedData || !md5Hash) {
            return res.status(400).json({ success: false, message: 'Dados de assinatura incompletos' });
        }

        conn = await getConnection();

        const sqlGrav = `
            DECLARE
                v_seq NUMBER;
                v_nova VARCHAR2(1);
            BEGIN
                TASY_GRAVAR_ASSINATURA_DIGITAL(
                    DS_ASSINATURA_P => 'HEIMDALL',
                    CD_PESSOA_FISICA_P => :cdPessoaFisica,
                    DS_HASH_ASSINATURA_P => :md5Hash,
                    NR_SEQ_PROJ_ASS_P => 183,
                    NR_SEQ_PROJ_XML_P => 100049,
                    NM_USUARIO_P => :nmUsuario,
                    CD_CLASSIF_RELAT_P => 'WATE',
                    CD_RELATORIO_P => 783,
                    NR_SEQUENCIA_P => v_seq,
                    IE_NOVA_ASSINAT_P => v_nova
                );
                
                -- Update evolution with the signature sequence
                UPDATE EVOLUCAO_PACIENTE 
                SET NR_SEQ_ASSINATURA = v_seq, DT_ATUALIZACAO = SYSDATE 
                WHERE CD_EVOLUCAO = :cdEvolucao;

                -- Insert Audit Logs (matching native WSignature)
                INSERT INTO tasy_assinat_dig_log (
                    nr_sequencia, nr_seq_assinatura, dt_atualizacao, nm_usuario, dt_evento, ie_evento, ds_erro, ie_processo_ok, ie_processo_assinado, ds_hash, ds_xml
                ) VALUES (
                    TASY_ASSINAT_DIG_LOG_SEQ.nextval, v_seq, SYSDATE, :nmUsuario, SYSDATE, 'GXML', NULL, 'S', 'EP', :md5Hash, :xmlCanonico
                );

                INSERT INTO tasy_assinat_dig_log (
                    nr_sequencia, nr_seq_assinatura, dt_atualizacao, nm_usuario, dt_evento, ie_evento, ds_erro, ie_processo_ok, ie_processo_assinado, ds_hash, ds_xml
                ) VALUES (
                    TASY_ASSINAT_DIG_LOG_SEQ.nextval, v_seq, SYSDATE, :nmUsuario, SYSDATE, 'Envio', NULL, 'S', 'EP', :md5Hash, :xmlEnvelope
                );

                INSERT INTO tasy_assinat_dig_log (
                    nr_sequencia, nr_seq_assinatura, dt_atualizacao, nm_usuario, dt_evento, ie_evento, ds_erro, ie_processo_ok, ie_processo_assinado, ds_hash, ds_xml
                ) VALUES (
                    TASY_ASSINAT_DIG_LOG_SEQ.nextval, v_seq, SYSDATE, :nmUsuario, SYSDATE, 'Retorno', NULL, 'S', 'EP', :md5Hash, :signedData
                );

                INSERT INTO tasy_assinat_dig_log (
                    nr_sequencia, nr_seq_assinatura, dt_atualizacao, nm_usuario, dt_evento, ie_evento, ds_erro, ie_processo_ok, ie_processo_assinado, ds_hash, ds_xml
                ) VALUES (
                    TASY_ASSINAT_DIG_LOG_SEQ.nextval, v_seq, SYSDATE, :nmUsuario, SYSDATE, 'Validado', NULL, 'S', 'EP', :md5Hash, 'Válida'
                );
                
                :outSeq := v_seq;
            END;
        `;
        
        const resultGrav = await conn.execute(sqlGrav, {
            signedData,
            xmlCanonico: xmlCanonico || null,
            xmlEnvelope: xmlEnvelope || null,
            cdPessoaFisica: String(cd_medico),
            md5Hash,
            nmUsuario: nm_usuario || 'CONECTA',
            cdEvolucao: cd_evolucao,
            outSeq: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }, { autoCommit: true });
        
        return res.json({ 
            success: true, 
            message: 'Evolução assinada com sucesso!',
            nr_seq_assinatura: resultGrav.outBinds.outSeq[0]
        });

    } catch (error) {
        console.error('Erro ao assinar evolução:', error);
        return res.status(500).json({ success: false, message: 'Erro ao assinar evolução', error: error.message });
    } finally {
        if (conn) { try { await conn.release(); } catch (err) {} }
    }
}

module.exports = {
  validarAssinatura,
  criarEvolucaoTeste,
  assinarEvolucaoTeste
};
