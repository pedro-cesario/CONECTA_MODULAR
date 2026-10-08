const db = require('./core/database/index.js');
async function run() {
  
  const conn = await db.getConnection();
  try {
     // Check if we can describe EVOLUCAO_PACIENTE
     const result = await conn.execute("SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'EVOLUCAO_PACIENTE' AND COLUMN_NAME IN ('CD_PESSOA_FISICA', 'NR_ATENDIMENTO')");
     console.log(result.rows);
     
     // What happens if we pass "undefined" as string?
     // What happens if pf is literally undefined in JS object?
     const testObj = {
        nrAtendimento: 773923,
        pf: undefined,
        dsEvolucao: "teste",
        usuario: "teste",
        ieEvo: "M"
     };
     // Let's not actually insert, just see what node-oracledb complains about
     // wait, if we don't insert, we won't see ORA-01400.
     // But we CAN'T insert because we don't want to mess up prod data, wait, we can just ROLLBACK.
     try {
       await conn.execute(`
             INSERT INTO EVOLUCAO_PACIENTE (
                CD_EVOLUCAO, NR_ATENDIMENTO, CD_PESSOA_FISICA, CD_MEDICO, DT_EVOLUCAO, DT_LIBERACAO, 
                DS_EVOLUCAO, NM_USUARIO, IE_TIPO_EVOLUCAO, IE_EVOLUCAO_CLINICA
             ) VALUES (
                EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, :pf, NULL, SYSDATE, SYSDATE, 
                :dsEvolucao, :usuario, '1', :ieEvo
             )
       `, testObj, { autoCommit: false });
       console.log("Insert success!");
     } catch (e) {
       console.log("Error 1:", e.message);
     }
     await conn.execute("ROLLBACK");
  } catch(e) {
    console.error(e);
  } finally {
    if (conn) await conn.close();
    process.exit(0);
  }
}
run();
