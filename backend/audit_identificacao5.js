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
      WHERE table_name = 'ATENDIMENTO_PACIENTE'
    `);
    const cols = res.rows.map(r => r.COLUMN_NAME);
    const suspicious = cols.filter(c => c.includes('DESCONHECIDO') || c.includes('N_IDENT') || c.includes('NAO_IDENT') || c.includes('TIPO') || c.includes('COND') || c.includes('IDENT'));
    console.log("Suspicious columns:", suspicious);
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
