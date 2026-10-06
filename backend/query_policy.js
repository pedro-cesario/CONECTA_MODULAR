require('dotenv').config({ path: '../.env' });
const oracledb = require('oracledb');

async function run() {
    let connection;
    try {
        console.log("Connecting with user:", process.env.DB_USER);
        connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECTION_STRING
        });

        // Search for tables related to signature policy
        const result = await connection.execute(
            `SELECT table_name FROM all_tables WHERE table_name LIKE '%POLICY%' OR table_name LIKE '%POLITICA%' OR table_name LIKE '%ASSINAT%'`
        );
        console.log("Tables found:", result.rows.map(r => r[0]).join(", "));
        
        // Also let's check TASY_ASSINATURA_DIGITAL schema
        const cols = await connection.execute(
            `SELECT column_name FROM all_tab_columns WHERE table_name = 'TASY_ASSINATURA_DIGITAL'`
        );
        console.log("TASY_ASSINATURA_DIGITAL cols:", cols.rows.map(r => r[0]).join(", "));
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
}
run();
