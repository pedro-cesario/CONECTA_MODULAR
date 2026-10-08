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

        const q1 = `SELECT * FROM PLS_CLINICA WHERE rownum <= 5`;
        try {
            const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
            console.log("PLS_CLINICA:", res1.rows);
        } catch(e) { console.error(e.message); }

        const q2 = `SELECT * FROM CIH_CLINICA WHERE rownum <= 5`;
        try {
            const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
            console.log("CIH_CLINICA:", res2.rows);
        } catch(e) { console.error(e.message); }

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
