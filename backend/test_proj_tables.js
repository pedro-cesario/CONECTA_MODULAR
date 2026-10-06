const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testProj() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * 
            FROM all_tables
            WHERE table_name LIKE 'XML_%'
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        for (let row of result.rows) {
            console.log(row.TABLE_NAME);
        }
        
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
testProj();
