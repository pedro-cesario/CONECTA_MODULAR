const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testGen() {
    let conn;
    try {
        conn = await db.getConnection();
        const cdMedico = 407801; // My cd_medico
        
        const sqlQuery = `
            SELECT nr_cpf FROM pessoa_fisica WHERE cd_pessoa_fisica = :cdMedico
        `;
        const result = await conn.execute(sqlQuery, { cdMedico }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        console.log("CPF:", result.rows[0].NR_CPF);
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
testGen();
