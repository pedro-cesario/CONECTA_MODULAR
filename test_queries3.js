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

        const q2 = `SELECT cd_dominio, ds_dominio FROM dominio WHERE UPPER(ds_dominio) LIKE '%CLÍNICA%' OR UPPER(ds_dominio) LIKE '%CLINICA%' OR UPPER(ds_dominio) LIKE '%MOTIVO%ATEND%'`;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("DOMINIO CLINICA / MOTIVO:");
        console.log(res2.rows);

        const q3 = `SELECT vl_dominio, ds_valor_dominio FROM valor_dominio WHERE cd_dominio = 12`;
        const res3 = await connection.execute(q3, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nVALOR_DOMINIO TIPO_ATENDIMENTO (12):");
        console.log(res3.rows);

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
