const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
const fs = require('fs');

async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`
      SELECT nr_sequencia, ds_classificacao, ds_cor, ds_cor_html, ie_situacao 
      FROM TRIAGEM_CLASSIF_RISCO
      WHERE ROWNUM <= 20
    `);
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
