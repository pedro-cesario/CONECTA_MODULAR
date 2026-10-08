const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const src1 = await conn.execute(`SELECT text FROM all_source WHERE name = 'INUTILIZAR_SENHA' ORDER BY line`);
    console.log("=== INUTILIZAR_SENHA ===");
    console.log(src1.rows.map(r => r.TEXT).join(''));

    const src2 = await conn.execute(`SELECT text FROM all_source WHERE name = 'TRANSFERIR_PAC_FILA' ORDER BY line`);
    console.log("=== TRANSFERIR_PAC_FILA ===");
    console.log(src2.rows.map(r => r.TEXT).join(''));
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
