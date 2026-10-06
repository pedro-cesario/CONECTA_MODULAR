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
    
    // NOTE: A implementação real deveria chamar as procedures TASY EHR_GERAR_REGISTRO e associados.
    // Como POC de Homologação, faremos o "EHR Text Engine":
    // 1. Puxa os rótulos do template
    // 2. Concatena os valores informados
    // 3. Insere a evolução na EVOLUCAO_PACIENTE (regra IE_GERAR_EVOLUCAO)
    
    const conn = await db.getConnection();
    try {
       // Puxa template info
       const tempRes = await conn.execute(`SELECT * FROM EHR_TEMPLATE WHERE NR_SEQUENCIA = :id`, [nr_seq_template]);
       if (!tempRes.rows || tempRes.rows.length === 0) throw new Error('Template não encontrado');
       const template = tempRes.rows[0];

       if (template.IE_GERAR_EVOLUCAO === 'S') {
          // Busca os rótulos
          const elemRes = await conn.execute(`
            SELECT c.NR_SEQ_ELEMENTO, NVL(c.DS_LABEL, NVL(e.DS_LABEL_TELA, e.NM_ELEMENTO)) AS LABEL
            FROM EHR_TEMPLATE_CONTEUDO c
            LEFT JOIN EHR_ELEMENTO e ON e.NR_SEQUENCIA = c.NR_SEQ_ELEMENTO
            WHERE c.NR_SEQ_TEMPLATE = :id AND c.IE_SITUACAO = 'A'
          `, [nr_seq_template]);
          
          let dsEvolucao = `==== ${template.DS_TEMPLATE || 'REGISTRO EHR'} ====\n`;
          const labelsMap = {};
          elemRes.rows.forEach(r => { labelsMap['elem_' + r.NR_SEQ_ELEMENTO] = r.LABEL; });

          for (const key of Object.keys(campos)) {
             if (campos[key] && campos[key].trim() !== '') {
                dsEvolucao += `\n${labelsMap[key] || key}: ${campos[key]}`;
             }
          }

          // Acha o atendimento atual do paciente para inserir (simplificação para o piloto)
          // Se não houver nr_atendimento no payload, pega o último do paciente
          let nrAtendimento = req.body.nr_atendimento;
          if (!nrAtendimento) {
             const atenRes = await conn.execute(`
                SELECT MAX(NR_ATENDIMENTO) AS NR_ATENDIMENTO FROM ATENDIMENTO_PACIENTE WHERE CD_PESSOA_FISICA = :pf
             `, [cd_pessoa_fisica]);
             nrAtendimento = atenRes.rows[0]?.NR_ATENDIMENTO;
          }

          if (nrAtendimento) {
             // Insere a evolução
             const sqlIns = `
                INSERT INTO EVOLUCAO_PACIENTE (
                   CD_EVOLUCAO, NR_ATENDIMENTO, CD_MEDICO, DT_EVOLUCAO, DT_LIBERACAO, 
                   DS_EVOLUCAO, NM_USUARIO, IE_STATUS_EVOLUCAO, IE_EVOLUCAO_CLINICA
                ) VALUES (
                   EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, NULL, SYSDATE, SYSDATE, 
                   :dsEvolucao, :usuario, 1, :ieEvo
                )
             `;
             await conn.execute(sqlIns, {
                nrAtendimento,
                dsEvolucao,
                usuario: req.user?.username || 'WEB',
                ieEvo: template.IE_EVOLUCAO_CLINICA || 'M'
             }, { autoCommit: true });
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
