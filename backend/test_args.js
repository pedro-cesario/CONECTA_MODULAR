const db = require('./src/core/database');
const oracledb = require('oracledb');

async function checkArgs() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            SELECT argument_name, data_type, in_out, position 
            FROM all_arguments 
            WHERE package_name = 'WHEB_EXPORTAR_XML_PCK' 
            AND object_name = 'EXPORTAR_GET_CLOB'
            ORDER BY position
        `;
        
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        console.log(result.rows);
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
checkArgs();
