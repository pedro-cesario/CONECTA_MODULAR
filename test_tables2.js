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
            SELECT table_name 
            FROM all_tables 
            WHERE table_name LIKE '%TIPO%ATEND%' OR table_name LIKE '%CLINICA%' OR table_name LIKE '%MOTIVO%ATEND%'
        `;
        const res = await connection.execute(q, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log(res.rows.map(r => r.TABLE_NAME));
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
