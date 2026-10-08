const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./src/core/database/index.js');
const fs = require('fs');

async function run() {
  await db.initPool();
  const conn = await db.getConnection();
  const results = {};

  try {
    // 1. CLASSIFICACAO DA PESSOA
    console.log("Checking CLASSIF_PESSOA...");
    const cp = await conn.execute(`SELECT column_name FROM all_tab_columns WHERE table_name = 'CLASSIF_PESSOA'`);
    results.classif_pessoa_cols = cp.rows.map(r => r.COLUMN_NAME);

    console.log("Checking PESSOA_CLASSIF...");
    const pc = await conn.execute(`SELECT column_name FROM all_tab_columns WHERE table_name = 'PESSOA_CLASSIF'`);
    results.pessoa_classif_cols = pc.rows.map(r => r.COLUMN_NAME);

    console.log("Getting classification for 410252...");
    // Let's assume PESSOA_CLASSIF has CD_PESSOA_FISICA and NR_SEQ_CLASSIF
    try {
      const classif_data = await conn.execute(`
        SELECT pc.*, cp.ds_classificacao 
        FROM PESSOA_CLASSIF pc
        LEFT JOIN CLASSIF_PESSOA cp ON pc.nr_seq_classificacao = cp.nr_sequencia
        WHERE pc.cd_pessoa_fisica = 410252
      `);
      results.paciente_410252 = classif_data.rows;
    } catch(e) {
      console.log("Error querying PESSOA_CLASSIF with standard columns, trying alternative...", e.message);
      // fallback just select * from PESSOA_CLASSIF where cd_pessoa_fisica = 410252
      const classif_data = await conn.execute(`SELECT * FROM PESSOA_CLASSIF WHERE cd_pessoa_fisica = 410252`);
      results.paciente_410252 = classif_data.rows;
    }

    console.log("Looking for procedures related to PESSOA_CLASSIF...");
    const procPC = await conn.execute(`
      SELECT distinct name, type 
      FROM all_source 
      WHERE text LIKE '%PESSOA_CLASSIF%' AND type IN ('PROCEDURE', 'PACKAGE BODY', 'FUNCTION')
    `);
    results.procs_pessoa_classif = procPC.rows;

    // 2. PACIENTE NAO IDENTIFICADO (PESSOA_FISICA)
    console.log("Checking constraints on PESSOA_FISICA (NM_PESSOA_FISICA)...");
    const pfConstraints = await conn.execute(`
      SELECT c.constraint_name, c.constraint_type, cc.column_name
      FROM all_constraints c
      JOIN all_cons_columns cc ON c.constraint_name = cc.constraint_name
      WHERE c.table_name = 'PESSOA_FISICA' AND c.constraint_type IN ('U', 'P')
    `);
    results.pf_unique_constraints = pfConstraints.rows;

    console.log("Checking NOT NULL constraints on CPF and DT_NASCIMENTO...");
    const pfCols = await conn.execute(`
      SELECT column_name, nullable
      FROM all_tab_columns
      WHERE table_name = 'PESSOA_FISICA' AND column_name IN ('NR_CPF', 'DT_NASCIMENTO', 'NM_PESSOA_FISICA', 'NM_MAE')
    `);
    results.pf_nullability = pfCols.rows;

    console.log("Looking for UNIFICAR procedures...");
    const procUnif = await conn.execute(`
      SELECT distinct name 
      FROM all_source 
      WHERE UPPER(name) LIKE '%UNIFICAR%PESSOA%' OR UPPER(name) LIKE '%UNIFICACAO%' OR UPPER(name) LIKE '%PFCS%UNIFIC%' OR UPPER(name) LIKE 'WHEB%UNIFIC%'
    `);
    results.procs_unificar = procUnif.rows;

    console.log("Looking for INSERT PESSOA_FISICA procedures...");
    const procInsert = await conn.execute(`
      SELECT distinct name 
      FROM all_source 
      WHERE UPPER(name) LIKE 'INSERIR%PESSOA%FISICA%' OR UPPER(name) LIKE 'CADASTRAR%PESSOA%'
    `);
    results.procs_inserir_pf = procInsert.rows;

    // 3. CORES DA TRIAGEM
    console.log("Checking TRIAGEM_CLASSIF_RISCO...");
    const triagemCols = await conn.execute(`
      SELECT nr_sequencia, ds_classificacao, ds_cor_html, ie_situacao, cd_estabelecimento
      FROM TRIAGEM_CLASSIF_RISCO
      ORDER BY nr_sequencia
    `);
    results.triagem_risco = triagemCols.rows;

    fs.writeFileSync(path.resolve(__dirname, 'audit_fase2_results.json'), JSON.stringify(results, null, 2));
    console.log("Done.");

  } catch (e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    await db.closePool();
  }
}
run();
