const oracledb = require('oracledb');
require('dotenv').config();

const path = require('path');
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

async function testConnection() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`
        });
        
        console.log('Connected successfully!');
        
        // Check if WHEB_EXPORTAR_XML_PCK exists
        const result = await connection.execute(
            `SELECT object_type FROM all_objects WHERE object_name = 'WHEB_EXPORTAR_XML_PCK'`
        );
        console.log('WHEB_EXPORTAR_XML_PCK exists:', result.rows);
        
        // Check if project 100049 exists
        const projResult = await connection.execute(
            `SELECT * FROM xml_projeto WHERE nr_sequencia = 100049`
        );
        console.log('XML_PROJETO 100049 exists:', projResult.rows.length > 0);

        // Check if tasy_assinatura_digital exists
        const tabResult = await connection.execute(
            `SELECT table_name FROM all_tables WHERE table_name = 'TASY_ASSINATURA_DIGITAL'`
        );
        console.log('TASY_ASSINATURA_DIGITAL exists:', tabResult.rows);
        
        // Check function verifica_se_assinado
        const funcResult = await connection.execute(
            `SELECT object_type FROM all_objects WHERE object_name = 'VERIFICA_SE_ASSINADO'`
        );
        console.log('VERIFICA_SE_ASSINADO exists:', funcResult.rows);
        
        // Check procedure tasy_gravar_assinatura_digital
        const gravResult = await connection.execute(
            `SELECT object_type FROM all_objects WHERE object_name = 'TASY_GRAVAR_ASSINATURA_DIGITAL'`
        );
        console.log('TASY_GRAVAR_ASSINATURA_DIGITAL exists:', gravResult.rows);

    } catch (err) {
        console.error('Error connecting to database:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Connection closed.');
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

testConnection();
