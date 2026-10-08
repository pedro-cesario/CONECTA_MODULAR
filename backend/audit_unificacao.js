const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`
      SELECT distinct name 
      FROM all_source 
      WHERE (name LIKE '%UNIFIC%' AND name LIKE '%PAC%')
         OR (name LIKE '%UNIFIC%' AND name LIKE '%PF%')
    `);
    console.log(res.rows.map(r => r.NAME));
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
