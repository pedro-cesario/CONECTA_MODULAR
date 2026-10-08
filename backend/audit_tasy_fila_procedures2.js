const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const procs = await conn.execute(`
      SELECT distinct name FROM all_source
      WHERE text LIKE '%INUTILIZA%' OR text LIKE '%DESCARTA%' OR text LIKE '%inutiliza%'
    `);
    const names = procs.rows.map(r => r.NAME);
    console.log("Procedures with INUTILIZA:", names.filter(n => n.includes('SENHA') || n.includes('FILA')).join(', '));
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
