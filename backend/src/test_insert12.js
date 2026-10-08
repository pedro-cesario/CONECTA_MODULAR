const db = require('./core/database/index.js');
async function run() {
  const conn = await db.getConnection();
  try {
     const resAten = await conn.execute("SELECT MAX(NR_ATENDIMENTO) AS NR_ATENDIMENTO FROM ATENDIMENTO_PACIENTE WHERE CD_PESSOA_FISICA = '259406'");
     const nrAtendimento = resAten.rows[0]?.NR_ATENDIMENTO;
     console.log("Max nrAtendimento for 259406 is", nrAtendimento);

     const testObj = {
        nrAtendimento: nrAtendimento,
        pf: "259406",
        dsEvolucao: "teste",
        usuario: "teste",
        ieEvo: "M"
     };
     try {
       await conn.execute(`
             INSERT INTO EVOLUCAO_PACIENTE (
                CD_EVOLUCAO, NR_ATENDIMENTO, CD_PESSOA_FISICA, CD_MEDICO, DT_EVOLUCAO, DT_LIBERACAO, 
                DS_EVOLUCAO, NM_USUARIO, IE_TIPO_EVOLUCAO, IE_EVOLUCAO_CLINICA, DT_ATUALIZACAO, IE_SITUACAO
             ) VALUES (
                EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, :pf, NULL, SYSDATE, SYSDATE, 
                :dsEvolucao, :usuario, '1', :ieEvo, SYSDATE, 'A'
             )
       `, testObj, { autoCommit: false });
       console.log("Insert success full fields with valid atendimento!");
     } catch (e) {
       console.log("Error inserting:", e.message);
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
