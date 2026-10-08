const db = require('../../../core/database/index.js');
const oracledb = require('oracledb');

async function buscarPessoas(termo) {
  const conn = await db.getConnection();
  try {
    const t = termo.trim();
    
    // 1. Check if CPF
    const rawDigits = t.replace(/\D/g, '');
    const isCpf = rawDigits.length === 11 && (t.length === 11 || /^\d{3}\.\d{3}\.\d{3}\-\d{2}$/.test(t));
    
    // 2. Check if Date
    let isDate = false;
    let dateStr = null;
    const dateRegex1 = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/;
    const dateRegex2 = /^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/;
    
    if (dateRegex1.test(t)) {
      const parts = t.match(dateRegex1);
      if (parseInt(parts[1]) <= 31 && parseInt(parts[2]) <= 12) {
        isDate = true;
        dateStr = `${parts[1]}/${parts[2]}/${parts[3]}`;
      }
    } else if (dateRegex2.test(t)) {
      const parts = t.match(dateRegex2);
      if (parseInt(parts[3]) <= 31 && parseInt(parts[2]) <= 12) {
        isDate = true;
        dateStr = `${parts[3]}/${parts[2]}/${parts[1]}`;
      }
    }
    
    // 3. Fallback to CD_PESSOA_FISICA if just digits
    const isId = /^\d+$/.test(t) && !isCpf && !isDate;

    let query = `
      SELECT cd_pessoa_fisica, nm_pessoa_fisica, dt_nascimento, nr_cpf,
             nm_sobrenome_mae AS nm_mae
      FROM pessoa_fisica
      WHERE 1=1
    `;
    let params = {};

    const accentChars = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
    const plainChars = 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';

    if (isCpf) {
      query += ` AND (nr_cpf = :t OR REPLACE(REPLACE(nr_cpf, '.', ''), '-', '') = :t_raw) `;
      params.t = t;
      params.t_raw = rawDigits;
    } else if (isDate) {
      query += ` AND dt_nascimento = TO_DATE(:t, 'DD/MM/YYYY') `;
      params.t = dateStr;
    } else if (isId) {
      query += ` AND cd_pessoa_fisica = :t `;
      params.t = parseInt(t, 10);
    } else {
      // Intelligent Name Search
      const tokens = t.split(/\s+/).filter(tok => tok.length > 0);
      if (tokens.length > 0) {
        const jsTranslate = (s) => {
            let res = "";
            for (let c of s) {
                let idx = accentChars.indexOf(c);
                res += idx !== -1 ? plainChars[idx] : c;
            }
            return res.toUpperCase();
        };

        tokens.forEach((tok, i) => {
          const pName = `t_${i}`;
          params[pName] = jsTranslate(tok);
          const sqlField = `TRANSLATE(UPPER(nm_pessoa_fisica), '${accentChars}', '${plainChars}')`;
          
          // Cada palavra informada deve existir em algum ponto do nome. Isso permite
          // pesquisar "pedro cesario" mesmo quando há nomes intermediários.
          query += ` AND ${sqlField} LIKE '%' || :${pName} || '%'`;
        });
      }
    }

    // Default to 50 results
    query += ` AND rownum <= 50 `;

    const res = await conn.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    // Sort logic (Exact match > Starts with > everything else)
    let rows = res.rows;
    if (!isCpf && !isDate && !isId) {
      const cleanTerm = t.trim().toUpperCase();
      rows.sort((a, b) => {
        const aName = (a.NM_PESSOA_FISICA || '').toUpperCase();
        const bName = (b.NM_PESSOA_FISICA || '').toUpperCase();
        
        if (aName === cleanTerm && bName !== cleanTerm) return -1;
        if (bName === cleanTerm && aName !== cleanTerm) return 1;
        
        if (aName.startsWith(cleanTerm) && !bName.startsWith(cleanTerm)) return -1;
        if (bName.startsWith(cleanTerm) && !aName.startsWith(cleanTerm)) return 1;
        
        return 0;
      });
    }

    return rows.map(r => ({
      cd_pessoa_fisica: r.CD_PESSOA_FISICA,
      nm_pessoa_fisica: r.NM_PESSOA_FISICA,
      dt_nascimento: r.DT_NASCIMENTO,
      nr_cpf: r.NR_CPF,
      nm_mae: r.NM_MAE
    }));
  } finally {
    if (conn) await conn.close();
  }
}

async function obterPessoaCompleta(cdPessoaFisica) {
  const conn = await db.getConnection();
  try {
    const query = `
      SELECT cd_pessoa_fisica, nm_pessoa_fisica, nm_sobrenome_mae AS nm_mae,
             dt_nascimento, nr_cpf, ie_sexo,
             ds_telefone_celular, ds_telefone_contato, ds_email,
             ds_endereco, nr_endereco, ds_complemento, ds_bairro, 
             nm_cidade, sg_estado, nr_cep
      FROM pessoa_fisica
      WHERE cd_pessoa_fisica = :cd
    `;
    const res = await conn.execute(query, { cd: parseInt(cdPessoaFisica, 10) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.rows.length > 0 ? res.rows[0] : null;
  } finally {
    if (conn) await conn.close();
  }
}

async function salvarPessoaFisica(dados, nmUsuario) {
  const conn = await db.getConnection();
  try {
    let { 
      nm_pessoa_fisica, 
      dt_nascimento, 
      nr_cpf, 
      ie_sexo,
      nm_mae 
    } = dados;

    const outBinds = {
      cd: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const sql = `
      BEGIN
        INSERT INTO pessoa_fisica (
          cd_pessoa_fisica, 
          nm_pessoa_fisica, 
          nm_sobrenome_mae,
          dt_nascimento, 
          nr_cpf, 
          ie_sexo,
          dt_atualizacao,
          nm_usuario,
          dt_atualizacao_nrec,
          nm_usuario_nrec,
          ie_situacao
        ) VALUES (
          pessoa_fisica_seq.NEXTVAL,
          :nome,
          :mae,
          :nasc,
          :cpf,
          :sexo,
          SYSDATE,
          :usu,
          SYSDATE,
          :usu,
          'A'
        ) RETURNING cd_pessoa_fisica INTO :cd;
      END;
    `;

    // Normalizar cpf se enviado
    if (nr_cpf) {
      nr_cpf = nr_cpf.replace(/\D/g, '');
    }

    const binds = {
      nome: nm_pessoa_fisica.substring(0, 255),
      mae: nm_mae ? nm_mae.substring(0, 255) : null,
      nasc: dt_nascimento ? new Date(dt_nascimento) : null,
      cpf: nr_cpf || null,
      sexo: ie_sexo || null,
      usu: nmUsuario.substring(0, 50),
      ...outBinds
    };

    const res = await conn.execute(sql, binds, { autoCommit: true });
    return res.outBinds.cd;
  } finally {
    if (conn) await conn.close();
  }
}

async function verificarDuplicidadePaciente({ nm_pessoa_fisica, dt_nascimento, nr_cpf }) {
  const conn = await db.getConnection();
  try {
    let query = `
      SELECT cd_pessoa_fisica, nm_pessoa_fisica, nr_cpf, dt_nascimento 
      FROM pessoa_fisica 
      WHERE 1=0
    `;
    const params = {};

    if (nr_cpf) {
      const cpfClean = nr_cpf.replace(/\D/g, '');
      query += ` OR nr_cpf = :cpf OR REPLACE(REPLACE(nr_cpf, '.', ''), '-', '') = :cpf_clean`;
      params.cpf = nr_cpf;
      params.cpf_clean = cpfClean;
    }

    if (dt_nascimento && nm_pessoa_fisica) {
      query += ` OR (dt_nascimento = TO_DATE(:nasc, 'YYYY-MM-DD') AND UPPER(nm_pessoa_fisica) = UPPER(:nome))`;
      params.nasc = dt_nascimento.substring(0, 10);
      params.nome = nm_pessoa_fisica;
    }

    const res = await conn.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.rows.map(r => ({
      cd_pessoa_fisica: r.CD_PESSOA_FISICA,
      nm_pessoa_fisica: r.NM_PESSOA_FISICA,
      nr_cpf: r.NR_CPF,
      dt_nascimento: r.DT_NASCIMENTO
    }));
  } finally {
    if (conn) await conn.close();
  }
}

async function atribuirClassificacaoPessoa({ cdPessoaFisica, nrSeqClassif, cdEstabelecimento, nmUsuario }) {
  const conn = await db.getConnection();
  try {
    await conn.execute(
      `INSERT INTO pessoa_classif (
         nr_sequencia, 
         cd_pessoa_fisica, 
         nr_seq_classif,
         dt_atualizacao,
         nm_usuario,
         dt_atualizacao_nrec,
         nm_usuario_nrec,
         cd_estabelecimento
       ) VALUES (
         PESSOA_CLASSIF_SEQ.NEXTVAL,
         :pf,
         :classif,
         SYSDATE,
         :usu,
         SYSDATE,
         :usu,
         :estab
       )`,
      {
        pf: cdPessoaFisica,
        classif: nrSeqClassif,
        usu: String(nmUsuario).substring(0, 50),
        estab: cdEstabelecimento
      },
      { autoCommit: true }
    );
    return true;
  } catch (err) {
    if (err.errorNum === 1 || err.code === 'ORA-00001') {
      // Ignorar duplicidade
      return true;
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = {
  buscarPessoas,
  obterPessoaCompleta,
  salvarPessoaFisica,
  verificarDuplicidadePaciente,
  atribuirClassificacaoPessoa
};
