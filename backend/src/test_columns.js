const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const res = await conn.execute("SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'EVOLUCAO_PACIENTE'");
     console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) { console.error(e); } finally { if (conn) await conn.close(); process.exit(0); }
}
run();
