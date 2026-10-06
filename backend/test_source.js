const db = require('./src/core/database');
const oracledb = require('oracledb');

async function checkPcks() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT text
            FROM all_source 
            WHERE name = 'WHEB_EXPORTAR_XML_PCK'
            AND type = 'PACKAGE BODY'
            AND line BETWEEN 1650 AND 1720
            ORDER BY line
        `;
        
        const result = await conn.execute(sql);
        console.log("Source:\n", result.rows.map(r => r[0]).join(''));
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
checkPcks();
