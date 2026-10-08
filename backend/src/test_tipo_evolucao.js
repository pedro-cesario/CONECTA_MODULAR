const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const res = await conn.execute(`
       SELECT IE_TIPO_EVOLUCAO FROM EVOLUCAO_PACIENTE WHERE ROWNUM <= 5
     `);
     console.log(res.rows);
  } catch(e) { console.error(e); } finally { if (conn) await conn.close(); process.exit(0); }
}
run();
