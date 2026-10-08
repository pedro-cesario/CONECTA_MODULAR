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
            SELECT a.table_name, a.column_name, a.data_type, a.data_length, c.r_constraint_name, r.table_name as ref_table
            FROM all_tab_columns a
            LEFT JOIN all_cons_columns b ON a.table_name = b.table_name AND a.column_name = b.column_name
            LEFT JOIN all_constraints c ON b.constraint_name = c.constraint_name AND c.constraint_type = 'R'
            LEFT JOIN all_constraints r ON c.r_constraint_name = r.constraint_name
            WHERE a.table_name = 'ATENDIMENTO_PACIENTE' 
              AND a.column_name IN ('IE_CLINICA', 'CD_MOTIVO_ATENDIMENTO')
        `;
        const res1 = await connection.execute(q1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("ATENDIMENTO_PACIENTE Columns:");
        console.log(res1.rows);

        const q2 = `SELECT table_name FROM all_tables WHERE table_name = 'MOTIVO_INUTILIZACAO_SENHA'`;
        const res2 = await connection.execute(q2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("MOTIVO_INUTILIZACAO_SENHA:");
        console.log(res2.rows);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
