const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testGravarAss() {
    let conn;
    try {
        conn = await db.getConnection();
        const sql = `
            DECLARE
                v_seq NUMBER;
                v_nova VARCHAR2(1);
            BEGIN
                TASY_GRAVAR_ASSINATURA_DIGITAL(
                    DS_ASSINATURA_P => 'dummy_signature_data',
                    CD_PESSOA_FISICA_P => '364362',
                    DS_HASH_ASSINATURA_P => 'e505bb7d8eae4b982bf1bab6fdfbdb51',
                    NR_SEQ_PROJ_ASS_P => 183,
                    NR_SEQ_PROJ_XML_P => 100049,
                    NM_USUARIO_P => 'Thamyris.costa',
                    CD_CLASSIF_RELAT_P => 'WATE',
                    CD_RELATORIO_P => 783,
                    NR_SEQUENCIA_P => v_seq,
                    IE_NOVA_ASSINAT_P => v_nova
                );
                :outSeq := v_seq;
                :outNova := v_nova;
            END;
        `;
        
        const result = await conn.execute(sql, {
            outSeq: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outNova: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
        });
        
        console.log("Seq:", result.outBinds.outSeq);
        console.log("Nova:", result.outBinds.outNova);
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
testGravarAss();
