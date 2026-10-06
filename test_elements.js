const { getConnection } = require('./backend/src/core/database/index.js');
async function run() {
  const conn = await getConnection();
  const elemRes = await conn.execute(`
    SELECT c.NR_SEQUENCIA, c.NR_SEQ_ELEMENTO, NVL(c.DS_LABEL, NVL(e.DS_LABEL_TELA, e.NM_ELEMENTO)) AS LABEL, c.QT_TAMANHO, e.IE_COMPONENTE, e.NR_SEQ_TIPO_DADO
    FROM EHR_TEMPLATE_CONTEUDO c
    LEFT JOIN EHR_ELEMENTO e ON e.NR_SEQUENCIA = c.NR_SEQ_ELEMENTO
    WHERE c.NR_SEQ_TEMPLATE = '100051' AND c.IE_SITUACAO = 'A'
    ORDER BY c.NR_SEQ_APRES ASC
  `);
  console.log(elemRes.rows.map(r => ({ seq: r.NR_SEQUENCIA, label: r.LABEL, comp: r.IE_COMPONENTE, tipo: r.NR_SEQ_TIPO_DADO })));
  await conn.close();
}
run();
