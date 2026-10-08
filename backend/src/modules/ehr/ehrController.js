const db = require('../../core/database');
const crypto = require('crypto');
const oracledb = require('oracledb');
const configCache = require('../../core/config/configCache');

async function getTemplateStructure(req, res) {
  try {
    let nrSeqTemplate = req.params.id;
    if (nrSeqTemplate === 'triagem') {
       const sysConfig = configCache.getSystemConfig() || {};
       nrSeqTemplate = sysConfig.triagem_template_id || '100051';
    }

    if (!nrSeqTemplate) return res.status(400).json({ success: false, message: 'ID do template inválido.' });

    const conn = await db.getConnection();
    let template, elements;
    try {
      // Pega metadata do template
      const tempRes = await conn.execute(`SELECT * FROM EHR_TEMPLATE WHERE NR_SEQUENCIA = :id`, [nrSeqTemplate]);
      if (!tempRes.rows || tempRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Template não encontrado.' });
      }
      template = tempRes.rows[0];

      // Pega conteúdo do template ordenado junto com os dados do EHR_ELEMENTO
      const elemRes = await conn.execute(`
        SELECT c.*, e.NM_ELEMENTO, e.DS_LABEL_TELA, e.IE_COMPONENTE, e.NR_SEQ_TIPO_DADO 
        FROM EHR_TEMPLATE_CONTEUDO c
        LEFT JOIN EHR_ELEMENTO e ON e.NR_SEQUENCIA = c.NR_SEQ_ELEMENTO
        WHERE c.NR_SEQ_TEMPLATE = :id AND c.IE_SITUACAO = 'A'
        ORDER BY c.NR_SEQ_APRES ASC
      `, [nrSeqTemplate]);
      
      elements = elemRes.rows;
    } finally {
      await conn.close();
    }

    res.json({ success: true, data: { template, elements } });
  } catch (err) {
    console.error('[EHR] Erro ao buscar template:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function saveEHRRegistro(req, res) {
  try {
    console.log("[EHR DEBUG] req.body:", req.body);
    let { cd_pessoa_fisica, nr_seq_template, campos } = req.body;
    const usuarioLogado = req.session?.usuario?.nm_usuario || req.user?.username || 'Sistema';
    const cdMedico = req.session?.usuario?.cd_pessoa_fisica || null;
    
    // Garantir que não são arrays e limpar valores
    if (Array.isArray(cd_pessoa_fisica)) cd_pessoa_fisica = cd_pessoa_fisica[0];
    if (Array.isArray(nr_seq_template)) nr_seq_template = nr_seq_template[0];
    
    cd_pessoa_fisica = cd_pessoa_fisica ? String(cd_pessoa_fisica).trim() : null;
    if (cd_pessoa_fisica === 'null' || cd_pessoa_fisica === 'undefined' || cd_pessoa_fisica === '') {
       cd_pessoa_fisica = null;
    }

    let nrAtendimentoBody = req.body.nr_atendimento;
    if (Array.isArray(nrAtendimentoBody)) nrAtendimentoBody = nrAtendimentoBody[0];

    if (!cd_pessoa_fisica || !nr_seq_template) {
       return res.status(400).json({ success: false, message: 'Dados inválidos para registro EHR: paciente ou template ausente.' });
    }
    
    const conn = await db.getConnection();
    try {
       const tempRes = await conn.execute(`SELECT * FROM EHR_TEMPLATE WHERE NR_SEQUENCIA = :id`, [nr_seq_template]);
       if (!tempRes.rows || tempRes.rows.length === 0) throw new Error('Template não encontrado');
       const template = tempRes.rows[0];

       // Acha o atendimento atual do paciente
       let nrAtendimento = nrAtendimentoBody;
       if (!nrAtendimento) {
          const atenRes = await conn.execute(`
             SELECT MAX(NR_ATENDIMENTO) AS NR_ATENDIMENTO FROM ATENDIMENTO_PACIENTE WHERE CD_PESSOA_FISICA = :pf
          `, [cd_pessoa_fisica]);
          nrAtendimento = atenRes.rows[0]?.NR_ATENDIMENTO;
       }

       let responseCdEvolucao = null;
       if (template.IE_GERAR_EVOLUCAO === 'S' && nrAtendimento) {
          const elemRes = await conn.execute(`
            SELECT c.NR_SEQUENCIA, c.NR_SEQ_ELEMENTO, NVL(c.DS_LABEL, NVL(e.DS_LABEL_TELA, e.NM_ELEMENTO)) AS LABEL
            FROM EHR_TEMPLATE_CONTEUDO c
            LEFT JOIN EHR_ELEMENTO e ON e.NR_SEQUENCIA = c.NR_SEQ_ELEMENTO
            WHERE c.NR_SEQ_TEMPLATE = :id AND c.IE_SITUACAO = 'A'
          `, [nr_seq_template]);
          
          let dsEvolucao = `==== ${template.DS_TEMPLATE || 'REGISTRO EHR'} ====\n`;
          const labelsMap = {};
          elemRes.rows.forEach(r => { labelsMap['elem_' + r.NR_SEQUENCIA] = r.LABEL; });

          for (const key of Object.keys(campos)) {
             if (key.startsWith('fluxo_') || key.endsWith('_display')) continue; // Ignora meta-campos internos
             
             if (campos[key] && campos[key].trim() !== '') {
                dsEvolucao += `\n${labelsMap[key] || key}: ${campos[key]}`;
             }
          }

          // Processar fluxos nativos e colocar texto deles na evolucao
          const fluxosProcessar = [];
          for (const key of Object.keys(campos)) {
             if (key.startsWith('fluxo_') && !key.startsWith('fluxo_tipo_') && campos[key]) {
                 const nrSeq = key.replace('fluxo_', '');
                 const tipo = campos['fluxo_tipo_' + nrSeq] || '';
                 try {
                     const data = JSON.parse(campos[key]);
                     fluxosProcessar.push({ tipo, data });
                     dsEvolucao += `\n\n-- ${tipo} --`;
                     for (const k in data) {
                        dsEvolucao += `\n  ${k}: ${data[k]}`;
                     }
                 } catch(e) {}
             }
          }

          const seqRes = await conn.execute(`SELECT EVOLUCAO_PACIENTE_SEQ.NEXTVAL AS SEQ FROM DUAL`);
          const cdEvolucao = seqRes.rows[0].SEQ;
          responseCdEvolucao = cdEvolucao;

          const sqlIns = `
             INSERT INTO EVOLUCAO_PACIENTE (
                CD_EVOLUCAO, NR_ATENDIMENTO, CD_PESSOA_FISICA, CD_MEDICO, DT_EVOLUCAO, DT_LIBERACAO, 
                DS_EVOLUCAO, NM_USUARIO, IE_TIPO_EVOLUCAO, IE_EVOLUCAO_CLINICA, DT_ATUALIZACAO, IE_SITUACAO
             ) VALUES (
                :cdEvolucao, :nrAtendimento, :pf, :cdMedico, SYSDATE, SYSDATE, 
                :dsEvolucao, :usuario, '1', :ieEvo, SYSDATE, 'A'
             )
          `;
          await conn.execute(sqlIns, {
             cdEvolucao,
             nrAtendimento,
             pf: cd_pessoa_fisica,
             cdMedico,
             dsEvolucao,
             usuario: usuarioLogado,
             ieEvo: template.IE_EVOLUCAO_CLINICA || 'EM'
          }, { autoCommit: true });

          // Gravar Tabelas Nativas
          for (const f of fluxosProcessar) {
              const usuario = usuarioLogado;
              
              if (f.tipo.toLowerCase().includes('sinais vitais')) {
                  const sv = f.data;
                  await conn.execute(`
                      INSERT INTO ATENDIMENTO_SINAL_VITAL (
                         NR_SEQUENCIA, NR_ATENDIMENTO, CD_PESSOA_FISICA, DT_SINAL_VITAL, DT_LIBERACAO, DT_ATUALIZACAO,
                         NM_USUARIO, QT_PA_SISTOLICA, QT_PA_DIASTOLICA, QT_FREQ_CARDIACA, QT_FREQ_RESP, 
                         QT_TEMP, QT_PESO, QT_SATURACAO_O2, IE_SITUACAO, CD_SETOR_ATENDIMENTO
                      ) VALUES (
                         ATENDIMENTO_SINAL_VITAL_SEQ.NEXTVAL, :atend, :pf, SYSDATE, SYSDATE, SYSDATE,
                         :usr, :pas, :pad, :fc, :fr, :temp, :peso, :sat, 'A', 28
                      )
                  `, {
                      atend: nrAtendimento, pf: cd_pessoa_fisica, usr: usuario,
                      pas: sv.QT_PA_SISTOLICA ? Number(sv.QT_PA_SISTOLICA) : null,
                      pad: sv.QT_PA_DIASTOLICA ? Number(sv.QT_PA_DIASTOLICA) : null,
                      fc: sv.QT_FREQUENCIA_CARD ? Number(sv.QT_FREQUENCIA_CARD) : null,
                      fr: sv.QT_FREQUENCIA_RESP ? Number(sv.QT_FREQUENCIA_RESP) : null,
                      temp: sv.QT_TEMPERATURA ? Number(sv.QT_TEMPERATURA) : null,
                      peso: sv.QT_PESO ? Number(sv.QT_PESO) : null,
                      sat: sv.QT_SAT_O2 ? Number(sv.QT_SAT_O2) : null
                  }, { autoCommit: true });
              } 
              else if (f.tipo.toLowerCase().includes('glasgow')) {
                  const g = f.data;
                  const total = (Number(g.IE_ABERTURA_OCULAR)||0) + (Number(g.IE_RESPOSTA_VERBAL)||0) + (Number(g.IE_RESPOSTA_MOTORA)||0) + (Number(g.IE_REATIVIDADE_PUPILAR)||0);
                  await conn.execute(`
                      INSERT INTO ATEND_ESCALA_INDICE (
                         NR_SEQUENCIA, NR_ATENDIMENTO, CD_PESSOA_FISICA, DT_AVALIACAO, DT_LIBERACAO, DT_ATUALIZACAO,
                         NM_USUARIO, QT_GLASGOW, IE_RESPOSTA_MOTORA, IE_RESPOSTA_VERBAL, IE_ABERTURA_OCULAR, QT_GLASGOW_PUPILAR,
                         IE_SITUACAO, CD_SETOR_ATENDIMENTO
                      ) VALUES (
                         ATEND_ESCALA_INDICE_SEQ.NEXTVAL, :atend, :pf, SYSDATE, SYSDATE, SYSDATE,
                         :usr, :tot, :rm, :rv, :ao, :pup, 'A', 28
                      )
                  `, {
                      atend: nrAtendimento, pf: cd_pessoa_fisica, usr: usuario, tot: total,
                      rm: g.IE_RESPOSTA_MOTORA ? Number(g.IE_RESPOSTA_MOTORA) : null,
                      rv: g.IE_RESPOSTA_VERBAL ? Number(g.IE_RESPOSTA_VERBAL) : null,
                      ao: g.IE_ABERTURA_OCULAR ? Number(g.IE_ABERTURA_OCULAR) : null,
                      pup: g.IE_REATIVIDADE_PUPILAR ? Number(g.IE_REATIVIDADE_PUPILAR) : null
                  }, { autoCommit: true });
              }
              else if (f.tipo.toLowerCase().includes('alergias')) {
                  const a = f.data;
                  await conn.execute(`
                      INSERT INTO PACIENTE_ALERGIA (
                         NR_SEQUENCIA, CD_PESSOA_FISICA, NR_ATENDIMENTO, DT_REGISTRO, DT_LIBERACAO, DT_ATUALIZACAO,
                         NM_USUARIO, NM_USUARIO_LIBERACAO, IE_NEGA_ALERGIAS, DS_OBSERVACAO, NR_SEQ_FICHA_TECNICA, IE_CONFIRMACAO, CD_PROFISSIONAL
                      ) VALUES (
                         PACIENTE_ALERGIA_SEQ.NEXTVAL, :pf, :atend, SYSDATE, SYSDATE, SYSDATE,
                         :usr, :usr, :nega, :obs, :ftech, 'C', :cdMedico
                      )
                  `, {
                      pf: cd_pessoa_fisica, atend: nrAtendimento, usr: usuario, cdMedico,
                      nega: a.IE_NEGA_ALERGIAS === 'S' ? 'S' : 'N',
                      obs: a.DS_OBSERVACAO || null,
                      ftech: a.NR_SEQ_FICHA_TECNICA ? Number(a.NR_SEQ_FICHA_TECNICA) : null
                  }, { autoCommit: true });
              }
          }
       }

       
       let xmlCanonico = null;
       let md5Hash = null;
       let cpfMedico = null;

       if (responseCdEvolucao) {
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
           const resultRow = await conn.execute(sqlQuery, { cdEvolucao: responseCdEvolucao }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
           if (resultRow.rows.length > 0) {
               const row = resultRow.rows[0];
               const safeXml = (val) => {
                   if (val === null || val === undefined) return '';
                   if (typeof val === 'string' && val.includes('<')) return `<![CDATA[${val}]]>`;
                   return val;
               };
               const getRowVal = (row, key) => row[key] !== undefined ? row[key] : row[key.toUpperCase()];
               
               xmlCanonico = `<?xml version="1.0" encoding="ISO-8859-1"?>
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
               md5Hash = crypto.createHash('md5').update(Buffer.from(xmlCanonico, 'latin1')).digest('hex');
           }
           
           if (cdMedico) {
               const sqlCpf = `SELECT nr_cpf FROM pessoa_fisica WHERE cd_pessoa_fisica = :cdMedico`;
               const resCpf = await conn.execute(sqlCpf, { cdMedico });
               cpfMedico = resCpf.rows.length > 0 ? (resCpf.rows[0].NR_CPF || resCpf.rows[0].nr_cpf) : null;
           }

           // Automatic Signature
           if (md5Hash && cdMedico) {
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
                        
                        UPDATE EVOLUCAO_PACIENTE 
                        SET NR_SEQ_ASSINATURA = v_seq, DT_ATUALIZACAO = SYSDATE 
                        WHERE CD_EVOLUCAO = :cdEvolucao;

                        INSERT INTO tasy_assinat_dig_log (
                            nr_sequencia, nr_seq_assinatura, dt_atualizacao, nm_usuario, dt_evento, ie_evento, ds_erro, ie_processo_ok, ie_processo_assinado, ds_hash, ds_xml
                        ) VALUES (
                            TASY_ASSINAT_DIG_LOG_SEQ.nextval, v_seq, SYSDATE, :nmUsuario, SYSDATE, 'GXML', NULL, 'S', 'EP', :md5Hash, :xmlCanonico
                        );
                        
                        INSERT INTO tasy_assinat_dig_log (
                            nr_sequencia, nr_seq_assinatura, dt_atualizacao, nm_usuario, dt_evento, ie_evento, ds_erro, ie_processo_ok, ie_processo_assinado, ds_hash, ds_xml
                        ) VALUES (
                            TASY_ASSINAT_DIG_LOG_SEQ.nextval, v_seq, SYSDATE, :nmUsuario, SYSDATE, 'Validado', NULL, 'S', 'EP', :md5Hash, 'Válida - Automático Conecta'
                        );
                    END;
                `;
                
                await conn.execute(sqlGrav, {
                    cdPessoaFisica: String(cdMedico),
                    md5Hash,
                    nmUsuario: usuarioLogado || 'CONECTA',
                    cdEvolucao: responseCdEvolucao,
                    xmlCanonico
                }, { autoCommit: true });
           }
       }

       res.json({ 
           success: true, 
           message: 'Registro salvo e evolução gerada com sucesso!', 
           cd_evolucao: responseCdEvolucao,
           xmlCanonico,
           md5Hash,
           cpfMedico,
           nmUsuarioLogado: usuarioLogado,
           cdMedico
       });
    } finally {
       await conn.close();
    }
  } catch (err) {
    console.error('[EHR] Erro ao salvar registro:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getTemplateStructure,
  saveEHRRegistro
};
