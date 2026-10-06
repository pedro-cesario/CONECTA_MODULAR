const db = require('./src/core/database');
const oracledb = require('oracledb');

async function checkLog() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * FROM (
                SELECT ds_xml, nr_seq_assinatura 
                FROM tasy_assinat_dig_log 
                WHERE ie_evento = 'GXML' 
                AND ds_xml IS NOT NULL
                ORDER BY nr_sequencia DESC
            ) WHERE ROWNUM <= 1
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (let row of result.rows) {
            console.log("ASSINATURA:", row.NR_SEQ_ASSINATURA);
            if (row.DS_XML && typeof row.DS_XML.getData === 'function') {
                console.log(await row.DS_XML.getData());
            } else {
                console.log(row.DS_XML);
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
checkLog();
