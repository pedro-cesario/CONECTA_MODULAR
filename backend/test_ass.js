const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testAss() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT * FROM tasy_assinatura_digital
            WHERE nr_sequencia = 3950708
        `;
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (let row of result.rows) {
            console.log(Object.keys(row));
            console.log("NR_SEQ_PROJ_ASS:", row.NR_SEQ_PROJ_ASS);
            console.log("NR_SEQ_PROJ_XML:", row.NR_SEQ_PROJ_XML);
            console.log("CD_CLASSIF_RELAT:", row.CD_CLASSIF_RELAT);
            console.log("CD_RELATORIO:", row.CD_RELATORIO);
            console.log("DS_HASH_ASSINATURA:", row.DS_HASH_ASSINATURA);
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
testAss();
