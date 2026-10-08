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

        const q1 = `SELECT DISTINCT ie_clinica FROM atendimento_paciente WHERE ie_clinica IS NOT NULL FETCH FIRST 10 ROWS ONLY`;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Distinct IE_CLINICA values:");
        console.log(res1.rows);

        const q2 = `SELECT DISTINCT cd_motivo_atendimento FROM atendimento_paciente WHERE cd_motivo_atendimento IS NOT NULL FETCH FIRST 10 ROWS ONLY`;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Distinct CD_MOTIVO_ATENDIMENTO values:");
        console.log(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
