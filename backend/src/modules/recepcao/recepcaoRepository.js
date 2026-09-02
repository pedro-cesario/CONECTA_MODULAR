const { getConnection } = require('../../core/database');

/**
 * Módulo de Recepção & Acolhimento — Repositório Oracle TASY
 * Gerencia os 5 Pilares: Senhas -> Pessoas -> Endereço -> Atendimento -> Relatórios/GED
 */

// ============================================================================
// PILAR 1: GERENCIAMENTO DE SENHAS & GUICHÊ
// ============================================================================

async function listarFilasSenhas() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT nr_sequencia, ds_fila, ie_situacao
       FROM fila_espera_senha
       WHERE ie_situacao = 'A'
       ORDER BY ds_fila`
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function listarSenhasEspera(nrSeqFila) {
  const conn = await getConnection();
  try {
    const binds = {};
    let whereClause = `psf.dt_inutilizacao IS NULL AND psf.dt_fim_atendimento IS NULL`;
    
    if (nrSeqFila) {
      whereClause += ` AND psf.nr_seq_fila_senha = :fila`;
      binds.fila = parseInt(nrSeqFila, 10);
    }

    const result = await conn.execute(
      `SELECT
         psf.nr_sequencia,
         psf.cd_senha_gerada,
         psf.nr_seq_fila_senha,
         fs.ds_fila,
         psf.dt_geracao_senha,
         TO_CHAR(psf.dt_geracao_senha, 'HH24:MI:SS') AS hr_geracao,
         psf.nr_prioridade,
         CASE 
           WHEN psf.nr_prioridade = 1 THEN 'Emergência'
           WHEN psf.nr_prioridade = 2 THEN 'Prioritária'
           ELSE 'Normal'
         END AS ds_prioridade,
         psf.dt_chamada,
         TO_CHAR(psf.dt_chamada, 'HH24:MI:SS') AS hr_chamada,
         psf.ds_maquina_chamada,
         psf.qt_chamadas,
         psf.cd_pessoa_fisica,
         pf.nm_pessoa_fisica,
         pf.nm_social,
         ROUND((SYSDATE - psf.dt_geracao_senha) * 1440) AS minutos_espera
       FROM paciente_senha_fila psf
       LEFT JOIN fila_espera_senha fs ON fs.nr_sequencia = psf.nr_seq_fila_senha
       LEFT JOIN pessoa_fisica pf ON pf.cd_pessoa_fisica = psf.cd_pessoa_fisica
       WHERE ${whereClause}
       ORDER BY 
         CASE WHEN psf.dt_chamada IS NULL THEN 0 ELSE 1 END ASC,
         NVL(psf.nr_prioridade, 3) ASC,
         psf.dt_geracao_senha DESC`,
      binds
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function chamarProximaSenha(nrSeqFila, dsMaquina, nmUsuario) {
  const conn = await getConnection();
  try {
    const proxima = await conn.execute(
      `SELECT nr_sequencia, cd_senha_gerada
       FROM (
         SELECT nr_sequencia, cd_senha_gerada
         FROM paciente_senha_fila
         WHERE nr_seq_fila_senha = :fila
           AND dt_inutilizacao IS NULL
           AND dt_fim_atendimento IS NULL
           AND dt_chamada IS NULL
         ORDER BY NVL(nr_prioridade, 3) ASC, dt_geracao_senha DESC
       ) WHERE ROWNUM = 1`,
      { fila: parseInt(nrSeqFila, 10) }
    );

    if (proxima.rows.length === 0) {
      return null;
    }

    const nrSeqSenha = proxima.rows[0].NR_SEQUENCIA;
    const cdSenha = proxima.rows[0].CD_SENHA_GERADA;

    await conn.execute(
      `UPDATE paciente_senha_fila
       SET dt_chamada = SYSDATE,
           dt_primeira_chamada = NVL(dt_primeira_chamada, SYSDATE),
           ds_maquina_chamada = :maquina,
           nm_usuario_chamada = :usuario,
           qt_chamadas = NVL(qt_chamadas, 0) + 1,
           dt_inicio_atendimento = NVL(dt_inicio_atendimento, SYSDATE),
           dt_atualizacao = SYSDATE,
           nm_usuario = :usuario
       WHERE nr_sequencia = :seq`,
      { seq: nrSeqSenha, maquina: dsMaquina || 'GUICHE-WEB', usuario: nmUsuario }
    );

    await conn.execute(
      `INSERT INTO paciente_senha_fila_hist (
         nr_sequencia, dt_atualizacao, nm_usuario, dt_atualizacao_nrec, nm_usuario_nrec,
         nr_seq_senha, dt_historico, ds_maquina_chamada, ie_tipo_historico
       ) VALUES (
         PACIENTE_SENHA_FILA_HIST_SEQ.NEXTVAL, SYSDATE, :usuario, SYSDATE, :usuario,
         :seq, SYSDATE, :maquina, 'C'
       )`,
      { seq: nrSeqSenha, maquina: dsMaquina || 'GUICHE-WEB', usuario: nmUsuario }
    );

    await conn.commit();
    return { nr_sequencia: nrSeqSenha, cd_senha_gerada: cdSenha };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

async function rechamarSenha(nrSeqSenha, dsMaquina, nmUsuario) {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE paciente_senha_fila
       SET dt_chamada = SYSDATE,
           ds_maquina_chamada = :maquina,
           nm_usuario_chamada = :usuario,
           qt_chamadas = NVL(qt_chamadas, 0) + 1,
           dt_atualizacao = SYSDATE,
           nm_usuario = :usuario
       WHERE nr_sequencia = :seq`,
      { seq: parseInt(nrSeqSenha, 10), maquina: dsMaquina || 'GUICHE-WEB', usuario: nmUsuario }
    );

    await conn.execute(
      `INSERT INTO paciente_senha_fila_hist (
         nr_sequencia, dt_atualizacao, nm_usuario, dt_atualizacao_nrec, nm_usuario_nrec,
         nr_seq_senha, dt_historico, ds_maquina_chamada, ie_tipo_historico
       ) VALUES (
         PACIENTE_SENHA_FILA_HIST_SEQ.NEXTVAL, SYSDATE, :usuario, SYSDATE, :usuario,
         :seq, SYSDATE, :maquina, 'R'
       )`,
      { seq: parseInt(nrSeqSenha, 10), maquina: dsMaquina || 'GUICHE-WEB', usuario: nmUsuario }
    );

    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// ============================================================================
// PILAR 2: CADASTRO E BUSCA DE PESSOA FÍSICA
// ============================================================================

async function buscarPessoas(termo) {
  const conn = await getConnection();
  try {
    const limpo = String(termo || '').trim();
    const apenasDigitos = limpo.replace(/\D/g, '');
    const binds = {};
    let whereClause = '';

    if (apenasDigitos.length === 11) {
      whereClause = `pf.nr_cpf = :cpf OR REPLACE(REPLACE(pf.nr_cpf, '.', ''), '-', '') = :cpf`;
      binds.cpf = apenasDigitos;
    } else if (apenasDigitos.length >= 15) {
      whereClause = `pf.nr_cartao_nac_sus = :cns`;
      binds.cns = apenasDigitos;
    } else {
      whereClause = `UPPER(pf.nm_pessoa_fisica) LIKE :nome OR UPPER(pf.nm_social) LIKE :nome`;
      binds.nome = `%${limpo.toUpperCase()}%`;
    }

    const result = await conn.execute(
      `SELECT
         pf.cd_pessoa_fisica,
         pf.nm_pessoa_fisica,
         pf.nm_social,
         pf.dt_nascimento,
         TO_CHAR(pf.dt_nascimento, 'DD/MM/YYYY') AS dt_nasc_fmt,
         pf.ie_sexo,
         pf.nr_cpf,
         pf.nr_identidade,
         pf.nm_sobrenome_mae AS nm_mae,
         pf.nm_sobrenome_pai AS nm_pai,
         pf.nr_cartao_nac_sus AS nr_cns,
         pf.nr_telefone_celular,
         c.ds_endereco,
         c.nr_endereco,
         c.ds_bairro,
         c.ds_municipio,
         c.sg_estado,
         c.cd_cep
       FROM pessoa_fisica pf
       LEFT JOIN compl_pessoa_fisica c ON c.cd_pessoa_fisica = pf.cd_pessoa_fisica AND c.ie_tipo_complemento = 1
       WHERE ${whereClause}
       ORDER BY pf.nm_pessoa_fisica
       FETCH FIRST 20 ROWS ONLY`,
      binds
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function obterPessoaCompleta(cdPessoaFisica) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         pf.cd_pessoa_fisica,
         pf.nm_pessoa_fisica,
         pf.nm_social,
         pf.dt_nascimento,
         TO_CHAR(pf.dt_nascimento, 'YYYY-MM-DD') AS dt_nasc_iso,
         TO_CHAR(pf.dt_nascimento, 'DD/MM/YYYY') AS dt_nasc_fmt,
         pf.ie_sexo,
         pf.nr_cpf,
         pf.nr_identidade,
         pf.ds_orgao_emissor_ci AS ds_orgao_emissor,
         pf.nm_sobrenome_mae AS nm_mae,
         pf.nm_sobrenome_pai AS nm_pai,
         pf.nr_cartao_nac_sus AS nr_cns,
         pf.nr_telefone_celular,
         c.ds_email,
         c.ds_endereco,
         c.nr_endereco,
         c.ds_complemento,
         c.ds_bairro,
         c.ds_municipio,
         c.sg_estado,
         c.cd_cep,
         c.cd_municipio_ibge,
         c.nr_telefone AS tel_fixo
       FROM pessoa_fisica pf
       LEFT JOIN compl_pessoa_fisica c ON c.cd_pessoa_fisica = pf.cd_pessoa_fisica AND c.ie_tipo_complemento = 1
       WHERE pf.cd_pessoa_fisica = :cd`,
      { cd: String(cdPessoaFisica) }
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  } finally {
    await conn.close();
  }
}

async function salvarPessoaFisica(dados, nmUsuario) {
  const conn = await getConnection();
  try {
    let cdPessoaFisica = dados.cd_pessoa_fisica;
    const isNew = !cdPessoaFisica;

    if (isNew) {
      const seqRes = await conn.execute(`SELECT PESSOA_FISICA_SEQ.NEXTVAL AS id FROM dual`);
      cdPessoaFisica = String(seqRes.rows[0].ID);

      await conn.execute(
        `INSERT INTO pessoa_fisica (
           cd_pessoa_fisica, nm_pessoa_fisica, nm_social, dt_nascimento, ie_sexo,
           nr_cpf, nr_identidade, ds_orgao_emissor_ci, nm_sobrenome_mae, nm_sobrenome_pai, nr_cartao_nac_sus,
           nr_telefone_celular, dt_atualizacao, nm_usuario, dt_atualizacao_nrec, nm_usuario_nrec
         ) VALUES (
           :cd, :nome, :social, TO_DATE(:nasc, 'YYYY-MM-DD'), :sexo,
           :cpf, :rg, :emissor, :mae, :pai, :cns,
           :cel, SYSDATE, :usuario, SYSDATE, :usuario
         )`,
        {
          cd: cdPessoaFisica,
          nome: dados.nm_pessoa_fisica,
          social: dados.nm_social || null,
          nasc: dados.dt_nascimento,
          sexo: dados.ie_sexo || 'M',
          cpf: dados.nr_cpf ? dados.nr_cpf.replace(/\D/g, '') : null,
          rg: dados.nr_identidade || null,
          emissor: dados.ds_orgao_emissor || null,
          mae: dados.nm_mae || null,
          pai: dados.nm_pai || null,
          cns: dados.nr_cns || null,
          cel: dados.nr_telefone_celular || null,
          usuario: nmUsuario
        }
      );
    } else {
      await conn.execute(
        `UPDATE pessoa_fisica
         SET nm_pessoa_fisica = :nome,
             nm_social = :social,
             dt_nascimento = TO_DATE(:nasc, 'YYYY-MM-DD'),
             ie_sexo = :sexo,
             nr_cpf = :cpf,
             nr_identidade = :rg,
             ds_orgao_emissor_ci = :emissor,
             nm_sobrenome_mae = :mae,
             nm_sobrenome_pai = :pai,
             nr_cartao_nac_sus = :cns,
             nr_telefone_celular = :cel,
             dt_atualizacao = SYSDATE,
             nm_usuario = :usuario
         WHERE cd_pessoa_fisica = :cd`,
        {
          cd: cdPessoaFisica,
          nome: dados.nm_pessoa_fisica,
          social: dados.nm_social || null,
          nasc: dados.dt_nascimento,
          sexo: dados.ie_sexo || 'M',
          cpf: dados.nr_cpf ? dados.nr_cpf.replace(/\D/g, '') : null,
          rg: dados.nr_identidade || null,
          emissor: dados.ds_orgao_emissor || null,
          mae: dados.nm_mae || null,
          pai: dados.nm_pai || null,
          cns: dados.nr_cns || null,
          cel: dados.nr_telefone_celular || null,
          usuario: nmUsuario
        }
      );
    }

    // Histórico de Pessoa Física
    await conn.execute(
      `INSERT INTO pessoa_fisica_historico (
         nr_sequencia, cd_pessoa_fisica, dt_atualizacao, nm_usuario, ds_historico
       ) VALUES (
         PESSOA_FISICA_HISTORICO_SEQ.NEXTVAL, :cd, SYSDATE, :usuario, :hist
       )`,
      {
        cd: cdPessoaFisica,
        usuario: nmUsuario,
        hist: isNew ? 'Cadastro inicial via Conecta Recepção' : 'Atualização cadastral via Conecta Recepção'
      }
    );

    // ========================================================================
    // PILAR 3: SALVA / ATUALIZA ENDEREÇO (COMPL_PESSOA_FISICA)
    // ========================================================================
    if (dados.ds_endereco || dados.cd_cep || dados.ds_municipio) {
      const complExist = await conn.execute(
        `SELECT nr_sequencia FROM compl_pessoa_fisica WHERE cd_pessoa_fisica = :cd AND ie_tipo_complemento = 1`,
        { cd: cdPessoaFisica }
      );

      if (complExist.rows.length > 0) {
        await conn.execute(
          `UPDATE compl_pessoa_fisica
           SET ds_endereco = :end,
               nr_endereco = :num,
               ds_complemento = :compl,
               ds_bairro = :bairro,
               ds_municipio = :cid,
               sg_estado = :uf,
               cd_cep = :cep,
               cd_municipio_ibge = :ibge,
               nr_telefone_celular = :cel,
               dt_atualizacao = SYSDATE,
               nm_usuario = :usuario
           WHERE cd_pessoa_fisica = :cd AND ie_tipo_complemento = 1`,
          {
            cd: cdPessoaFisica,
            end: dados.ds_endereco || null,
            num: dados.nr_endereco ? parseInt(dados.nr_endereco, 10) || null : null,
            compl: dados.ds_complemento || null,
            bairro: dados.ds_bairro || null,
            cid: dados.ds_municipio || null,
            uf: dados.sg_estado || null,
            cep: dados.cd_cep ? dados.cd_cep.replace(/\D/g, '') : null,
            ibge: dados.cd_municipio_ibge || null,
            cel: dados.nr_telefone_celular || null,
            usuario: nmUsuario
          }
        );
      } else {
        await conn.execute(
          `INSERT INTO compl_pessoa_fisica (
             cd_pessoa_fisica, nr_sequencia, ie_tipo_complemento, ds_endereco, nr_endereco,
             ds_complemento, ds_bairro, ds_municipio, sg_estado, cd_cep, cd_municipio_ibge,
             nr_telefone_celular, dt_atualizacao, nm_usuario, dt_atualizacao_nrec, nm_usuario_nrec
           ) VALUES (
             :cd, 1, 1, :end, :num,
             :compl, :bairro, :cid, :uf, :cep, :ibge,
             :cel, SYSDATE, :usuario, SYSDATE, :usuario
           )`,
          {
            cd: cdPessoaFisica,
            end: dados.ds_endereco || null,
            num: dados.nr_endereco ? parseInt(dados.nr_endereco, 10) || null : null,
            compl: dados.ds_complemento || null,
            bairro: dados.ds_bairro || null,
            cid: dados.ds_municipio || null,
            uf: dados.sg_estado || null,
            cep: dados.cd_cep ? dados.cd_cep.replace(/\D/g, '') : null,
            ibge: dados.cd_municipio_ibge || null,
            cel: dados.nr_telefone_celular || null,
            usuario: nmUsuario
          }
        );
      }
    }

    await conn.commit();
    return { cd_pessoa_fisica: cdPessoaFisica };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// ============================================================================
// CONVÊNIOS E PLANOS (ATEND_CATEGORIA_CONVENIO)
// ============================================================================

async function listarConvenios() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_convenio, ds_convenio
       FROM convenio
       WHERE ie_situacao = 'A'
       ORDER BY ds_convenio`
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function listarCategoriasConvenio(cdConvenio) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT cd_categoria, ds_categoria
       FROM categoria_convenio
       WHERE cd_convenio = :cd AND ie_situacao = 'A'
       ORDER BY ds_categoria`,
      { cd: parseInt(cdConvenio, 10) }
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function obterUltimoConvenioPaciente(cdPessoaFisica) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT * FROM (
         SELECT
           acc.cd_convenio,
           c.ds_convenio,
           acc.cd_categoria,
           cat.ds_categoria,
           acc.cd_plano_convenio,
           acc.cd_usuario_convenio,
           acc.dt_validade_carteira,
           TO_CHAR(acc.dt_validade_carteira, 'YYYY-MM-DD') AS dt_validade_iso,
           acc.nr_doc_convenio,
           acc.cd_tipo_acomodacao
         FROM atendimento_paciente ap
         JOIN atend_categoria_convenio acc ON acc.nr_atendimento = ap.nr_atendimento
         JOIN convenio c ON c.cd_convenio = acc.cd_convenio
         LEFT JOIN categoria_convenio cat ON cat.cd_categoria = acc.cd_categoria AND cat.cd_convenio = acc.cd_convenio
         WHERE ap.cd_pessoa_fisica = :cd_pf
         ORDER BY acc.dt_atualizacao DESC
       ) WHERE ROWNUM = 1`,
      { cd_pf: String(cdPessoaFisica) }
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    await conn.close();
  }
}

// ============================================================================
// SETORES ASSISTENCIAIS ATIVOS
// ============================================================================

async function listarSetoresAtendimento() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT DISTINCT sa.cd_setor_atendimento, sa.ds_setor_atendimento
       FROM setor_atendimento sa
       JOIN unidade_atendimento ua ON ua.cd_setor_atendimento = sa.cd_setor_atendimento
       WHERE sa.ie_situacao = 'A'
       ORDER BY sa.ds_setor_atendimento`
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

// ============================================================================
// PILAR 4: ABERTURA DO ATENDIMENTO HOSPITALAR (O Evento Âncora)
// ============================================================================

async function abrirAtendimento(dados, nmUsuario) {
  const conn = await getConnection();
  try {
    const seqRes = await conn.execute(`SELECT ATENDIMENTO_PACIENTE_SEQ.NEXTVAL AS id FROM dual`);
    const nrAtendimento = seqRes.rows[0].ID;

    const cdSetor = dados.cd_setor_atendimento ? parseInt(dados.cd_setor_atendimento, 10) : 39; // 39 = PA
    const cdConvenio = dados.cd_convenio ? parseInt(dados.cd_convenio, 10) : 3; // 3 = SUS
    const cdCategoria = dados.cd_categoria ? String(dados.cd_categoria) : '1';
    const cdPlano = dados.cd_plano_convenio ? String(dados.cd_plano_convenio) : null;
    const cdUsuarioConv = dados.cd_usuario_convenio ? String(dados.cd_usuario_convenio) : '0';
    const cdProcedencia = dados.cd_procedencia ? parseInt(dados.cd_procedencia, 10) : 1;
    
    // Médico responsável conforme regra do fluxo CETAS (42 -> 1472, padrão -> 338850 ou informado)
    let cdMedico = dados.cd_medico_resp;
    if (!cdMedico) {
      cdMedico = cdConvenio === 42 ? '1472' : '338850';
    }

    const nrSeqSenha = dados.nr_seq_pac_senha_fila ? parseInt(dados.nr_seq_pac_senha_fila, 10) : null;

    // 1. Criação do ATENDIMENTO_PACIENTE
    await conn.execute(
      `INSERT INTO atendimento_paciente (
         nr_atendimento, cd_pessoa_fisica, dt_entrada, cd_estabelecimento,
         cd_procedencia, ie_tipo_atendimento, cd_medico_resp,
         nr_seq_pac_senha_fila, ie_status_atendimento,
         dt_atualizacao, nm_usuario, dt_atualizacao_nrec, nm_usuario_nrec,
         ie_clinica, ie_carater_inter_sus, nr_seq_classificacao, ie_responsavel
       ) VALUES (
         :atend, :cd_pf, SYSDATE, 1,
         :proc, 1, :med,
         :senha, 'E',
         SYSDATE, :usuario, SYSDATE, :usuario,
         5, 1, 2, 3
       )`,
      {
        atend: nrAtendimento,
        cd_pf: String(dados.cd_pessoa_fisica),
        proc: cdProcedencia,
        med: String(cdMedico),
        senha: nrSeqSenha,
        usuario: nmUsuario
      }
    );

    // 2. Criação do Vínculo de Convênio em ATEND_CATEGORIA_CONVENIO
    await conn.execute(
      `INSERT INTO atend_categoria_convenio (
         nr_seq_interno, nr_atendimento, cd_convenio, cd_categoria, cd_plano_convenio,
         cd_usuario_convenio, dt_inicio_vigencia, dt_atualizacao, nm_usuario,
         nr_doc_convenio, cd_tipo_acomodacao, ie_tipo_guia, ie_regime_internacao,
         nm_usuario_original, cd_municipio_convenio
       ) VALUES (
         ATEND_CATEGORIA_CONVENIO_SEQ.NEXTVAL, :atend, :conv, :cat, :plano,
         :carteira, SYSDATE, SYSDATE, :usuario,
         :doc_conv, 3, 'C', '1',
         :usuario, 30570000
       )`,
      {
        atend: nrAtendimento,
        conv: cdConvenio,
        cat: cdCategoria,
        plano: cdPlano,
        carteira: cdUsuarioConv,
        usuario: nmUsuario,
        doc_conv: String(nrAtendimento)
      }
    );

    // 3. Alocação de Setor e Unidade/Leito em ATEND_PACIENTE_UNIDADE (Regra Obrigatória TASY)
    await conn.execute(
      `INSERT INTO atend_paciente_unidade (
         nr_seq_interno, nr_atendimento, nr_sequencia,
         cd_setor_atendimento, cd_unidade_basica, cd_unidade_compl,
         dt_entrada_unidade, nm_usuario, cd_tipo_acomodacao,
         dt_atualizacao, dt_atualizacao_nrec, nm_usuario_nrec, cd_procedencia_atend
       )
       SELECT
         TASY.ATEND_PACIENTE_UNIDADE_SEQ.NEXTVAL,
         :atend,
         1,
         ua.cd_setor_atendimento,
         ua.cd_unidade_basica,
         ua.cd_unidade_compl,
         SYSDATE,
         :usuario,
         NVL(ua.cd_tipo_acomodacao, 3),
         SYSDATE,
         SYSDATE,
         :usuario,
         :proc
       FROM unidade_atendimento ua
       WHERE ua.cd_setor_atendimento = :setor
         AND ROWNUM = 1`,
      {
        atend: nrAtendimento,
        setor: cdSetor,
        usuario: nmUsuario,
        proc: cdProcedencia
      }
    );

    // 4. Abertura da Conta do Paciente em CONTA_PACIENTE (Regra Oficial CETAS)
    await conn.execute(
      `MERGE INTO CONTA_PACIENTE cp
       USING (
           SELECT 
               acc.nr_atendimento,
               MAX(acc.cd_convenio) cd_convenio,
               MAX(acc.cd_categoria) cd_categoria,
               MAX(acc.cd_plano_convenio) cd_plano_convenio
           FROM ATEND_CATEGORIA_CONVENIO acc
           WHERE acc.nr_atendimento = :atend
           GROUP BY acc.nr_atendimento
       ) x
       ON (cp.nr_atendimento = x.nr_atendimento)
       WHEN NOT MATCHED THEN
       INSERT (
           NR_INTERNO_CONTA,
           NR_ATENDIMENTO,
           CD_ESTABELECIMENTO,
           CD_CONVENIO_PARAMETRO,
           CD_CATEGORIA_PARAMETRO,
           DT_PERIODO_INICIAL,
           DT_MESANO_REFERENCIA,
           IE_TIPO_ATEND_CONTA,
           NM_USUARIO,
           DT_ATUALIZACAO,
           IE_STATUS_ACERTO,
           CD_PLANO,
           DT_ACERTO_CONTA,
           DT_PERIODO_FINAL
       )
       VALUES (
           TASY.CONTA_PACIENTE_SEQ.NEXTVAL,
           x.nr_atendimento,
           1,
           x.cd_convenio,
           x.cd_categoria,
           SYSDATE,
           TRUNC(SYSDATE, 'MM'),
           1,
           :usuario,
           SYSDATE,
           1,
           x.cd_plano_convenio,
           SYSDATE,
           SYSDATE
       )`,
      {
        atend: nrAtendimento,
        usuario: nmUsuario
      }
    );

    // 5. Lançamento Automático de Procedimentos da Conta
    await conn.execute(
      `DECLARE
        v_nr_interno_conta NUMBER;
      BEGIN
        SELECT MAX(nr_interno_conta)
        INTO v_nr_interno_conta
        FROM conta_paciente
        WHERE nr_atendimento = :atend;

        IF (v_nr_interno_conta IS NOT NULL) THEN
          GERAR_LANCAMENTO_AUTOMATICO(
            NM_USUARIO_P        => :usuario,
            NR_INTERNO_CONTA_P  => TO_CHAR(v_nr_interno_conta),
            NR_ATENDIMENTO_P    => TO_CHAR(:atend),
            DS_ADICIONAL_1_P    => NULL,
            DS_ADICIONAL_2_P    => NULL,
            DS_ADICIONAL_3_P    => NULL,
            NR_SEQ_EVENTO_P     => 26,
            NR_SEQUENCIA_P      => NULL,
            DS_ADICIONAL_4_P    => NULL,
            CD_LOCAL_ESTOQUE_P  => NULL
          );
        END IF;
      END;`,
      {
        atend: nrAtendimento,
        usuario: nmUsuario
      }
    );

    // 6. Se houver senha vinculada, move para a fila do consultório/triagem
    if (nrSeqSenha && dados.nr_fila_destino) {
      await conn.execute(
        `UPDATE paciente_senha_fila
         SET nr_seq_fila_senha = :fila_dest,
             cd_pessoa_fisica = :cd_pf,
             dt_fim_atendimento = NULL,
             dt_chamada = SYSDATE,
             dt_atualizacao = SYSDATE,
             nm_usuario = :usuario
         WHERE nr_sequencia = :seq`,
        {
          fila_dest: parseInt(dados.nr_fila_destino, 10),
          cd_pf: String(dados.cd_pessoa_fisica),
          usuario: nmUsuario,
          seq: nrSeqSenha
        }
      );
    }

    await conn.commit();
    return { nr_atendimento: nrAtendimento };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// ============================================================================
// PILAR 5: RELATÓRIOS TASY & GED
// ============================================================================

async function listarRelatoriosAtendimento() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT
         cd_relatorio,
         ds_titulo,
         ie_tipo_relatorio
       FROM relatorio
       WHERE (
         UPPER(ds_titulo) LIKE '%HEAL%'
         OR UPPER(ds_titulo) LIKE '%PRONTUARIO%'
         OR UPPER(ds_titulo) LIKE '%CONTRATO%'
         OR UPPER(ds_titulo) LIKE '%AUTORIZACAO%'
         OR UPPER(ds_titulo) LIKE '%ALTA%'
         OR UPPER(ds_titulo) LIKE '%TISS%'
       )
       ORDER BY ds_titulo`
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function listarDocumentosGED(nrAtendimento, cdPessoaFisica) {
  const conn = await getConnection();
  try {
    const binds = {};
    let where = '1=1';

    if (nrAtendimento) {
      where += ' AND ga.nr_atendimento = :atend';
      binds.atend = parseInt(nrAtendimento, 10);
    } else if (cdPessoaFisica) {
      where += ' AND ga.cd_pessoa_fisica = :pf';
      binds.pf = String(cdPessoaFisica);
    }

    const result = await conn.execute(
      `SELECT
         ga.nr_sequencia,
         ga.nr_atendimento,
         ga.cd_pessoa_fisica,
         ga.ds_titulo,
         ga.ds_arquivo,
         ga.ds_extensao_arquivo,
         TO_CHAR(ga.dt_registro, 'DD/MM/YYYY HH24:MI') AS dt_registro_fmt,
         ga.nm_usuario
       FROM ged_atendimento ga
       WHERE ${where} AND ga.dt_inativacao IS NULL
       ORDER BY ga.dt_registro DESC`,
      binds
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function anexarDocumentoGED(dados, nmUsuario) {
  const conn = await getConnection();
  try {
    const seqRes = await conn.execute(`SELECT GED_ATENDIMENTO_SEQ.NEXTVAL AS id FROM dual`);
    const nrSeq = seqRes.rows[0].ID;

    await conn.execute(
      `INSERT INTO ged_atendimento (
         nr_sequencia, nr_atendimento, cd_pessoa_fisica, ds_titulo,
         ds_arquivo, ds_extensao_arquivo, dt_registro, dt_atualizacao,
         nm_usuario, cd_estabelecimento
       ) VALUES (
         :seq, :atend, :pf, :titulo,
         :arquivo, :ext, SYSDATE, SYSDATE,
         :usuario, 1
       )`,
      {
        seq: nrSeq,
        atend: dados.nr_atendimento ? parseInt(dados.nr_atendimento, 10) : null,
        pf: String(dados.cd_pessoa_fisica),
        titulo: dados.ds_titulo || 'Documento Anexado na Recepção',
        arquivo: dados.ds_arquivo,
        ext: dados.ds_extensao_arquivo || 'pdf',
        usuario: nmUsuario
      }
    );

    await conn.commit();
    return { nr_sequencia: nrSeq };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

module.exports = {
  listarFilasSenhas,
  listarSenhasEspera,
  chamarProximaSenha,
  rechamarSenha,
  buscarPessoas,
  obterPessoaCompleta,
  salvarPessoaFisica,
  listarConvenios,
  listarCategoriasConvenio,
  obterUltimoConvenioPaciente,
  listarSetoresAtendimento,
  abrirAtendimento,
  listarRelatoriosAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED
};
