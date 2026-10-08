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
            SELECT TEXT 
            FROM ALL_SOURCE 
            WHERE NAME IN ('TRANSFERIR_PAC_FILA', 'INUTILIZAR_SENHA') 
              AND UPPER(TEXT) LIKE '%COMMIT%'
            ORDER BY NAME, LINE
        `;
        const res = await connection.execute(q, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
