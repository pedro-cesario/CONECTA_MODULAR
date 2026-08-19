const { getConnection } = require('./backend/database');
async function run() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`SELECT table_name FROM all_tables WHERE table_name LIKE '%REGISTRO_TURNO%'`);
    console.log(result.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await conn.close();
    process.exit(0);
  }
}
run();
