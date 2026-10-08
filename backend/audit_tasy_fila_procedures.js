const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
const fs = require('fs');
const oracledb = require('oracledb');
oracledb.fetchAsString = [oracledb.CLOB];

async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  try {
    const procs = await conn.execute(`
      SELECT distinct name FROM all_source
      WHERE text LIKE '%PACIENTE_SENHA_FILA%'
      AND ROWNUM <= 100
    `);
    const names = procs.rows.map(r => r.NAME);
    console.log("Procedures referencing PACIENTE_SENHA_FILA:", names.join(', '));
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
