const db = require('../../core/database');

class TriagemPaClinicoRepository {
  async carregarAlergiasPaciente(cdPessoaFisica) {
    const conn = await db.getConnection();
    try {
      const res = await conn.execute(
        `SELECT pa.nr_sequencia,
                pa.nr_seq_ficha_tecnica,
                COALESCE(
                  mf.ds_substancia,
                  (SELECT MIN(m.ds_material)
                     FROM material m
                    WHERE m.nr_seq_ficha_tecnica = pa.nr_seq_ficha_tecnica),
                  pa.ds_medic_nao_cad,
                  pa.ds_observacao
                ) AS descricao
           FROM paciente_alergia pa
           LEFT JOIN medic_ficha_tecnica mf
             ON mf.nr_sequencia = pa.nr_seq_ficha_tecnica
          WHERE pa.cd_pessoa_fisica = :cpf
            AND pa.dt_inativacao IS NULL
            AND NVL(pa.ie_nega_alergias, 'N') <> 'S'
          ORDER BY pa.nr_sequencia DESC`,
        { cpf: cdPessoaFisica }
      );
      return res.rows.map(row => ({
        nrSequencia: row.NR_SEQUENCIA,
        nrSeqFichaTecnica: row.NR_SEQ_FICHA_TECNICA,
        descricao: row.DESCRICAO
      }));
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      if (conn) await conn.close();
    }
  }

  async buscarPrincipiosAtivos(termo) {
    const conn = await db.getConnection();
    try {
      const res = await conn.execute(
        `SELECT nr_seq_ficha_tecnica, descricao
           FROM (
             SELECT DISTINCT
                    m.nr_seq_ficha_tecnica,
                    COALESCE(mf.ds_substancia, m.ds_material) AS descricao
               FROM material m
               LEFT JOIN medic_ficha_tecnica mf
                 ON mf.nr_sequencia = m.nr_seq_ficha_tecnica
              WHERE m.ie_situacao = 'A'
                AND m.nr_seq_ficha_tecnica IS NOT NULL
                AND (UPPER(m.ds_material) LIKE UPPER(:termo)
                  OR UPPER(mf.ds_substancia) LIKE UPPER(:termo))
              ORDER BY descricao
           )
          WHERE ROWNUM <= 20`,
        { termo: `%${String(termo || '').trim()}%` }
      );
      return res.rows.map(row => ({
        nrSeqFichaTecnica: row.NR_SEQ_FICHA_TECNICA,
        descricao: row.DESCRICAO
      }));
    } finally {
      if (conn) await conn.close();
    }
  }

  async gravarSinaisVitais(nrAtendimento, cdPessoaFisica, nmUsuario, sinais) {
    const conn = await db.getConnection();
    try {
      const q = `INSERT INTO ATENDIMENTO_SINAL_VITAL (
        nr_sequencia, nr_atendimento, cd_pessoa_fisica, 
        dt_sinal_vital, dt_atualizacao, dt_atualizacao_nrec, 
        nm_usuario, nm_usuario_nrec,
        vl_pressao_arterial, vl_pressao_art_dias, vl_frequencia_cardiaca, 
        vl_frequencia_respirat, vl_temperatura, vl_saturacao_o2, vl_peso
      ) VALUES (
        ATENDIMENTO_SINAL_VITAL_SEQ.NEXTVAL, :nrAtendimento, :cdPessoaFisica,
        SYSDATE, SYSDATE, SYSDATE,
        :nmUsuario, :nmUsuario,
        :pas, :pad, :fc, :fr, :temp, :sato2, :peso
      )`;
      const binds = {
        nrAtendimento,
        cdPessoaFisica,
        nmUsuario,
        pas: sinais.pas || null,
        pad: sinais.pad || null,
        fc: sinais.fc || null,
        fr: sinais.fr || null,
        temp: sinais.temperatura ?? sinais.temp ?? null,
        sato2: sinais.spo2 ?? sinais.sato2 ?? null,
        peso: sinais.peso || null
      };
      await conn.execute(q, binds);
      await conn.commit();
      return true;
    } catch(err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }

  async gravarAlergias(cdPessoaFisica, nrAtendimento, alergias, nmUsuario) {
    const conn = await db.getConnection();
    try {
      const q = `INSERT INTO paciente_alergia (
        nr_sequencia, cd_pessoa_fisica, nr_atendimento,
        dt_registro, dt_liberacao, dt_atualizacao,
        nm_usuario, nm_usuario_liberacao,
        ie_nega_alergias, ds_observacao, nr_seq_ficha_tecnica,
        ie_confirmacao, ie_origem
      ) VALUES (
        paciente_alergia_seq.NEXTVAL, :cdPessoaFisica, :nrAtendimento,
        SYSDATE, SYSDATE, SYSDATE,
        :nmUsuario, :nmUsuario,
        'N', :descricao, :nrSeqFichaTecnica,
        'C', 'TRIAGEM'
      )`;
      for (const alergia of alergias) {
        if (!alergia?.nrSeqFichaTecnica) continue;
        await conn.execute(q, {
          cdPessoaFisica,
          nrAtendimento,
          nmUsuario,
          nrSeqFichaTecnica: Number(alergia.nrSeqFichaTecnica),
          descricao: alergia.descricao || null
        });
      }
      await conn.commit();
      return true;
    } catch(err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }

  async gravarNegaAlergias(cdPessoaFisica, nrAtendimento, nmUsuario) {
    const conn = await db.getConnection();
    try {
      await conn.execute(
        `INSERT INTO paciente_alergia (
          nr_sequencia, cd_pessoa_fisica, nr_atendimento,
          dt_registro, dt_liberacao, dt_atualizacao,
          nm_usuario, nm_usuario_liberacao,
          ie_nega_alergias, ie_confirmacao, ie_origem
        ) VALUES (
          paciente_alergia_seq.NEXTVAL, :cdPessoaFisica, :nrAtendimento,
          SYSDATE, SYSDATE, SYSDATE,
          :nmUsuario, :nmUsuario,
          'S', 'C', 'TRIAGEM'
        )`,
        { cdPessoaFisica, nrAtendimento, nmUsuario }
      );
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }

  async gravarGlasgow(nrAtendimento, glasgow, nmUsuario) {
    const conn = await db.getConnection();
    try {
      const q = `INSERT INTO ATEND_ESCALA_INDICE (
        nr_sequencia, nr_atendimento, cd_escala,
        qt_indice_1, qt_indice_2, qt_indice_3, qt_indice_total,
        dt_atualizacao, nm_usuario
      ) VALUES (
        ATEND_ESCALA_INDICE_SEQ.NEXTVAL, :nrAtendimento, 1,
        :ocular, :verbal, :motora, :total,
        SYSDATE, :nmUsuario
      )`;
      const binds = {
        nrAtendimento,
        ocular: glasgow.ocular || null,
        verbal: glasgow.verbal || null,
        motora: glasgow.motora || null,
        total: glasgow.total || null,
        nmUsuario
      };
      await conn.execute(q, binds);
      await conn.commit();
      return true;
    } catch(err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }

  async atualizarClassificacao(nrAtendimento, nrSeqTriagem, nmUsuario) {
    const conn = await db.getConnection();
    try {
      await conn.execute(
        `UPDATE ATENDIMENTO_PACIENTE 
         SET NR_SEQ_TRIAGEM = :nrSeqTriagem,
             dt_atualizacao = SYSDATE,
             nm_usuario = :nmUsuario
         WHERE nr_atendimento = :nrAtendimento`,
        { nrSeqTriagem, nmUsuario, nrAtendimento }
      );
      await conn.commit();
      return true;
    } catch(err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }

  async gravarEvolucao(nrAtendimento, cdPessoaFisica, textoEvolucao, nmUsuario) {
    const conn = await db.getConnection();
    try {
      const q = `INSERT INTO EVOLUCAO_PACIENTE (
        cd_evolucao, nr_atendimento, cd_pessoa_fisica, ds_evolucao,
        ie_tipo_evolucao, dt_evolucao, dt_atualizacao, nm_usuario, ie_status_evolucao
      ) VALUES (
        EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, :cdPessoaFisica, :texto,
        1, SYSDATE, SYSDATE, :nmUsuario, 'L'
      ) RETURNING cd_evolucao INTO :outId`;
      
      const oracledb = require('oracledb');
      const binds = {
        nrAtendimento,
        cdPessoaFisica,
        texto: textoEvolucao,
        nmUsuario,
        outId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      };
      const res = await conn.execute(q, binds);
      const cdEvolucao = res.outBinds.outId[0];
      await conn.commit();
      return cdEvolucao;
    } catch(err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }

  async atualizarFimTriagem(nrAtendimento, nmUsuario) {
    const conn = await db.getConnection();
    try {
      await conn.execute(
        `UPDATE ATENDIMENTO_PACIENTE 
         SET DT_FIM_TRIAGEM = SYSDATE,
             dt_atualizacao = SYSDATE,
             nm_usuario = :nmUsuario
         WHERE nr_atendimento = :nrAtendimento`,
        { nmUsuario, nrAtendimento }
      );
      await conn.commit();
      return true;
    } catch(err) {
      await conn.rollback();
      throw err;
    } finally {
      if (conn) await conn.close();
    }
  }
  async assinarEvolucao(cdEvolucao, cdPessoaFisica, textoEvolucao, nmUsuario) {
    const crypto = require('crypto');
    const md5Hash = crypto.createHash('md5').update(textoEvolucao).digest('hex').toUpperCase();

    const conn = await db.getConnection();
    try {
      const q = `
        DECLARE
          v_seq NUMBER;
          v_nova VARCHAR2(1);
        BEGIN
          TASY_GRAVAR_ASSINATURA_DIGITAL(
            DS_ASSINATURA_P => 'CONECTA_TRIAGEM',
            CD_PESSOA_FISICA_P => :cdPessoaFisica,
            DS_HASH_ASSINATURA_P => :md5Hash,
            NR_SEQ_PROJ_ASS_P => 183,
            NR_SEQ_PROJ_XML_P => 100049,
            NM_USUARIO_P => :nmUsuario,
            CD_CLASSIF_RELAT_P => 'WATE',
            CD_RELATORIO_P => 783,
            NR_SEQUENCIA_P => v_seq,
            IE_NOVA_ASSINATURA_P => v_nova
          );
        END;
      `;
      await conn.execute(q, {
        cdPessoaFisica,
        md5Hash,
        nmUsuario
      });
      await conn.commit();
      return true;
    } catch(err) {
      await conn.rollback();
      console.error("Erro na assinatura:", err);
      // We don't throw to prevent blocking if signature is not strictly required by the environment
      return false;
    } finally {
      if (conn) await conn.close();
    }
  }

}

module.exports = new TriagemPaClinicoRepository();
