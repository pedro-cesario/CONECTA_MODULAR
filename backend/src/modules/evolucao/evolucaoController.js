const { getConnection } = require('../../core/database');

async function validarAssinatura(req, res) {
  let conn;
  try {
    const { nrAtendimento } = req.params;
    if (!nrAtendimento) {
      return res.status(400).json({ success: false, message: 'nrAtendimento é obrigatório' });
    }

    conn = await getConnection();

    const sqlEvolucao = `
      SELECT e.cd_evolucao, e.nr_seq_assinatura, TO_CHAR(e.dt_liberacao, 'DD/MM/YYYY HH24:MI:SS') as data_liberacao, e.cd_medico, pf.nm_pessoa_fisica as nm_medico 
      FROM evolucao_paciente e
      LEFT JOIN pessoa_fisica pf ON pf.cd_pessoa_fisica = e.cd_medico
      WHERE e.nr_atendimento = :nrAtendimento AND e.ie_situacao = 'A' AND e.ie_evolucao_clinica = 'EC'
      ORDER BY e.cd_evolucao DESC
    `;
    const resultEvolucao = await conn.execute(sqlEvolucao, { nrAtendimento });

    if (!resultEvolucao.rows || resultEvolucao.rows.length === 0) {
      return res.json({ success: false, assinado: false, message: 'Nenhuma evolução clínica (EC) ativa encontrada para este atendimento' });
    }

    // Pega a mais recente
    const evolucao = resultEvolucao.rows[0];
    // A API do oracledb geralmente retorna as chaves em upper-case quando usamos oracledb.OUT_FORMAT_OBJECT (que parece ser o default) ou array dependendo.
    // Let's safe-extract them. Assuming the wrapper returns rows as objects with lowercase or uppercase properties:
    const getRowVal = (row, key) => row[key] !== undefined ? row[key] : row[key.toUpperCase()];

    const CD_EVOLUCAO = getRowVal(evolucao, 'cd_evolucao');
    const NR_SEQ_ASSINATURA = getRowVal(evolucao, 'nr_seq_assinatura');
    const DATA_LIBERACAO = getRowVal(evolucao, 'data_liberacao');
    const NM_MEDICO = getRowVal(evolucao, 'nm_medico');

    // 2. Executar verifica_se_assinado
    const sqlVerifica = `SELECT verifica_se_assinado('EVOLUCAO_PACIENTE', 183, :cd_evolucao, 'L') AS is_assinado FROM dual`;
    const resultVerifica = await conn.execute(sqlVerifica, { cd_evolucao: CD_EVOLUCAO });
    const isAssinado = getRowVal(resultVerifica.rows[0], 'is_assinado') === 'S';

    if (!isAssinado) {
      return res.json({ 
        success: true, 
        assinado: false, 
        cd_evolucao: CD_EVOLUCAO,
        message: 'Evolução pendente de assinatura digital no Tasy'
      });
    }

    // 3. Executar obter_inf_assinatura_digital
    const sqlInfo = `SELECT obter_inf_assinatura_digital(:nr_seq_assinatura, 0) AS inf_assinatura FROM dual`;
    let detalhesAssinatura = null;
    if (NR_SEQ_ASSINATURA) {
        const resultInfo = await conn.execute(sqlInfo, { nr_seq_assinatura: NR_SEQ_ASSINATURA });
        detalhesAssinatura = resultInfo.rows.length > 0 ? getRowVal(resultInfo.rows[0], 'inf_assinatura') : null;
    }

    // Checar os eventos na TASY_ASSINAT_DIG_LOG
    let eventosAuditoria = [];
    if (NR_SEQ_ASSINATURA) {
        const sqlEventos = `
        SELECT ie_evento
        FROM tasy_assinat_dig_log 
        WHERE nr_seq_assinatura = :nr_seq_assinatura 
        ORDER BY nr_sequencia ASC
        `;
        const resultEventos = await conn.execute(sqlEventos, { nr_seq_assinatura: NR_SEQ_ASSINATURA });
        eventosAuditoria = resultEventos.rows.map(row => getRowVal(row, 'ie_evento'));
    }

    // 4. Retornar JSON
    return res.json({
      success: true,
      assinado: true,
      cd_evolucao: CD_EVOLUCAO,
      nr_seq_assinatura: NR_SEQ_ASSINATURA,
      medico: NM_MEDICO,
      data_liberacao: DATA_LIBERACAO,
      detalhes_assinatura: detalhesAssinatura,
      eventos_auditoria: eventosAuditoria
    });

  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return res.status(500).json({ success: false, message: 'Erro ao validar assinatura', error: error.message });
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

async function criarEvolucaoTeste(req, res) {
  let conn;
  try {
    const { nrAtendimento, texto } = req.body;
    if (!nrAtendimento) {
      return res.status(400).json({ success: false, message: 'nrAtendimento é obrigatório' });
    }

    const usuario = req.session?.usuario;
    const cdMedico = usuario?.cd_pessoa_fisica || '1'; // Fallback for tests if not linked properly

    conn = await getConnection();

    const sqlInsert = `
      INSERT INTO evolucao_paciente (
        cd_evolucao, nr_atendimento, cd_medico, dt_evolucao, dt_liberacao, ds_evolucao, ie_evolucao_clinica, ie_situacao
      ) VALUES (
        EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, :cdMedico, SYSDATE, SYSDATE, :texto, 'EC', 'A'
      )
    `;

    await conn.execute(sqlInsert, { 
      nrAtendimento, 
      cdMedico,
      texto: texto || 'Evolução Clínica de Teste - Conecta'
    }, { autoCommit: true });

    return res.json({ success: true, message: 'Evolução criada com sucesso!' });

  } catch (error) {
    console.error('Erro ao criar evolução:', error);
    return res.status(500).json({ success: false, message: 'Erro ao criar evolução', error: error.message });
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

module.exports = {
  validarAssinatura,
  criarEvolucaoTeste
};
