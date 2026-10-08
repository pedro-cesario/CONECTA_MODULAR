const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const unif = await conn.execute(`SELECT object_name, object_type FROM all_objects WHERE object_name LIKE '%UNIFICAR%' AND object_type IN ('PROCEDURE', 'PACKAGE')`);
    console.log("UNIFICAR objects:", unif.rows);

    const seq = await conn.execute(`SELECT sequence_name FROM all_sequences WHERE sequence_name = 'PESSOA_CLASSIF_SEQ'`);
    console.log("PESSOA_CLASSIF sequence:", seq.rows);
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
