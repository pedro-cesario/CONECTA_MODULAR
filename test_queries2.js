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

        const q1 = `SELECT nr_sequencia, ds_classificacao, ds_cor FROM TRIAGEM_CLASSIF_RISCO WHERE ROWNUM <= 20`;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("TRIAGEM_CLASSIF_RISCO:");
        console.log(res1.rows);

        const q2 = `SELECT cd_dominio, ds_dominio FROM dominio WHERE cd_dominio IN (2, 3, 5, 23, 14, 21, 6) OR UPPER(ds_dominio) LIKE '%CLINICA%' OR UPPER(ds_dominio) LIKE '%TIPO%ATEND%' OR UPPER(ds_dominio) LIKE '%MOTIVO%ATEND%'`;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("\nDOMINIO:");
        console.log(res2.rows.slice(0, 10));

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
