const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`
      SELECT table_name, column_name 
      FROM all_tab_columns 
      WHERE column_name LIKE '%CONDICAO_IDENT%' OR column_name LIKE '%IDENTIFICACAO_PAC%'
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
