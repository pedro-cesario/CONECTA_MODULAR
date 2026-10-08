const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const res = await conn.execute(`
       SELECT CD_EVOLUCAO, CD_MEDICO, NM_USUARIO, DT_ATUALIZACAO, CD_PESSOA_FISICA 
       FROM EVOLUCAO_PACIENTE 
       WHERE NR_ATENDIMENTO = 773927 
       ORDER BY CD_EVOLUCAO DESC
     `);
     console.log(res.rows);
  } catch(e) { console.error(e); } finally { if (conn) await conn.close(); process.exit(0); }
}
run();
