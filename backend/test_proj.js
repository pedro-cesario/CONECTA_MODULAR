const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testProj() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * 
            FROM xml_projeto 
            WHERE nr_sequencia = 100049
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log(Object.keys(result.rows[0]));
        
        for (let key of Object.keys(result.rows[0])) {
            let val = result.rows[0][key];
            if (val && typeof val.getData === 'function') {
                console.log(key + ":", await val.getData());
            } else {
                console.log(key + ":", val);
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
