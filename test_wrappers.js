require('dotenv').config();
const oracledb = require('oracledb');

async function run() {
    oracledb.initOracleClient({ libDir: './instantclient-files' });
    let connection;
    try {
        connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`
        });

        console.log("Connected to database...");
        
        const argsQuery = `
            SELECT OBJECT_NAME, ARGUMENT_NAME, DATA_TYPE, IN_OUT, POSITION 
            FROM ALL_ARGUMENTS 
            WHERE PACKAGE_NAME = 'ATENDIMENTO_FILA_TASY_PKG' 
              AND OBJECT_NAME IN ('TRANSFERIR_PAC_FILA_W', 'INUTILIZAR_SENHA_W')
            ORDER BY OBJECT_NAME, POSITION
        `;
        
        const resultArgs = await connection.execute(argsQuery, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Arguments for Wrappers:");
        console.log(resultArgs.rows);

        const sourceQuery = `
            SELECT TEXT 
            FROM ALL_SOURCE 
            WHERE NAME = 'ATENDIMENTO_FILA_TASY_PKG' 
              AND TYPE = 'PACKAGE BODY' 
              AND (UPPER(TEXT) LIKE '%TRANSFERIR_PAC_FILA_W%' OR UPPER(TEXT) LIKE '%INUTILIZAR_SENHA_W%')
            ORDER BY LINE
        `;
        
        const resultSource = await connection.execute(sourceQuery, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nSource mentions (if any):");
        console.log(resultSource.rows);

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
