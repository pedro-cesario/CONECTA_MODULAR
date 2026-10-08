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

        const q1 = `
            SELECT table_name, column_name 
            FROM all_tab_columns 
            WHERE column_name LIKE '%MOTIVO%ATEND%' OR column_name = 'CD_MOTIVO_ATENDIMENTO'
        `;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Tables with %MOTIVO%ATEND% columns:");
        console.log(res1.rows.slice(0, 20));

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
