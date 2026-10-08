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

        const q1 = `SELECT table_name FROM all_tables WHERE table_name LIKE '%MOTIVO%INUTILIZACAO%' OR table_name LIKE '%MOTIVO%SENHA%' OR table_name LIKE '%INUTILIZA%' OR table_name LIKE '%DESCARTE%' OR table_name LIKE '%CLINICA%' OR table_name LIKE '%TIPO%ATEND%' OR table_name LIKE '%MOTIVO%ATEND%'`;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Matching tables:");
        console.log(res1.rows.map(r => r.TABLE_NAME));

        const q2 = `SELECT column_name FROM all_tab_columns WHERE table_name = 'TRIAGEM_CLASSIF_RISCO'`;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nColumns in TRIAGEM_CLASSIF_RISCO:");
        console.log(res2.rows.map(r => r.COLUMN_NAME));

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
