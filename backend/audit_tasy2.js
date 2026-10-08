const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
const fs = require('fs');
const oracledb = require('oracledb');
oracledb.fetchAsString = [oracledb.CLOB];

async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  const results = {};
  
  try {
    console.log("Fetching triggers for ATENDIMENTO_PACIENTE...");
    const triggersAp = await conn.execute(`
      SELECT trigger_name
      FROM all_triggers 
      WHERE table_name = 'ATENDIMENTO_PACIENTE'
    `);
    results.triggers_atendimento_paciente = [];
    for (const r of triggersAp.rows) {
       try {
         const ddl = await conn.execute(`SELECT DBMS_METADATA.GET_DDL('TRIGGER', :t) AS DDL FROM DUAL`, { t: r.TRIGGER_NAME });
         const text = ddl.rows[0].DDL;
         if (text.toUpperCase().includes('NR_SEQ_TRIAGEM') || text.toUpperCase().includes('IE_STATUS_PA')) {
            results.triggers_atendimento_paciente.push({ trigger_name: r.TRIGGER_NAME, body: text });
         }
       } catch (e) {
       }
    }

    console.log("Fetching triggers for PACIENTE_SENHA_FILA...");
    const triggersFila = await conn.execute(`
      SELECT trigger_name
      FROM all_triggers 
      WHERE table_name = 'PACIENTE_SENHA_FILA'
    `);
    results.triggers_paciente_senha_fila = [];
    for (const r of triggersFila.rows) {
       try {
         const ddl = await conn.execute(`SELECT DBMS_METADATA.GET_DDL('TRIGGER', :t) AS DDL FROM DUAL`, { t: r.TRIGGER_NAME });
         const text = ddl.rows[0].DDL;
         if (text.toUpperCase().includes('NR_SEQ_TRIAGEM') || text.toUpperCase().includes('IE_STATUS_PA')) {
           results.triggers_paciente_senha_fila.push({ trigger_name: r.TRIGGER_NAME, body: text });
         }
       } catch (e) {
       }
    }

    fs.writeFileSync(path.resolve(__dirname, 'audit_results2.json'), JSON.stringify(results, null, 2));
    console.log("Done.");

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
