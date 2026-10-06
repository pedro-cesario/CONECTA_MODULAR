const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testProj() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * 
            FROM XML_ELEMENTO
            WHERE nr_seq_projeto = 100049
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        console.log(Object.keys(result.rows[0] || {}));
        
        for (let row of result.rows) {
            console.log(row.NR_SEQUENCIA, row.DS_ELEMENTO, row.DS_FUNCAO_BANCO, row.DS_TEXTO);
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
