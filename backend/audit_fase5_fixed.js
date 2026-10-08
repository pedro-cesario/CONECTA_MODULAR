const oracledb = require('oracledb');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const fs = require('fs');
const candidatePaths = [
  process.env.OCI_LIB_DIR,
  '/tmp/ic19',
  '/opt/oracle/instantclient',
  '/media/SAAS/SAAS/CONECTA_MODULAR/instantclient-files',
  path.resolve(__dirname, 'instantclient-files')
].filter(Boolean);

let thickMode = false;
for (const instantClientPath of candidatePaths) {
  if (fs.existsSync(instantClientPath)) {
    const files = fs.readdirSync(instantClientPath);
    if (files.includes('libclntsh.so.19.1') || files.includes('libclntsh.so')) {
      oracledb.initOracleClient({ libDir: instantClientPath });
      thickMode = true;
      console.log(`[Oracle] Modo Thick ativado - Instant Client em ${instantClientPath}`);
      break;
    }
  }
}

async function run() {
  let connection;
  try {
    connection = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`
    });
    
    console.log("Connected. Querying ALL_SOURCE for obter_resul_glasgow_HEAL...");
    let result = await connection.execute(
      `SELECT TEXT FROM ALL_SOURCE WHERE UPPER(NAME) LIKE '%OBTER_RESUL_GLASGOW%' ORDER BY LINE`
    );
    console.log("Source OBTER_RESUL_GLASGOW:");
    result.rows.forEach(r => console.log(r[0]));

    console.log("Querying ALL_TAB_COLS for ATEND_ESCALA_INDICE...");
    result = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLS WHERE TABLE_NAME = 'ATEND_ESCALA_INDICE'`
    );
    console.log("Columns in ATEND_ESCALA_INDICE:");
    result.rows.forEach(r => console.log(r[0], r[1]));
    
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}
run();
