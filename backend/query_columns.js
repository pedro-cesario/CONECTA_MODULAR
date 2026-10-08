require('dotenv').config();
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    let result = await conn.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'ATEND_ESCALA_INDICE'`);
    console.log("ATEND_ESCALA_INDICE:", result.rows.map(r => r[0]));
    result = await conn.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'PACIENTE_ALERGIA'`);
    console.log("PACIENTE_ALERGIA:", result.rows.map(r => r[0]));
  } catch (e) { console.error(e); } finally { if (conn) await conn.close(); await db.closePool(); }
}
run();
