const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const testObj = {
        nrAtendimento: 773923,
        pf: "undefined",
        dsEvolucao: "teste",
        usuario: "teste",
        ieEvo: "M"
     };
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
       console.log("Insert success with string undefined!");
     } catch (e) {
       console.log("Error string undefined:", e.message);
     }
     await conn.execute("ROLLBACK");
     
     // What if pf is "null"?
     testObj.pf = "null";
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
       console.log("Insert success with string null!");
     } catch (e) {
       console.log("Error string null:", e.message);
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
