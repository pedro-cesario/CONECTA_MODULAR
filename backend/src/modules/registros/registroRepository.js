const { getConnection } = require('../../core/database');
const oracledb = require('oracledb');

function normalizeCpf(cpfRaw) {
  if (!cpfRaw) return '';
  return String(cpfRaw).replace(/\D/g, '');
}

function removeAccents(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function parseTelefoneBR(telRaw) {
  const digits = String(telRaw || '').replace(/\D/g, '');
  if (!digits) return { ddd: null, telefone: null, celNumeros: null };
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const telefone = digits.slice(2);
    return { ddd, telefone, celNumeros: Number(digits) };
  }
  return { ddd: '31', telefone: digits, celNumeros: Number('31' + digits) };
}

async function buscarPessoasInteligente(termoRaw, limit = 30) {
  const raw = String(termoRaw || '').trim();
  if (!raw) return [];

  const digitsOnly = raw.replace(/\D/g, '');
  const isOnlyDigits = /^\d+$/.test(raw.replace(/[\.\-\/\s]/g, ''));

  const conn = await getConnection();
  try {
    let sql;
    let binds = {};

    if (isOnlyDigits && digitsOnly.length >= 11) {
      sql = `SELECT PF.CD_PESSOA_FISICA,
                    PF.NM_PESSOA_FISICA,
                    PF.NR_CPF,
                    TO_CHAR(PF.DT_NASCIMENTO, 'YYYY-MM-DD') AS DT_NASCIMENTO,
                    PF.IE_SEXO,
                    PF.NR_IDENTIDADE,
                    PF.NR_DDD_CELULAR,
                    PF.NR_TELEFONE_CELULAR,
                    PF.DS_OBSERVACAO
               FROM TASY.PESSOA_FISICA PF
              WHERE PF.NR_CPF = :cpf
              FETCH FIRST :limite ROWS ONLY`;
      binds = { cpf: digitsOnly, limite: Math.min(50, Math.max(1, limit)) };
    } else if (isOnlyDigits && digitsOnly.length < 11) {
      sql = `SELECT PF.CD_PESSOA_FISICA,
                    PF.NM_PESSOA_FISICA,
                    PF.NR_CPF,
                    TO_CHAR(PF.DT_NASCIMENTO, 'YYYY-MM-DD') AS DT_NASCIMENTO,
                    PF.IE_SEXO,
                    PF.NR_IDENTIDADE,
                    PF.NR_DDD_CELULAR,
                    PF.NR_TELEFONE_CELULAR,
                    PF.DS_OBSERVACAO
               FROM TASY.PESSOA_FISICA PF
              WHERE PF.CD_PESSOA_FISICA = :cd
                 OR PF.NR_CPF LIKE :cpfPref || '%'
              ORDER BY CASE WHEN PF.CD_PESSOA_FISICA = :cd THEN 0 ELSE 1 END, PF.NM_PESSOA_FISICA ASC
              FETCH FIRST :limite ROWS ONLY`;
      binds = { cd: digitsOnly, cpfPref: digitsOnly, limite: Math.min(50, Math.max(1, limit)) };
    } else {
      const stopwords = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'PARA', 'COM', 'EM']);
      const allTokens = removeAccents(raw).split(/\s+/).filter(Boolean);
      const usefulTokens = allTokens.filter(t => !stopwords.has(t) && t.length >= 2);
      const tokens = usefulTokens.length > 0 ? usefulTokens : allTokens;

      const whereClauses = tokens.map((_, i) =>
        "TRANSLATE(UPPER(PF.NM_PESSOA_FISICA), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') LIKE '%' || :t" + i + " || '%'"
      );

      binds = { limite: Math.min(50, Math.max(1, limit)) };
      tokens.forEach((t, i) => {
        binds['t' + i] = t;
      });

      sql = `SELECT PF.CD_PESSOA_FISICA,
                    PF.NM_PESSOA_FISICA,
                    PF.NR_CPF,
                    TO_CHAR(PF.DT_NASCIMENTO, 'YYYY-MM-DD') AS DT_NASCIMENTO,
                    PF.IE_SEXO,
                    PF.NR_IDENTIDADE,
                    PF.NR_DDD_CELULAR,
                    PF.NR_TELEFONE_CELULAR,
                    PF.DS_OBSERVACAO
               FROM TASY.PESSOA_FISICA PF
              WHERE ${whereClauses.join(' AND ')}
              ORDER BY PF.NM_PESSOA_FISICA ASC
              FETCH FIRST :limite ROWS ONLY`;
    }

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

async function buscarPessoasPorCpf(cpfRaw) {
  return buscarPessoasInteligente(cpfRaw, 10);
}

async function buscarPessoasPorNome(nomeRaw, limit = 30) {
  return buscarPessoasInteligente(nomeRaw, limit);
}

async function obterPessoaPorCodigo(cdPessoaFisica) {
  if (!cdPessoaFisica) return null;

  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT PF.CD_PESSOA_FISICA,
              PF.NM_PESSOA_FISICA,
              PF.NR_CPF,
              TO_CHAR(PF.DT_NASCIMENTO, 'YYYY-MM-DD') AS DT_NASCIMENTO,
              PF.IE_SEXO,
              PF.NR_IDENTIDADE,
              PF.NR_DDD_CELULAR,
              PF.NR_TELEFONE_CELULAR,
              PF.DS_OBSERVACAO
         FROM TASY.PESSOA_FISICA PF
        WHERE PF.CD_PESSOA_FISICA = :cdPessoaFisica
        FETCH FIRST 1 ROW ONLY`,
      { cdPessoaFisica: String(cdPessoaFisica) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows?.[0] || null;
  } finally {
    await conn.close();
  }
}

async function cadastrarPessoaFisica(dados, usuarioLogado) {
  const conn = await getConnection();
  try {
    const nome = String(dados.nm_pessoa_fisica || '').trim();
    const cpf = normalizeCpf(dados.nr_cpf) || null;
    const dataNascimento = dados.dt_nascimento ? new Date(dados.dt_nascimento) : null;
    const sexo = dados.ie_sexo ? String(dados.ie_sexo).toUpperCase().slice(0, 1) : null;
    const { ddd, telefone, celNumeros } = parseTelefoneBR(dados.nr_telefone_celular);
    const identidade = dados.nr_identidade ? String(dados.nr_identidade).trim().slice(0, 15) : null;
    const observacao = dados.ds_observacao ? String(dados.ds_observacao).trim().slice(0, 2000) : 'Cadastro realizado pelo Conecta Assistencial';
    const nmUsuario = String(usuarioLogado || 'conecta').slice(0, 15);

    const result = await conn.execute(
      `INSERT INTO TASY.PESSOA_FISICA (
        CD_PESSOA_FISICA,
        IE_TIPO_PESSOA,
        NM_PESSOA_FISICA,
        DT_ATUALIZACAO,
        NM_USUARIO,
        DT_NASCIMENTO,
        IE_SEXO,
        NR_CPF,
        NR_IDENTIDADE,
        NR_DDD_CELULAR,
        NR_TELEFONE_CELULAR,
        NR_CELULAR_NUMEROS,
        DS_OBSERVACAO
      ) VALUES (
        TO_CHAR(TASY.PESSOA_FISICA_SEQ.NEXTVAL),
        1,
        :nome,
        SYSDATE,
        :nmUsuario,
        :dataNascimento,
        :sexo,
        :cpf,
        :identidade,
        :ddd,
        :telefone,
        :celNumeros,
        :observacao
      ) RETURNING CD_PESSOA_FISICA INTO :cdPessoaFisicaOut`,
      {
        nome,
        nmUsuario,
        dataNascimento,
        sexo,
        cpf,
        identidade,
        ddd,
        telefone,
        celNumeros,
        observacao,
        cdPessoaFisicaOut: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
      },
      { autoCommit: false }
    );

    const outVal = result.outBinds?.cdPessoaFisicaOut;
    const cdGerado = Array.isArray(outVal) ? outVal[0] : outVal;
    if (!cdGerado) {
      throw new Error('Falha ao obter o código da pessoa física cadastrada.');
    }

    await conn.commit();
    return obterPessoaPorCodigo(cdGerado);
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

async function atualizarPessoaFisica(cdPessoaFisica, dados, usuarioLogado) {
  if (!cdPessoaFisica) throw new Error('Código da pessoa física não informado.');

  const conn = await getConnection();
  try {
    const nome = String(dados.nm_pessoa_fisica || '').trim();
    const cpf = dados.nr_cpf ? normalizeCpf(dados.nr_cpf) : null;
    const dataNascimento = dados.dt_nascimento ? String(dados.dt_nascimento).slice(0, 10) : null;
    const sexo = dados.ie_sexo ? String(dados.ie_sexo).toUpperCase().slice(0, 1) : null;
    const { ddd, telefone, celNumeros } = parseTelefoneBR(dados.nr_telefone_celular);
    const nmUsuario = String(usuarioLogado || 'conecta').slice(0, 15);

    await conn.execute(
      `UPDATE TASY.PESSOA_FISICA
          SET NM_PESSOA_FISICA = :nome,
              NR_CPF = :cpf,
              DT_NASCIMENTO = CASE WHEN :dataNascimento IS NOT NULL THEN TO_DATE(:dataNascimento, 'YYYY-MM-DD') ELSE NULL END,
              IE_SEXO = :sexo,
              NR_DDD_CELULAR = :ddd,
              NR_TELEFONE_CELULAR = :telefone,
              NR_CELULAR_NUMEROS = :celNumeros,
              DT_ATUALIZACAO = SYSDATE,
              NM_USUARIO = :nmUsuario
        WHERE CD_PESSOA_FISICA = :cdPessoaFisica`,
      {
        nome,
        cpf,
        dataNascimento,
        sexo,
        ddd,
        telefone,
        celNumeros,
        nmUsuario,
        cdPessoaFisica: String(cdPessoaFisica)
      },
      { autoCommit: true }
    );

    return obterPessoaPorCodigo(cdPessoaFisica);
  } finally {
    await conn.close();
  }
}

async function inserirPessoaFisicaHistorico(dados, usuarioLogado) {
  const conn = await getConnection();
  try {
    const cdPessoaFisica = String(dados.cd_pessoa_fisica);
    const nrSeqTipoHist = Number(dados.nr_seq_tipo_hist || 1);
    const dsHistorico = String(dados.ds_historico || '').trim();
    const nmUsuario = String(usuarioLogado || 'conecta').slice(0, 15);
    const dtRegistro = dados.dt_registro ? new Date(dados.dt_registro) : new Date();

    const result = await conn.execute(
      `INSERT INTO TASY.PESSOA_FISICA_HISTORICO (
        NR_SEQUENCIA,
        DT_ATUALIZACAO,
        NM_USUARIO,
        DT_ATUALIZACAO_NREC,
        NM_USUARIO_NREC,
        CD_PESSOA_FISICA,
        NM_PESSOA_FISICA,
        NR_SEQ_TIPO_HIST,
        DT_LIBERACAO,
        DS_HISTORICO,
        DT_INICIAL,
        DT_FINAL,
        DT_CANCELAMENTO,
        DS_OBS_CANCELAMENTO,
        CD_ESTABELECIMENTO
      ) VALUES (
        TASY.PESSOA_FISICA_HISTORICO_SEQ.NEXTVAL,
        SYSDATE,
        :nmUsuario,
        SYSDATE,
        :nmUsuario,
        :cdPessoaFisica,
        NULL,
        :nrSeqTipoHist,
        SYSDATE,
        :dsHistorico,
        :dtRegistro,
        SYSDATE,
        NULL,
        NULL,
        1
      ) RETURNING NR_SEQUENCIA INTO :nrSequenciaOut`,
      {
        nmUsuario,
        cdPessoaFisica,
        nrSeqTipoHist,
        dsHistorico,
        dtRegistro,
        nrSequenciaOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: false }
    );

    const outVal = result.outBinds?.nrSequenciaOut;
    const nrSequencia = Array.isArray(outVal) ? outVal[0] : outVal;

    await conn.commit();
    return {
      nr_sequencia: nrSequencia,
      cd_pessoa_fisica: cdPessoaFisica,
      nr_seq_tipo_hist: nrSeqTipoHist,
      nm_usuario: nmUsuario,
      dt_registro: dtRegistro
    };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

async function listarHistoricoPorPessoa(cdPessoaFisica, limit = 20) {
  if (!cdPessoaFisica) return [];

  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT H.NR_SEQUENCIA,
              TO_CHAR(H.DT_ATUALIZACAO, 'YYYY-MM-DD HH24:MI:SS') AS DT_ATUALIZACAO,
              H.NM_USUARIO,
              H.CD_PESSOA_FISICA,
              H.NR_SEQ_TIPO_HIST,
              T.DS_TIPO_HISTORICO,
              TO_CHAR(H.DT_INICIAL, 'YYYY-MM-DD') AS DT_INICIAL,
              H.DS_HISTORICO
         FROM TASY.PESSOA_FISICA_HISTORICO H
         LEFT JOIN TASY.TIPO_HIST_PESSOA_FISICA T ON T.NR_SEQUENCIA = H.NR_SEQ_TIPO_HIST
        WHERE H.CD_PESSOA_FISICA = :cdPessoaFisica
          AND H.DT_CANCELAMENTO IS NULL
        ORDER BY H.NR_SEQUENCIA DESC
        FETCH FIRST :limite ROWS ONLY`,
      { cdPessoaFisica: String(cdPessoaFisica), limite: limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  } finally {
    await conn.close();
  }
}

module.exports = {
  normalizeCpf,
  buscarPessoasInteligente,
  buscarPessoasPorCpf,
  buscarPessoasPorNome,
  obterPessoaPorCodigo,
  cadastrarPessoaFisica,
  atualizarPessoaFisica,
  inserirPessoaFisicaHistorico,
  listarHistoricoPorPessoa
};
