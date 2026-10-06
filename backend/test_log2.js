const db = require('./src/core/database');
const oracledb = require('oracledb');

async function checkLog() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * FROM tasy_assinat_dig_log
            WHERE ROWNUM <= 1
        `;
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log(Object.keys(result.rows[0]));
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
checkLog();
