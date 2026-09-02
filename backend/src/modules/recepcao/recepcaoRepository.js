const { getConnection } = require('../../core/database');
const configCache = require('../../core/config/configCache');

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
// CLASSIFICAÇÕES DE ATENDIMENTO
// ============================================================================

async function listarClassificacoesAtendimento() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT nr_sequencia, ds_classificacao
       FROM classificacao_atendimento
       WHERE ie_situacao = 'A'
       ORDER BY nr_sequencia`
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
    const sysConfig = configCache.getSystemConfig() || {};
    const seqRes = await conn.execute(`SELECT ATENDIMENTO_PACIENTE_SEQ.NEXTVAL AS id FROM dual`);
    const nrAtendimento = seqRes.rows[0].ID;

    const cdSetor = dados.cd_setor_atendimento ? parseInt(dados.cd_setor_atendimento, 10) : (parseInt(sysConfig.recepcao_cd_setor_padrao, 10) || 39);
    const cdConvenio = dados.cd_convenio ? parseInt(dados.cd_convenio, 10) : (parseInt(sysConfig.recepcao_cd_convenio_padrao, 10) || 3);
    const cdCategoria = dados.cd_categoria ? String(dados.cd_categoria) : (String(sysConfig.recepcao_cd_categoria_padrao || '1'));
    const cdPlano = dados.cd_plano_convenio ? String(dados.cd_plano_convenio) : null;
    const cdUsuarioConv = dados.cd_usuario_convenio ? String(dados.cd_usuario_convenio) : '0';
    const cdProcedencia = dados.cd_procedencia ? parseInt(dados.cd_procedencia, 10) : (parseInt(sysConfig.recepcao_cd_procedencia, 10) || 1);
    const cdEstabelecimento = dados.cd_estabelecimento ? parseInt(dados.cd_estabelecimento, 10) : (parseInt(sysConfig.recepcao_cd_estabelecimento, 10) || 1);
    const ieTipoAtendimento = dados.ie_tipo_atendimento ? parseInt(dados.ie_tipo_atendimento, 10) : (parseInt(sysConfig.recepcao_ie_tipo_atendimento, 10) || 3);
    
    // Médico responsável: padrão configurável no Admin ou 408120
    const cdMedico = dados.cd_medico_resp || sysConfig.recepcao_cd_med_resp || '408120';
    
    // Classificação do atendimento (ex: 2 = Voluntário, 1 = Involuntário, 3 = Compulsória)
    const nrSeqClassif = dados.nr_seq_classificacao ? parseInt(dados.nr_seq_classificacao, 10) : (parseInt(sysConfig.recepcao_classificacao_padrao, 10) || 2);

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
         :atend, :cd_pf, SYSDATE, :estab,
         :proc, :tipo_atend, :med,
         :senha, 'E',
         SYSDATE, :usuario, SYSDATE, :usuario,
         5, 1, :classif, 3
       )`,
      {
        atend: nrAtendimento,
        cd_pf: String(dados.cd_pessoa_fisica),
        estab: cdEstabelecimento,
        proc: cdProcedencia,
        tipo_atend: ieTipoAtendimento,
        med: String(cdMedico),
        classif: nrSeqClassif,
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

const MAPA_RELATORIOS_OFICIAIS = [
  { cd_relatorio: 718, nr_sequencia: 2750455, ds_titulo: '718 — CHECKLIST PRONTUÁRIO', icone: 'bi-check2-square', badge: 'Prontuário' },
  { cd_relatorio: 651, nr_sequencia: 2750348, ds_titulo: '651 — HEAL - Autorização do responsável para contatos com o paciente', icone: 'bi-person-check', badge: 'Consentimento' },
  { cd_relatorio: 205, nr_sequencia: 2750344, ds_titulo: '205 — HEAL - Comunicado de Alta - Involuntário - HTML5', icone: 'bi-file-earmark-medical', badge: 'Internação Involuntária' },
  { cd_relatorio: 206, nr_sequencia: 2750347, ds_titulo: '206 — HEAL - Comunicado de Alta Médica Voluntária - HTML5', icone: 'bi-file-earmark-text', badge: 'Internação Voluntária' },
  { cd_relatorio: 643, nr_sequencia: 2750843, ds_titulo: '643 — HEAL - Contrato de prestação de serviços hospitalar - HTML5', icone: 'bi-file-earmark-ruled', badge: 'Contrato Jurídico' },
  { cd_relatorio: 717, nr_sequencia: 2750452, ds_titulo: '717 — TERMO DE AUTORIZAÇÃO PARA REALIZAÇÃO DE EXAMES LABORATORIAIS', icone: 'bi-eyedropper', badge: 'Exames' },
  { cd_relatorio: 70126, nr_sequencia: 2750211, ds_titulo: '70126 — V.4.0 - TISS - Guia de Resumo de Internação', icone: 'bi-file-earmark-spreadsheet', badge: 'TISS / Faturamento' }
];

async function listarRelatoriosAtendimento() {
  const conn = await getConnection();
  try {
    const seqs = MAPA_RELATORIOS_OFICIAIS.map(r => r.nr_sequencia).join(',');
    const result = await conn.execute(
      `SELECT cd_relatorio, nr_sequencia, ds_titulo
       FROM relatorio
       WHERE nr_sequencia IN (${seqs})
       ORDER BY cd_relatorio`
    );

    const dbMap = new Map((result.rows || []).map(r => [r.NR_SEQUENCIA, r]));

    return MAPA_RELATORIOS_OFICIAIS.map(item => {
      const dbRow = dbMap.get(item.nr_sequencia);
      return {
        cd_relatorio: item.cd_relatorio,
        nr_sequencia: item.nr_sequencia,
        ds_titulo: item.ds_titulo,
        icone: item.icone,
        badge: item.badge,
        ds_titulo_tasy: dbRow?.DS_TITULO || item.ds_titulo
      };
    });
  } finally {
    await conn.close();
  }
}

async function gerarRelatorioAtendimento(cdRelatorio, nrAtendimento) {
  const conn = await getConnection();
  try {
    const cd = parseInt(cdRelatorio, 10);
    const nAtend = parseInt(nrAtendimento, 10);

    const repInfo = MAPA_RELATORIOS_OFICIAIS.find(r => r.cd_relatorio === cd) || {
      cd_relatorio: cd,
      ds_titulo: `Relatório ${cd}`
    };

    let sql = null;
    if (repInfo.nr_sequencia) {
      const relDb = await conn.execute(
        `SELECT ds_sql, ds_titulo FROM relatorio WHERE nr_sequencia = :seq`,
        { seq: repInfo.nr_sequencia }
      );
      sql = relDb.rows[0]?.DS_SQL;
    }

    let dados = {};
    if (sql && cd !== 70126) {
      try {
        const dRes = await conn.execute(sql, { nr_atendimento: nAtend });
        dados = dRes.rows[0] || {};
      } catch (err) {
        console.warn(`[Relatórios] Fallback na query específica do relatório ${cd}:`, err.message);
      }
    }

    if (!dados.NM_PACIENTE) {
      const fbRes = await conn.execute(
        `SELECT
           ap.nr_atendimento,
           ap.cd_pessoa_fisica,
           ap.nr_prontuario,
           ap.nm_paciente,
           ap.ds_idade,
           ap.ds_sexo,
           TO_CHAR(ap.dt_nascimento, 'DD/MM/YYYY') AS dt_nasc_fmt,
           TO_CHAR(ap.dt_entrada, 'DD/MM/YYYY HH24:MI') AS dt_entrada_fmt,
           ap.ds_convenio,
           ap.ds_categoria,
           ap.cd_usuario_convenio,
           ap.nr_cpf,
           ap.nr_identidade,
           ap.ds_setor_atendimento,
           ap.nm_medico AS nm_medico_resp,
           ap.nr_crm,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'E') AS ds_end,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'B') AS ds_bairro,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'CI') AS ds_municipio,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'UF') AS sg_estado,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'CEP') AS cd_cep,
           ap.nr_telefone_celular AS cel,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'N') AS nome_respo,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'C') AS cpf_respo,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'I') AS carteira_ci,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'EN') AS endere_respo,
           obter_compl_pf(ap.cd_pessoa_fisica, 4, 'N') AS nm_pai,
           obter_compl_pf(ap.cd_pessoa_fisica, 5, 'N') AS nm_mae
         FROM atendimento_paciente_v ap
         WHERE ap.nr_atendimento = :atend`,
        { atend: nAtend }
      );
      dados = fbRes.rows[0] || {};
    }

    return renderizarHtmlDocumento(cd, repInfo.ds_titulo, dados, nAtend);
  } finally {
    await conn.close();
  }
}

function renderizarHtmlDocumento(cdRelatorio, titulo, d, nrAtendimento) {
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dataHoraHoje = new Date().toLocaleString('pt-BR');

  const pacienteNome = d.NM_PACIENTE || d.nm_paciente || 'Não informado';
  const prontuario = d.NR_PRONTUARIO || d.nr_prontuario || '-';
  const cpf = d.NR_CPF || d.nr_cpf || '-';
  const rg = d.NR_IDENTIDADE || d.nr_identidade || '-';
  const dtNasc = d.DT_NASC_FMT || (d.DT_NASCIMENTO ? new Date(d.DT_NASCIMENTO).toLocaleDateString('pt-BR') : '-');
  const idade = d.DS_IDADE_COMP || d.DS_IDADE || d.ds_idade || '-';
  const sexo = d.DS_SEXO || d.ds_sexo || '-';
  const convenio = d.DS_CONVENIO || d.ds_convenio || 'Particular / SUS';
  const carteirinha = d.CD_USUARIO_CONVENIO || d.cd_usuario_convenio || '-';
  const endereco = d.DS_END || d.ds_end || '-';
  const bairro = d.DS_BAIRRO || d.ds_bairro || '-';
  const cidade = d.DS_MUNICIPIO || d.ds_municipio || 'Belo Horizonte';
  const telefone = d.CEL || d.NR_TELEFONE_CELULAR || d.NR_FONE_PACIENTE || '-';
  const responsavel = d.NOME_RESPO || d.nome_respo || pacienteNome;
  const cpfResp = d.CPF_RESPO || d.cpf_respo || cpf;
  const rgResp = d.CARTEIRA_CI || d.carteira_ci || rg;
  const medicoResp = d.NM_MEDICO_RESP || d.nm_medico_resp || 'Corpo Clínico HEAL';
  const setor = d.DS_SETOR_ATENDIMENTO || d.ds_setor_atendimento || 'Pronto Atendimento';
  const mae = d.NM_MAE || d.nm_mae || '-';

  let corpoConteudo = '';

  switch (cdRelatorio) {
    case 718: // CHECKLIST PRONTUÁRIO
      corpoConteudo = `
        <div class="card p-3 mb-4">
          <h5 class="text-primary border-bottom pb-2"><i class="bi bi-check2-square"></i> Conferência de Itens Obrigatórios de Admissão</h5>
          <table class="table table-bordered table-striped mt-3">
            <thead class="table-light">
              <tr>
                <th style="width: 50px;" class="text-center">Status</th>
                <th>Item / Documento Obrigatório do Prontuário</th>
                <th style="width: 200px;">Responsável / Rubrica</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="text-center fs-5">☑</td><td>Documento Oficial com Foto e CPF conferidos e arquivados</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Cartão do Convênio / Autorização de Guia TISS</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Contrato de Prestação de Serviços Hospitalares Assinado</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Termo de Autorização do Responsável para Contatos</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Termo de Consentimento para Exames Laboratoriais</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Ficha de Admissão Médica e Prescrição Inicial</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Pulseira de Identificação do Paciente Fixada</td><td>____________________</td></tr>
              <tr><td class="text-center fs-5">☑</td><td>Inventário de Pertences e Guarda-Volumes Entregue</td><td>____________________</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 651: // AUTORIZAÇÃO DO RESPONSÁVEL
      corpoConteudo = `
        <div class="card p-3 mb-4 text-justify">
          <h5 class="text-primary border-bottom pb-2">Termo de Autorização para Comunicação e Contatos</h5>
          <p class="mt-3">
            Eu, <strong>${responsavel}</strong>, portador(a) do CPF nº <strong>${cpfResp}</strong> e RG nº <strong>${rgResp}</strong>, na qualidade de responsável legal pelo(a) paciente <strong>${pacienteNome}</strong> (Prontuário nº <strong>${prontuario}</strong>, Atendimento nº <strong>${nrAtendimento}</strong>):
          </p>
          <div class="alert alert-secondary">
            <strong>AUTORIZO EXPRESSAMENTE</strong> o <strong>Hospital Espírita André Luiz (HEAL)</strong> e suas equipes médica, assistencial e de acolhimento a realizarem contatos telefônicos, envio de mensagens e relatórios informativos sobre o quadro de saúde, evolução clínica e questões administrativas através dos canais:
            <ul class="mt-2 mb-0">
              <li><strong>Telefone / Celular Principal:</strong> ${telefone}</li>
              <li><strong>Cidade / Município de Residência:</strong> ${cidade}</li>
            </ul>
          </div>
          <p>
            Declaro estar ciente de que, em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018 - LGPD)</strong>, as informações de saúde são confidenciais e destinadas exclusivamente aos contatos formalmente autorizados neste instrumento.
          </p>
        </div>
      `;
      break;

    case 205: // COMUNICADO DE ALTA INVOLUNTÁRIA
      corpoConteudo = `
        <div class="card p-3 mb-4 text-justify">
          <h5 class="text-primary border-bottom pb-2">Comunicado de Desinternação / Alta Hospitalar — Regime Involuntário</h5>
          <p class="mt-3">
            Ao Ministério Público do Estado de Minas Gerais / Comissão de Revisão de Internações Involuntárias e Familiares:
          </p>
          <p>
            Em cumprimento ao disposto na <strong>Lei Federal nº 10.216, de 06 de abril de 2001 (Art. 8º, § 2º)</strong>, o <strong>HOSPITAL ESPÍRITA ANDRÉ LUIZ</strong> comunica a alta / desinternação hospitalar do(a) paciente:
          </p>
          <div class="bg-light p-3 border rounded mb-3">
            <strong>Paciente:</strong> ${pacienteNome}<br>
            <strong>Prontuário:</strong> ${prontuario} | <strong>Atendimento:</strong> ${nrAtendimento}<br>
            <strong>Data da Admissão:</strong> ${d.DT_ENTRADA_FMT || dataHoraHoje}<br>
            <strong>Setor:</strong> ${setor} | <strong>Médico Responsável:</strong> ${medicoResp}
          </div>
          <p>
            O paciente recebeu avaliação médica e multiprofissional com parecer favorável à continuidade do cuidado em regime extra-hospitalar e comunitário (Rede de Atenção Psicossocial - RAPS / Ambulatório).
          </p>
        </div>
      `;
      break;

    case 206: // COMUNICADO DE ALTA VOLUNTÁRIA
      corpoConteudo = `
        <div class="card p-3 mb-4 text-justify">
          <h5 class="text-primary border-bottom pb-2">Comunicado de Alta Médica — Regime Voluntário</h5>
          <p class="mt-3">
            Certificamos que o(a) paciente <strong>${pacienteNome}</strong>, internado(a) sob o número de atendimento <strong>${nrAtendimento}</strong> e prontuário <strong>${prontuario}</strong>, recebeu alta médica hospitalar no <strong>Hospital Espírita André Luiz</strong> na data de hoje.
          </p>
          <p>
            O paciente e seus responsáveis foram devidamente orientados quanto às prescrições medicamentosas, cuidados gerais, recomendações nutricionais e encaminhamento para acompanhamento psiquiátrico e psicológico ambulatorial.
          </p>
        </div>
      `;
      break;

    case 643: // CONTRATO DE PRESTAÇÃO DE SERVIÇOS HOSPITALARES
      corpoConteudo = `
        <div class="card p-3 mb-4 text-justify" style="font-size: 0.92rem; line-height: 1.5;">
          <h5 class="text-center fw-bold mb-3">CONTRATO DE PRESTAÇÃO DE SERVIÇOS HOSPITALARES</h5>
          <p>
            Pelo presente instrumento particular, de um lado o <strong>HOSPITAL ESPÍRITA ANDRÉ LUIZ</strong>, mantido pela Fundação Espírita André Luiz, CNPJ 17.218.471/0001-05, com sede em Belo Horizonte/MG, doravante denominado <strong>CONTRATADO</strong>, e de outro lado <strong>${responsavel}</strong> (CPF: <strong>${cpfResp}</strong>, RG: <strong>${rgResp}</strong>), doravante denominado(a) <strong>RESPONSÁVEL / CONTRATANTE</strong>, e o(a) paciente <strong>${pacienteNome}</strong> (Prontuário <strong>${prontuario}</strong>, Atendimento <strong>${nrAtendimento}</strong>), têm entre si justo e acordado as seguintes cláusulas:
          </p>
          
          <h6 class="fw-bold mt-3 text-primary">CLÁUSULA PRIMEIRA — DO OBJETO</h6>
          <p>O CONTRATADO prestará assistência hospitalar e psiquiátrica especializada ao PACIENTE nas instalações do HEAL, de acordo com as normas médicas, éticas e regulamentares vigentes.</p>

          <h6 class="fw-bold mt-3 text-primary">CLÁUSULA SEGUNDA — DAS NORMAS E REGRAS GERAIS</h6>
          <p>O PACIENTE e o RESPONSÁVEL obrigam-se a acatar as normas regimentais da instituição, regras de convivência, horários de visitas e determinações da equipe terapêutica multidisciplinar.</p>

          <h6 class="fw-bold mt-3 text-primary">CLÁUSULA TERCEIRA — DOS RECURSOS E CONVÊNIOS</h6>
          <p>Em caso de atendimento por Convênio / Operadora de Saúde (<strong>${convenio}</strong>, Matrícula <strong>${carteirinha}</strong>), o RESPONSÁVEL obriga-se a fornecer as guias e autorizações tempestivas exigidas pelo plano.</p>

          <h6 class="fw-bold mt-3 text-primary">CLÁUSULA QUARTA — DA LEI GERAL DE PROTEÇÃO DE DADOS (LGPD)</h6>
          <p>As partes consentem com o tratamento de dados pessoais estritamente necessários para a tutela da saúde, cumprimento de obrigações legais e faturamento hospitalar, sob sigilo médico integral.</p>

          <h6 class="fw-bold mt-3 text-primary">CLÁUSULA QUINTA — DO FORO</h6>
          <p>As partes elegem o foro da Comarca de Belo Horizonte, Estado de Minas Gerais, para dirimir quaisquer controvérsias oriundas deste instrumento.</p>
        </div>
      `;
      break;

    case 717: // TERMO AUTORIZAÇÃO EXAMES
      corpoConteudo = `
        <div class="card p-3 mb-4 text-justify">
          <h5 class="text-primary border-bottom pb-2">Termo de Autorização para Realização de Exames Complementares e Laboratoriais</h5>
          <p class="mt-3">
            Eu, <strong>${responsavel}</strong>, na qualidade de paciente / responsável legal por <strong>${pacienteNome}</strong> (Prontuário nº <strong>${prontuario}</strong>, Atendimento nº <strong>${nrAtendimento}</strong>):
          </p>
          <div class="alert alert-info">
            <strong>AUTORIZO</strong> a equipe técnica, laboratorial e de enfermagem do <strong>Hospital Espírita André Luiz</strong> a realizar a coleta de amostras biológicas e execução de exames laboratoriais, toxicológicos, eletrocardiogramas e diagnósticos complementares indicados pelo corpo clínico assistente para elucidação diagnóstica e monitoramento da terapêutica instituída.
          </div>
          <p>
            Declaro ter recebido todos os esclarecimentos pertinentes à necessidade dos exames e seus procedimentos de coleta.
          </p>
        </div>
      `;
      break;

    case 70126: // GUIA TISS RESUMO DE INTERNAÇÃO
    default:
      corpoConteudo = `
        <div class="card p-3 mb-4">
          <div class="d-flex justify-content-between border-bottom pb-2 mb-3">
            <h6 class="fw-bold mb-0">PADRÃO TISS V.4.0 — GUIA DE RESUMO DE INTERNAÇÃO</h6>
            <span class="badge bg-secondary">ANS - Registro 305700</span>
          </div>
          <div class="row g-2 mb-3" style="font-size: 0.85rem;">
            <div class="col-3 border p-2"><strong>1- Registro ANS:</strong> 305700</div>
            <div class="col-4 border p-2"><strong>3- Nº Guia Prestador:</strong> ${nrAtendimento}</div>
            <div class="col-5 border p-2"><strong>4- Data Emissão:</strong> ${dataHoraHoje}</div>
            <div class="col-6 border p-2"><strong>8- Carteira do Beneficiário:</strong> ${carteirinha}</div>
            <div class="col-6 border p-2"><strong>10- Nome do Beneficiário:</strong> ${pacienteNome}</div>
            <div class="col-4 border p-2"><strong>13- CNPJ Contratado:</strong> 17.218.471/0001-05</div>
            <div class="col-8 border p-2"><strong>14- Nome Contratado:</strong> HOSPITAL ESPÍRITA ANDRÉ LUIZ</div>
            <div class="col-4 border p-2"><strong>16- Caráter Atendimento:</strong> Urgência/Emergência</div>
            <div class="col-4 border p-2"><strong>17- Tipo Faturamento:</strong> Total</div>
            <div class="col-4 border p-2"><strong>18- Início Faturamento:</strong> ${d.DT_ENTRADA_FMT || dataHoraHoje}</div>
            <div class="col-6 border p-2"><strong>22- Tipo Internação:</strong> Clínica / Psiquiátrica</div>
            <div class="col-6 border p-2"><strong>23- Regime Internação:</strong> Hospitalar Integral</div>
          </div>
        </div>
      `;
      break;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo} — Atendimento #${nrAtendimento}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css" rel="stylesheet">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #f8fafc; padding: 20px; }
    .report-container { max-width: 900px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 35px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .hospital-header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    .patient-box { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 20px; font-size: 0.9rem; }
    .signature-box { margin-top: 45px; page-break-inside: avoid; }
    .sig-line { border-top: 1px solid #334155; width: 85%; margin: 0 auto 5px auto; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .report-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="report-container">
    <!-- BARRA DE AÇÕES (NÃO IMPRIME) -->
    <div class="no-print d-flex justify-content-between align-items-center mb-4 bg-light p-3 rounded border">
      <div>
        <span class="badge bg-primary fs-6 me-2">TASY Oficial</span>
        <strong>${titulo}</strong> — Atendimento #${nrAtendimento}
      </div>
      <div>
        <button class="btn btn-primary me-2" onclick="window.print()">
          <i class="bi bi-printer-fill"></i> Imprimir Documento
        </button>
        <button class="btn btn-outline-secondary" onclick="window.close()">
          <i class="bi bi-x-circle"></i> Fechar
        </button>
      </div>
    </div>

    <!-- CABEÇALHO HOSPITALAR OFICIAL -->
    <div class="hospital-header d-flex align-items-center justify-content-between">
      <div>
        <h4 class="fw-bold mb-0 text-primary">HOSPITAL ESPÍRITA ANDRÉ LUIZ</h4>
        <small class="text-muted">Fundação Espírita André Luiz | CNPJ: 17.218.471/0001-05</small><br>
        <small class="text-muted">Rua Úrsula Paulino, 7 — Salgado Filho — Belo Horizonte/MG — CEP 30550-000</small>
      </div>
      <div class="text-end">
        <h6 class="fw-bold text-secondary mb-0">${titulo}</h6>
        <span class="badge bg-dark">Atendimento: #${nrAtendimento}</span>
      </div>
    </div>

    <!-- QUADRO DO PACIENTE & ATENDIMENTO -->
    <div class="patient-box">
      <div class="row g-2">
        <div class="col-md-6"><strong>Paciente:</strong> ${pacienteNome}</div>
        <div class="col-md-3"><strong>Prontuário:</strong> ${prontuario}</div>
        <div class="col-md-3"><strong>Atendimento:</strong> ${nrAtendimento}</div>
        <div class="col-md-3"><strong>CPF:</strong> ${cpf}</div>
        <div class="col-md-3"><strong>RG:</strong> ${rg}</div>
        <div class="col-md-3"><strong>Dt. Nasc:</strong> ${dtNasc}</div>
        <div class="col-md-3"><strong>Idade/Sexo:</strong> ${idade} / ${sexo}</div>
        <div class="col-md-6"><strong>Convênio:</strong> ${convenio}</div>
        <div class="col-md-6"><strong>Carteira / Guia:</strong> ${carteirinha}</div>
        <div class="col-md-8"><strong>Endereço:</strong> ${endereco}, ${bairro} — ${cidade}</div>
        <div class="col-md-4"><strong>Telefone:</strong> ${telefone}</div>
        <div class="col-md-6"><strong>Médico Assistente:</strong> ${medicoResp}</div>
        <div class="col-md-6"><strong>Setor Admissão:</strong> ${setor}</div>
      </div>
    </div>

    <!-- CORPO ESPECÍFICO DO RELATÓRIO -->
    ${corpoConteudo}

    <!-- ASSINATURAS E DATA -->
    <div class="signature-box text-center mt-5">
      <p class="mb-4">Belo Horizonte, ${dataHoje}.</p>
      <div class="row mt-4">
        <div class="col-6">
          <div class="sig-line"></div>
          <strong>${responsavel}</strong><br>
          <small class="text-muted">Paciente / Responsável Legal (CPF: ${cpfResp})</small>
        </div>
        <div class="col-6">
          <div class="sig-line"></div>
          <strong>${medicoResp}</strong><br>
          <small class="text-muted">Hospital Espírita André Luiz / Recepção</small>
        </div>
      </div>
    </div>

    <!-- RODAPÉ TASY SISTÊMICO -->
    <div class="mt-5 pt-3 border-top text-muted small d-flex justify-content-between no-print">
      <span>Conecta HEAL 2.0 &bull; Integração TASY Oficial</span>
      <span>Gerado em: ${dataHoraHoje}</span>
    </div>
  </div>

</body>
</html>`;
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

    const sysConfig = configCache.getSystemConfig() || {};
    const cdProfissional = dados.cd_profissional || dados.cd_pessoa_fisica_usuario || sysConfig.recepcao_cd_med_resp || '408120';
    const tipoArquivo = dados.nr_seq_tipo_arquivo || parseInt(sysConfig.recepcao_ged_tipo_arquivo, 10) || 10;
    const cdEstabelecimento = dados.cd_estabelecimento || parseInt(sysConfig.recepcao_cd_estabelecimento, 10) || 1;

    await conn.execute(
      `INSERT INTO ged_atendimento (
         nr_sequencia,
         nr_atendimento,
         cd_pessoa_fisica,
         ds_titulo,
         cd_profissional,
         ds_arquivo,
         ds_extensao_arquivo,
         dt_registro,
         dt_atualizacao,
         nm_usuario,
         cd_estabelecimento,
         nr_seq_tipo_arquivo,
         ie_situacao
       ) VALUES (
         :seq,
         :atend,
         :pf,
         :titulo,
         :prof,
         :arquivo,
         :ext,
         SYSDATE,
         SYSDATE,
         :usuario,
         1,
         :tipoArq,
         'A'
       )`,
      {
        seq: nrSeq,
        atend: dados.nr_atendimento ? parseInt(dados.nr_atendimento, 10) : null,
        pf: String(dados.cd_pessoa_fisica || '0'),
        titulo: dados.ds_titulo || 'Documento Anexado na Recepção',
        prof: String(cdProfissional),
        arquivo: dados.ds_arquivo || 'documento.pdf',
        ext: dados.ds_extensao_arquivo || 'pdf',
        usuario: nmUsuario,
        tipoArq: tipoArquivo
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

async function obterContaPaciente(nrAtendimento) {
  if (!nrAtendimento) return null;
  const conn = await getConnection();
  try {
    const res = await conn.execute(
      `SELECT nr_interno_conta FROM conta_paciente WHERE nr_atendimento = :atend ORDER BY dt_atualizacao DESC`,
      { atend: Number(nrAtendimento) }
    );
    if (res.rows && res.rows.length > 0) {
      return String(res.rows[0].NR_INTERNO_CONTA);
    }
    return null;
  } catch (err) {
    console.error('[Recepção] Erro ao obter conta paciente:', err);
    return null;
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
  listarClassificacoesAtendimento,
  abrirAtendimento,
  obterContaPaciente,
  listarRelatoriosAtendimento,
  gerarRelatorioAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED
};
