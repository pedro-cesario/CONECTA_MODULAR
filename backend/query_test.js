const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function run() {
  const conn = await oracledb.getConnection({
    user: 'tasy',
    password: 'sa',
    connectString: 'oracle-db:1521/XEPDB1'
  });
  
  const elemRes = await conn.execute(`
    SELECT c.NR_SEQUENCIA, c.NR_SEQ_ELEMENTO, c.DS_LABEL, c.QT_TAMANHO, e.NM_ELEMENTO, e.DS_LABEL_TELA, e.IE_COMPONENTE, e.NR_SEQ_TIPO_DADO 
    FROM EHR_TEMPLATE_CONTEUDO c
    LEFT JOIN EHR_ELEMENTO e ON e.NR_SEQUENCIA = c.NR_SEQ_ELEMENTO
    WHERE c.NR_SEQ_TEMPLATE = '100051' AND c.IE_SITUACAO = 'A'
    ORDER BY c.NR_SEQ_APRES ASC
  `);
  
  console.log("Total elementos:", elemRes.rows.length);
  // Ache os que tem checkbox
  const checkboxes = elemRes.rows.filter(r => r.IE_COMPONENTE === 'cb' || r.IE_COMPONENTE === 'chk' || r.IE_COMPONENTE === 'ck');
  console.log("Checkboxes found:", checkboxes.length, "exemplos:", checkboxes.slice(0, 3));
  
  // Ache 288932, 288950, 288985
  const alvos = elemRes.rows.filter(r => ['288932', '288950', '288985'].includes(String(r.NR_SEQUENCIA)));
  console.log("Alvos:", alvos);
  
  // Quais IE_COMPONENTE existem?
  const comps = [...new Set(elemRes.rows.map(r => r.IE_COMPONENTE))];
  console.log("Tipos de IE_COMPONENTE no template:", comps);
  
  await conn.close();
}
run().catch(console.error);
