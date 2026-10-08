const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const res = await conn.execute(`
       SELECT a.table_name, a.column_name, b.table_name as ref_table, b.column_name as ref_col
       FROM all_cons_columns a
       JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name
       JOIN all_cons_columns b ON c.r_owner = b.owner AND c.r_constraint_name = b.constraint_name
       WHERE c.constraint_name = 'EVOPACI_TIPEVOL_FK'
     `);
     console.log(res.rows);
  } catch(e) { console.error(e); } finally { if (conn) await conn.close(); process.exit(0); }
}
run();
