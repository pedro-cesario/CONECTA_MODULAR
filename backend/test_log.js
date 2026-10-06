const db = require('./src/core/database');
const oracledb = require('oracledb');

async function checkLog() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * FROM (
                SELECT ds_log, nr_seq_assinatura 
                FROM tasy_assinat_dig_log 
                WHERE ie_evento = 'GXML' 
                ORDER BY nr_sequencia DESC
            ) WHERE ROWNUM <= 1
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (let row of result.rows) {
            console.log(row.NR_SEQ_ASSINATURA);
            if (row.DS_LOG && typeof row.DS_LOG.getData === 'function') {
                console.log(await row.DS_LOG.getData());
            } else {
                console.log(row.DS_LOG);
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
