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
            SELECT DISTINCT PACKAGE_NAME, OBJECT_NAME 
            FROM ALL_ARGUMENTS 
            WHERE OBJECT_NAME LIKE '%TRANSFERIR_PAC_FILA%' 
               OR OBJECT_NAME LIKE '%INUTILIZAR_SENHA%'
            ORDER BY PACKAGE_NAME, OBJECT_NAME
        `;
        const res = await connection.execute(q, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("All matching objects in ALL_ARGUMENTS:");
        console.log(res.rows);

        const q2 = `
            SELECT OBJECT_NAME 
            FROM ALL_OBJECTS 
            WHERE OBJECT_TYPE = 'PACKAGE' 
              AND OBJECT_NAME LIKE '%FILA%'
        `;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nPackages with FILA in name:");
        console.log(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
