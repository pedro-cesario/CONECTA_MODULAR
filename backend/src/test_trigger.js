const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const res = await conn.execute(`
       SELECT TEXT FROM ALL_SOURCE 
       WHERE NAME = 'BLOQUEIO_EVOLUCAO_PACIENTE' 
       AND TYPE = 'TRIGGER' 
       ORDER BY LINE
     `);
     console.log(res.rows.map(r => r.TEXT).join(''));
  } catch(e) { console.error(e); } finally { if (conn) await conn.close(); process.exit(0); }
}
run();
