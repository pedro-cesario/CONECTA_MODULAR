const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testXML() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            BEGIN
                :xmlOut := WHEB_EXPORTAR_XML_PCK.EXPORTAR_GET_CLOB(
                    100049,
                    NULL,
                    NULL,
                    'NR_SEQUENCIA=2429406;',
                    'A'
                );
            END;
        `;
        
        const result = await conn.execute(sql, {
            xmlOut: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_CLOB }
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
            } catch(err) {
               console.error(err);
            }
        }
        process.exit(0);
    }
}

testXML();
