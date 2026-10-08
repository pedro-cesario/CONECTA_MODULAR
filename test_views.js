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
            SELECT object_name, object_type 
            FROM all_objects 
            WHERE object_name IN ('PROCEDENCIA', 'CLINICA', 'TIPO_ATENDIMENTO', 'MOTIVO_ATENDIMENTO')
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
