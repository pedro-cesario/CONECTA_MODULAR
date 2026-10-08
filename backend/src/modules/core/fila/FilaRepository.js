const db = require('../../../core/database/index.js');
const oracledb = require('oracledb');

async function chamarProximaSenha(nrSeqFila, dsMaquina, nmUsuario) {
  const conn = await db.getConnection();
  try {
    const minIdRes = await conn.execute(`SELECT NVL(MIN(nr_sequencia), 0) AS m FROM paciente_senha_fila WHERE dt_entrada_fila >= TRUNC(SYSDATE - 1)`);
    const minId = minIdRes.rows[0].M;

    const proxima = await conn.execute(
      `SELECT nr_sequencia, nr_prioridade
       FROM paciente_senha_fila
       WHERE dt_inutilizacao IS NULL
         AND dt_inicio_atendimento IS NULL
         AND nvl(nr_seq_fila_senha, nr_seq_fila_senha_origem) = :fila
         AND nr_sequencia >= :minId
         AND (dt_chamada IS NULL OR (ie_rechamada = 'S' AND (SYSDATE - dt_chamada) > 1/1440))
       ORDER BY dt_chamada NULLS FIRST, nr_prioridade ASC, dt_geracao_senha ASC, nr_sequencia ASC
       FETCH FIRST 1 ROWS ONLY`,
      { fila: nrSeqFila, minId }
    );

    if (proxima.rows.length === 0) {
      return null;
    }

    const seqNum = proxima.rows[0].NR_SEQUENCIA;

    // Lock FOR UPDATE SKIP LOCKED
    const checkRes = await conn.execute(
      `SELECT nr_sequencia, cd_senha_gerada, cd_pessoa_fisica, nr_prioridade
       FROM paciente_senha_fila
       WHERE nr_sequencia = :seq
       FOR UPDATE SKIP LOCKED`,
      { seq: seqNum }
    );

    if (checkRes.rows.length === 0) {
      return null; // Alguém pegou antes
    }

    const maquinaFinal = String(dsMaquina).substring(0, 100);
    const usuarioFinal = String(nmUsuario).substring(0, 30);

    await conn.execute(
      `UPDATE paciente_senha_fila
       SET dt_chamada = SYSDATE,
           dt_nova_chamada = SYSDATE,
           ds_maquina_chamada = :maquina,
           ds_maquina_chamada_pesquisa = UPPER(:maquina),
           nm_usuario_chamada = :usuario,
           qt_chamadas = NVL(qt_chamadas, 0) + 1,
           ie_forma_chamada = 'N',
           ie_rechamada = 'S',
           dt_atualizacao = SYSDATE,
           nm_usuario = :usuario
       WHERE nr_sequencia = :seq`,
      { seq: seqNum, maquina: maquinaFinal, usuario: usuarioFinal }
    );

    await conn.execute(
      `INSERT INTO paciente_senha_fila_hist (
         nr_sequencia, nr_seq_senha, dt_atualizacao, nm_usuario,
         dt_atualizacao_nrec, nm_usuario_nrec, ds_maquina_chamada, ie_forma_chamada
       ) VALUES (
         PACIENTE_SENHA_FILA_HIST_SEQ.NEXTVAL, :seq, SYSDATE, :usuario,
         SYSDATE, :usuario, :maquina, 'N'
       )`,
      { seq: seqNum, usuario: usuarioFinal, maquina: maquinaFinal }
    );

    // Call TASY procedure
    try {
      await conn.execute(
        `BEGIN BIFROST_INTEGRACAO_SENHAS(NR_SEQ_SENHA_P => :seq); END;`,
        { seq: seqNum }
      );
    } catch(e) {}

    await conn.commit();
    return seqNum;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

async function inutilizarSenha(nrSeqSenha, cdSenhaGerada, cdFila, nmUsuario, nrSeqMotivo) {
  const conn = await db.getConnection();
  try {
    await conn.execute(
      `BEGIN
         INUTILIZAR_SENHA(
           cd_senha_p => :cdSenha,
           cd_fila_p => :cdFila,
           nr_seq_senha_p => :nrSeqSenha,
           nm_usuario_p => :nmUsuario,
           nr_seq_motivo_inutilizacao_p => :nrSeqMotivo
         );
       END;`,
      {
        cdSenha: cdSenhaGerada || null,
        cdFila: cdFila || null,
        nrSeqSenha: nrSeqSenha,
        nmUsuario: nmUsuario,
        nrSeqMotivo: nrSeqMotivo || null
      }
    );
    // COMMIT interno realizado pela procedure oficial INUTILIZAR_SENHA.
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

async function transferirPacienteFila(nrSeqFilaNova, nrSeqFilaAtual, nrSeqSenha, cdSenhaGerada) {
  const conn = await db.getConnection();
  try {
    await conn.execute(
      `DECLARE
         v_erro VARCHAR2(2000);
       BEGIN
         TRANSFERIR_PAC_FILA(
           nr_seq_fila_nova_p => :nrSeqFilaNova,
           nr_seq_fila_atual_p => :nrSeqFilaAtual,
           cd_senha_p => :cdSenha,
           nr_seq_senha_p => :nrSeqSenha,
           ds_erro_p => v_erro
         );
         IF v_erro IS NOT NULL THEN
            RAISE_APPLICATION_ERROR(-20001, v_erro);
         END IF;
       END;`,
      {
        nrSeqFilaNova,
        nrSeqFilaAtual: nrSeqFilaAtual || 0,
        cdSenha: cdSenhaGerada || 0,
        nrSeqSenha: nrSeqSenha || 0
      }
    );
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = {
  chamarProximaSenha,
  inutilizarSenha,
  transferirPacienteFila
};
