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
        SELECT c.*, e.NM_ELEMENTO, e.DS_LABEL_TELA, e.IE_COMPONENTE 
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
  // TODO: implement Tasy procedure call
  res.json({ success: true, message: 'Em construção' });
}

module.exports = {
  getTemplateStructure,
  saveEHRRegistro
};
