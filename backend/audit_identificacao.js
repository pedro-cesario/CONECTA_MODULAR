const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`
      SELECT column_name 
      FROM all_tab_columns 
      WHERE table_name IN ('ATENDIMENTO_PACIENTE', 'PESSOA_FISICA')
      AND (column_name LIKE '%IDENT%' OR column_name LIKE '%COND%' OR column_name LIKE '%DESC%')
    `);
    console.log(res.rows.map(r => r.COLUMN_NAME));
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
