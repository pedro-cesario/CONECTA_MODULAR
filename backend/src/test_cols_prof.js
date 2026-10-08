const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const tables = ['EVOLUCAO_PACIENTE', 'ATENDIMENTO_SINAL_VITAL', 'ATEND_ESCALA_INDICE', 'PACIENTE_ALERGIA'];
     const results = {};
     for (const t of tables) {
       const res = await conn.execute(`
         SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS 
         WHERE TABLE_NAME = :t 
           AND (COLUMN_NAME LIKE '%MEDICO%' OR COLUMN_NAME LIKE '%PROFISSIONAL%' OR COLUMN_NAME LIKE '%PESSOA%')
       `, [t]);
       results[t] = res.rows.map(r => r.COLUMN_NAME);
     }
     console.log(JSON.stringify(results, null, 2));
  } catch(e) { console.error(e); } finally { if (conn) await conn.close(); process.exit(0); }
}
run();
