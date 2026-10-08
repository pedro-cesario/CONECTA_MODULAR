const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
const oracledb = require('oracledb');
oracledb.fetchAsString = [oracledb.CLOB];

async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const res = await conn.execute(`
      SELECT trigger_name
      FROM all_triggers 
      WHERE table_name = 'ATENDIMENTO_PACIENTE'
      AND ROWNUM <= 5
    `);
    console.log("Triggers found:", res.rows.length);
    for (const r of res.rows) {
       console.log("Fetching DDL for", r.TRIGGER_NAME);
       try {
         const ddl = await conn.execute(`SELECT DBMS_METADATA.GET_DDL('TRIGGER', :t) AS DDL FROM DUAL`, { t: r.TRIGGER_NAME });
         const text = await ddl.rows[0].DDL.getData();
         console.log("Got DDL length:", text.length);
       } catch (e) {
         console.error("Error for", r.TRIGGER_NAME, e.message);
       }
    }
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
