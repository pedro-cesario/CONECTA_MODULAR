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

        const q1 = `SELECT object_name, object_type, owner FROM all_objects WHERE object_name = 'CLINICA'`;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("CLINICA Objects:");
        console.log(res1.rows);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
