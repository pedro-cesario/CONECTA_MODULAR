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

        const q = `
            SELECT OWNER, OBJECT_NAME, OBJECT_TYPE 
            FROM ALL_OBJECTS 
            WHERE OBJECT_NAME LIKE '%INUTILIZAR_SENHA%' OR OBJECT_NAME LIKE '%TRANSFERIR_PAC_FILA%'
        `;
        const res = await connection.execute(q, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Objects found:");
        console.log(res.rows);

        const q2 = `
            SELECT PACKAGE_NAME, OBJECT_NAME, ARGUMENT_NAME, IN_OUT, DATA_TYPE, POSITION
            FROM ALL_ARGUMENTS 
            WHERE OBJECT_NAME LIKE '%INUTILIZAR_SENHA%' OR OBJECT_NAME LIKE '%TRANSFERIR_PAC_FILA%'
            ORDER BY PACKAGE_NAME, OBJECT_NAME, POSITION
        `;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nArguments found:");
        console.log(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
