const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testXML() {
    let conn;
    try {
        conn = await db.getConnection();
        const seqSql = `SELECT TASY_XML_BANCO_SEQ.NEXTVAL FROM DUAL`;
        let nrSeqLog = null;
        try {
            const seqResult = await conn.execute(seqSql);
            nrSeqLog = seqResult.rows[0][0];
        } catch (e) {
            console.log("No TASY_XML_BANCO_SEQ sequence found.");
        }

        const sql = `
            BEGIN
                :xmlOut := WHEB_EXPORTAR_XML_PCK.EXPORTAR_GET_CLOB(
                    100049,
                    :log_seq,
                    'A', -- IE_TIPO_P (perhaps A for Assinatura?)
                    'NR_SEQUENCIA=2429406;',
                    'A'
                );
            END;
        `;
        
        const result = await conn.execute(sql, {
            xmlOut: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_CLOB },
            log_seq: nrSeqLog || 1
        });
        
        const clob = result.outBinds.xmlOut;
        
        if (clob) {
            let data = await clob.getData();
            console.log("XML Output:");
            console.log(data);
        } else {
            console.log("No XML returned.");
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

testXML();
