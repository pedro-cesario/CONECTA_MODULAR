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

        const q1 = `SELECT object_name, object_type FROM all_objects WHERE object_name IN ('CLINICA', 'MOTIVO_ATENDIMENTO', 'MOTIVO_ATEND')`;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Objects:");
        console.log(res1.rows);

        const q2 = `SELECT vl_dominio, ds_valor_dominio FROM valor_dominio WHERE cd_dominio = 10580`;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nVALOR_DOMINIO 10580:");
        console.log(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
