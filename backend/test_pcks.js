const db = require('./src/core/database');
const oracledb = require('oracledb');

async function checkPcks() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT object_name
            FROM all_objects 
            WHERE object_name LIKE '%ASSINATURA_DIGITAL%' 
            AND object_type IN ('PACKAGE', 'PROCEDURE', 'FUNCTION')
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log("Objects:", result.rows.map(r => r.OBJECT_NAME));
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch(err) {}
        }
        process.exit(0);
    }
}
checkPcks();
