const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testAss() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT TASY_ASSINATURA_DIGITAL_SEQ.NEXTVAL FROM DUAL
        `;
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log(result.rows);
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
testAss();
