const { getPool, execute } = require('./src/core/database');
async function run() {
  try {
    const pool = await getPool(); // ensure pool initializes
    console.log("Querying ALL_SOURCE for obter_resul_glasgow_HEAL...");
    let result = await execute(
      `SELECT TEXT FROM ALL_SOURCE WHERE UPPER(NAME) LIKE '%OBTER_RESUL_GLASGOW%' ORDER BY LINE`
    );
    console.log("Source OBTER_RESUL_GLASGOW:");
    result.rows.forEach(r => console.log(r.TEXT || r[0]));

    console.log("Querying ALL_TAB_COLS for ATEND_ESCALA_INDICE...");
    result = await execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLS WHERE TABLE_NAME = 'ATEND_ESCALA_INDICE'`
    );
    console.log("Columns in ATEND_ESCALA_INDICE:");
    result.rows.forEach(r => console.log(r.COLUMN_NAME || r[0], r.DATA_TYPE || r[1]));
    
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
