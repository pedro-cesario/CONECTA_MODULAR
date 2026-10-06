const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testProj() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT DS_SQL 
            FROM XML_ELEMENTO
            WHERE nr_sequencia = 4734
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        for (let row of result.rows) {
            if (row.DS_SQL && typeof row.DS_SQL.getData === 'function') {
                console.log("SQL:", await row.DS_SQL.getData());
            } else {
                console.log("SQL:", row.DS_SQL);
            }
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
