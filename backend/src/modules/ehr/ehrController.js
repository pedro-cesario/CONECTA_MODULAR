const db = require('../../core/database');
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
    const { cd_pessoa_fisica, nr_seq_template, campos } = req.body;
    if (!cd_pessoa_fisica || !nr_seq_template) {
       return res.status(400).json({ success: false, message: 'Dados inválidos para registro EHR.' });
    }
    
    const conn = await db.getConnection();
    try {
       const tempRes = await conn.execute(`SELECT * FROM EHR_TEMPLATE WHERE NR_SEQUENCIA = :id`, [nr_seq_template]);
       if (!tempRes.rows || tempRes.rows.length === 0) throw new Error('Template não encontrado');
       const template = tempRes.rows[0];

       // Acha o atendimento atual do paciente
       let nrAtendimento = req.body.nr_atendimento;
       if (!nrAtendimento) {
          const atenRes = await conn.execute(`
             SELECT MAX(NR_ATENDIMENTO) AS NR_ATENDIMENTO FROM ATENDIMENTO_PACIENTE WHERE CD_PESSOA_FISICA = :pf
          `, [cd_pessoa_fisica]);
          nrAtendimento = atenRes.rows[0]?.NR_ATENDIMENTO;
       }

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

          const sqlIns = `
             INSERT INTO EVOLUCAO_PACIENTE (
                CD_EVOLUCAO, NR_ATENDIMENTO, CD_MEDICO, DT_EVOLUCAO, DT_LIBERACAO, 
                DS_EVOLUCAO, NM_USUARIO, IE_TIPO_EVOLUCAO, IE_EVOLUCAO_CLINICA
             ) VALUES (
                EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, NULL, SYSDATE, SYSDATE, 
                :dsEvolucao, :usuario, '1', :ieEvo
             )
          `;
          await conn.execute(sqlIns, {
             nrAtendimento,
             dsEvolucao,
             usuario: req.user?.username || 'nnsouza',
             ieEvo: template.IE_EVOLUCAO_CLINICA || 'M'
          }, { autoCommit: true });

          // Gravar Tabelas Nativas
          for (const f of fluxosProcessar) {
              const usuario = req.user?.username || 'nnsouza';
              
              if (f.tipo.toLowerCase().includes('sinais vitais')) {
                  const sv = f.data;
                  await conn.execute(`
                      INSERT INTO ATENDIMENTO_SINAL_VITAL (
                         NR_SEQUENCIA, NR_ATENDIMENTO, CD_PESSOA_FISICA, DT_AVALIACAO, DT_LIBERACAO, 
                         NM_USUARIO, QT_PA_SISTOLICA, QT_PA_DIASTOLICA, QT_FREQUENCIA_CARD, QT_FREQUENCIA_RESP, 
                         QT_TEMPERATURA, QT_PESO, QT_SAT_O2, IE_SITUACAO, CD_SETOR_ATENDIMENTO
                      ) VALUES (
                         ATENDIMENTO_SINAL_VITAL_SEQ.NEXTVAL, :atend, :pf, SYSDATE, SYSDATE,
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
                         NR_SEQUENCIA, NR_ATENDIMENTO, CD_PESSOA_FISICA, DT_AVALIACAO, DT_LIBERACAO, 
                         NM_USUARIO, QT_GLASGOW, IE_RESPOSTA_MOTORA, IE_RESPOSTA_VERBAL, IE_ABERTURA_OCULAR, IE_REATIVIDADE_PUPILAR,
                         IE_SITUACAO, CD_SETOR_ATENDIMENTO
                      ) VALUES (
                         ATEND_ESCALA_INDICE_SEQ.NEXTVAL, :atend, :pf, SYSDATE, SYSDATE,
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
                         NR_SEQUENCIA, CD_PESSOA_FISICA, NR_ATENDIMENTO, DT_REGISTRO, DT_LIBERACAO, 
                         NM_USUARIO, NM_USUARIO_LIBERACAO, IE_NEGA_ALERGIAS, DS_OBSERVACAO, NR_SEQ_FICHA_TECNICA
                      ) VALUES (
                         PACIENTE_ALERGIA_SEQ.NEXTVAL, :pf, :atend, SYSDATE, SYSDATE,
                         :usr, :usr, :nega, :obs, :ftech
                      )
                  `, {
                      pf: cd_pessoa_fisica, atend: nrAtendimento, usr: usuario,
                      nega: a.IE_NEGA_ALERGIAS === 'S' ? 'S' : 'N',
                      obs: a.DS_OBSERVACAO || null,
                      ftech: a.NR_SEQ_FICHA_TECNICA ? Number(a.NR_SEQ_FICHA_TECNICA) : null
                  }, { autoCommit: true });
              }
          }
       }

       res.json({ success: true, message: 'Registro salvo e evolução gerada com sucesso!' });
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
