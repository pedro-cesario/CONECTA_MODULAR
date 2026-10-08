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
    // 1. Constraints on ATENDIMENTO_PACIENTE.NR_SEQ_TRIAGEM and IE_STATUS_PA
    console.log("Fetching constraints for ATENDIMENTO_PACIENTE columns...");
    const constraintsRes = await conn.execute(`
      SELECT c.constraint_name, c.constraint_type, c.search_condition, cc.column_name, r.table_name as ref_table, r.constraint_name as ref_constraint
      FROM all_constraints c
      JOIN all_cons_columns cc ON c.constraint_name = cc.constraint_name
      LEFT JOIN all_constraints r ON c.r_constraint_name = r.constraint_name
      WHERE c.table_name = 'ATENDIMENTO_PACIENTE'
        AND cc.column_name IN ('NR_SEQ_TRIAGEM', 'IE_STATUS_PA')
    `);
    results.constraints = constraintsRes.rows;

    // 2. Fetch procedure source: BIFROST_INTEGRACAO_SENHAS
    console.log("Fetching source for BIFROST_INTEGRACAO_SENHAS...");
    const bifrostSrc = await conn.execute(`
      SELECT text FROM all_source 
      WHERE name = 'BIFROST_INTEGRACAO_SENHAS' 
      ORDER BY line
    `);
    results.bifrost_integracao_senhas = bifrostSrc.rows.map(r => r.TEXT).join('');

    // 3. Fetch procedure source: ATUALIZAR_SENHA_MONITOR
    console.log("Fetching source for ATUALIZAR_SENHA_MONITOR...");
    const monitorSrc = await conn.execute(`
      SELECT text FROM all_source 
      WHERE name = 'ATUALIZAR_SENHA_MONITOR' 
      ORDER BY line
    `);
    results.atualizar_senha_monitor = monitorSrc.rows.map(r => r.TEXT).join('');

    // 4. Triggers on ATENDIMENTO_PACIENTE
    // LONG cannot be queried easily. So we will fetch them one by one using a specific table or just fetch first 32kb with DBMS_METADATA.GET_DDL
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
         const text = await ddl.rows[0].DDL.getData(); // CLOB
         if (text.toUpperCase().includes('NR_SEQ_TRIAGEM') || text.toUpperCase().includes('IE_STATUS_PA')) {
            results.triggers_atendimento_paciente.push({ trigger_name: r.TRIGGER_NAME, body: text });
         }
       } catch (e) {
          // ignore privileges errors
       }
    }

    // 5. Triggers on PACIENTE_SENHA_FILA
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
         const text = await ddl.rows[0].DDL.getData(); // CLOB
         results.triggers_paciente_senha_fila.push({ trigger_name: r.TRIGGER_NAME, body: text });
       } catch (e) {
       }
    }

    // 6. Look for tables related to TRIAGEM / CLASSIFICACAO
    console.log("Fetching tables related to TRIAGEM...");
    const tablesTriagem = await conn.execute(`
      SELECT table_name FROM all_tables WHERE table_name LIKE '%TRIAGEM%' OR table_name LIKE '%CLASSIFICACAO%'
    `);
    results.tables_triagem = tablesTriagem.rows;

    // Output to a file for easier reading
    fs.writeFileSync(path.resolve(__dirname, 'audit_results.json'), JSON.stringify(results, null, 2));
    console.log("Audit complete. Results saved to audit_results.json");

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}

run();
