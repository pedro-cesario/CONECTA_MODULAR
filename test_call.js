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

        await connection.execute(`
            DECLARE
              v_erro VARCHAR2(2000);
            BEGIN
              TRANSFERIR_PAC_FILA(
                nr_seq_fila_nova_p => -1,
                nr_seq_fila_atual_p => -1,
                cd_senha_p => -1,
                nr_seq_senha_p => -1,
                ds_erro_p => v_erro
              );
            END;
        `);
        console.log("Call succeeded (no PLS-00306)!");
        await connection.rollback();
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}
run();
