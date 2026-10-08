const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`SELECT nr_sequencia, ds_classificacao, ie_situacao FROM CLASSIF_PESSOA WHERE nr_sequencia IN (1, 2, 3) OR ds_classificacao LIKE '%identifica%'`);
    console.log("Classificacoes:", res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
