const { getConnection } = require('../database');
const oracledb = require('oracledb');
const { getSetorReferenciaFixo, getCdPerfilByModulo } = require('../config/especialidades');

function getCdPerfilForInsert(usuario, cdModulo) {
  return getCdPerfilByModulo(cdModulo, usuario.cd_perfis);
}

function sanitizeTexto(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitPacienteTexto(textoRaw) {
  const texto = sanitizeTexto(textoRaw);
  if (!texto) {
    return { textoCheckbox: '', textoIntercorrencia: '' };
  }

  const linhas = texto
    .split(/\r?\n/)
    .map(linha => linha.trim())
    .filter(Boolean);

  const checkboxLines = [];
  const narrativaLines = [];

  linhas.forEach(linha => {
    if (/:\s*sim$/i.test(linha)) {
      checkboxLines.push(linha);
      return;
    }
    narrativaLines.push(linha);
  });

  return {
    textoCheckbox: checkboxLines.join('\n'),
    textoIntercorrencia: narrativaLines.join('\n')
  };
}

function buildSetorEntries(setorIntercorrencias, binds) {
  const selects = [];

  for (const [cdSetorRaw, textoRaw] of Object.entries(setorIntercorrencias || {})) {
    const texto = sanitizeTexto(textoRaw);
    if (!texto) continue;

    const cdSetor = Number(cdSetorRaw);
    if (!Number.isInteger(cdSetor)) {
      throw Object.assign(new Error('Setor inválido informado na requisição'), { status: 400 });
    }

    const bindCd = `setor_cd_${cdSetor}`;
    const bindTexto = `setor_occ_${cdSetor}`;

    binds[bindCd] = cdSetor;
    binds[bindTexto] = texto;

    selects.push(`
    SELECT
      TO_CHAR(:${bindCd}) AS cd_setor_linha,
      0 AS ordem_item,
      'Setor: ' || obter_desc_setor_atend(:${bindCd}) || CHR(10) ||
      'Passagem de plantão: ' || :${bindTexto} || CHR(10) || CHR(10) AS texto_linha
    FROM dual`);
  }

  return selects;
}

function buildPacienteEntries(intercorrencias, setoresNumericos, binds) {
  const selects = [];

  for (const [atendimentoRaw, textoRaw] of Object.entries(intercorrencias || {})) {
    const { textoCheckbox, textoIntercorrencia } = splitPacienteTexto(textoRaw);
    if (!textoCheckbox && !textoIntercorrencia) continue;

    const atendimento = Number(atendimentoRaw);
    if (!Number.isInteger(atendimento)) {
      throw Object.assign(new Error('Atendimento inválido informado na requisição'), { status: 400 });
    }

    const bindCheckbox = `occ_chk_${atendimento}`;
    const bindTexto = `occ_txt_${atendimento}`;
    binds[bindCheckbox] = textoCheckbox || null;
    binds[bindTexto] = textoIntercorrencia || null;

    const atendBind = `atend_${atendimento}`;
    binds[atendBind] = atendimento;

    const setorPlaceholders = setoresNumericos.map((s, i) => {
      const key = `setor_in_${atendimento}_${i}`;
      binds[key] = s;
      return `:${key}`;
    }).join(', ');

    const fallbackSetor = setoresNumericos[0] || 1;
    const fallbackBind = `setor_fb_${atendimento}`;
    binds[fallbackBind] = fallbackSetor;

    selects.push(`
    SELECT
      COALESCE((SELECT TO_CHAR(MAX(cd_setor_atendimento)) FROM atendimento_paciente_v WHERE nr_atendimento = :${atendBind} AND cd_setor_atendimento IN (${setorPlaceholders})), TO_CHAR(:${fallbackBind})) AS cd_setor_linha,
      :${atendBind} AS ordem_item,
      'Setor: ' || NVL(obter_desc_setor_atend(COALESCE((SELECT MAX(cd_setor_atendimento) FROM atendimento_paciente_v WHERE nr_atendimento = :${atendBind} AND cd_setor_atendimento IN (${setorPlaceholders})), :${fallbackBind})), obter_desc_setor_atend(:${fallbackBind})) || CHR(10) ||
      'Paciente: ' || NVL(obter_nome_paciente(:${atendBind}), 'Atendimento ' || :${atendBind}) ||
      ' (Atendimento: ' || :${atendBind} || ')' || CHR(10) ||
      CASE WHEN :${bindCheckbox} IS NOT NULL THEN :${bindCheckbox} || CHR(10) ELSE '' END ||
      CASE WHEN :${bindTexto} IS NOT NULL THEN 'Intercorrência: ' || :${bindTexto} || CHR(10) ELSE '' END ||
      CHR(10) AS texto_linha
    FROM dual`);
  }

  return selects;
}

async function salvarPassagem(dados, usuario) {
  const {
    nr_seq_turno,
    setoresSelecionados,
    cd_modulo,
    intercorrencias = {},
    setorIntercorrencias = {}
  } = dados;

  if (!nr_seq_turno || ![1, 2, 3, 4, 5].includes(nr_seq_turno)) {
    throw Object.assign(new Error('Turno inválido'), { status: 400 });
  }
  if (!Array.isArray(setoresSelecionados) || setoresSelecionados.length === 0) {
    throw Object.assign(new Error('Nenhum setor selecionado'), { status: 400 });
  }
  if (!cd_modulo || ![1, 4].includes(Number(cd_modulo))) {
    throw Object.assign(new Error('Módulo inválido'), { status: 400 });
  }

  const setoresNumericos = setoresSelecionados.map(Number);
  if (setoresNumericos.some(cd => !Number.isInteger(cd))) {
    throw Object.assign(new Error('Setor inválido informado na requisição'), { status: 400 });
  }

  let connection;
  try {
    connection = await getConnection();

    const cdPerfil = getCdPerfilForInsert(usuario, cd_modulo);
    if (!cdPerfil) {
      throw Object.assign(new Error('Perfil não encontrado para este módulo'), { status: 400 });
    }

    const binds = {
      nm_usuario_logado: usuario.nm_usuario,
      nr_seq_turno,
      setor_referencia: getSetorReferenciaFixo(setoresNumericos),
      cd_perfil: cdPerfil
    };

    const setorSelects = buildSetorEntries(setorIntercorrencias, binds);
    const pacienteSelects = buildPacienteEntries(intercorrencias, setoresNumericos, binds);
    const selects = [...setorSelects, ...pacienteSelects];

    if (selects.length === 0) {
      throw Object.assign(new Error('Nenhuma intercorrência para salvar'), { status: 400 });
    }

    const sql = `
  INSERT INTO OCORRENCIA (
    nr_ocorrencia,
    dt_ocorrencia,
    ie_tipo_ocorrencia,
    dt_atualizacao,
    nm_usuario,
    cd_pessoa_fisica,
    ds_ocorrencia,
    cd_setor_atendimento,
    dt_liberacao,
    cd_estabelecimento,
    cd_perfil,
    nr_seq_turno
  )
  SELECT
    OCORRENCIA_SEQ.nextval,
    agregado.dt_ocorrencia,
    agregado.ie_tipo_ocorrencia,
    agregado.dt_atualizacao,
    agregado.nm_usuario,
    agregado.cd_pessoa_fisica,
    agregado.ds_ocorrencia,
    agregado.cd_setor_referencia,
    agregado.dt_liberacao,
    agregado.cd_estabelecimento,
    agregado.cd_perfil,
    agregado.nr_seq_turno
  FROM (
    SELECT
      SYSDATE AS dt_ocorrencia,
      '1' AS ie_tipo_ocorrencia,
      SYSDATE AS dt_atualizacao,
      u.nm_usuario,
      u.cd_pessoa_fisica,
      LISTAGG(src.texto_linha, '') WITHIN GROUP (ORDER BY src.cd_setor_linha, src.ordem_item) AS ds_ocorrencia,
      COALESCE(TO_CHAR(:setor_referencia), MIN(src.cd_setor_linha)) AS cd_setor_referencia,
      SYSDATE AS dt_liberacao,
      1 AS cd_estabelecimento,
      :cd_perfil AS cd_perfil,
      :nr_seq_turno AS nr_seq_turno
    FROM usuario u
    JOIN (
${selects.join('\n    UNION ALL')}
    ) src ON 1 = 1
    WHERE UPPER(u.nm_usuario) = UPPER(:nm_usuario_logado)
      AND u.ie_situacao = 'A'
    GROUP BY u.nm_usuario, u.cd_pessoa_fisica
  ) agregado`;

    try {
      const result = await connection.execute(sql, binds, { autoCommit: false });
      if (result.rowsAffected === 0) {
        throw Object.assign(new Error('Falha ao gravar: usuário não encontrado/ativo ou não há pacientes a serem salvos'), { status: 400 });
      }
      if (result.rowsAffected > 1) {
        throw Object.assign(new Error('Falha ao gravar: múltiplos registros encontrados para o usuário'), { status: 400 });
      }
      await connection.commit();
    } catch (dbErr) {
      try { await connection.rollback(); } catch (_) {}
      console.error('[Passagem] Erro no insert Oracle:', dbErr);
      if (dbErr.status) throw dbErr;
      throw new Error('Falha no banco TASY ao gravar a passagem: ' + dbErr.message);
    }

    return { inseridos: 1, itens_registrados: selects.length };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return text;
}

function normalizeHour(value, fallback) {
  const text = sanitizeTexto(value);
  if (!text) return fallback;
  if (!/^\d{2}:\d{2}$/.test(text)) return fallback;
  return text;
}

function formatDatePtBr(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatWeekdayPtBr(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const dt = new Date(year, month - 1, day, 12, 0, 0);
  const raw = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(dt);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtmlLines(text) {
  const normalized = sanitizeTexto(text);
  if (!normalized) return '-';
  return escapeHtml(normalized).replace(/\r?\n/g, '<br>');
}

function buildLivroAdministrativoHtml(payload) {
  return `
<div style="font-family: Arial; font-size: 13px; line-height: 1.35; width: 780px; margin-left: 20px; color: #111;">
  <div style="border: 1px solid #888; padding: 10px 12px; margin-bottom: 10px;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px;">Livro Administrativo</h2>
    <p style="margin: 0;">
      <b>Plantao:</b> ${formatDatePtBr(payload.dataPlantao)} (${formatWeekdayPtBr(payload.dataPlantao)}) <span style="display:inline-block; width:14px;"></span>|<span style="display:inline-block; width:14px;"></span>
      <b>Horário:</b> ${escapeHtml(payload.horaInicio)}h às ${escapeHtml(payload.horaFim)}h
    </p>
  </div>

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">1. Liderança do Plantão</div>
    <div style="padding: 8px;">
      <p style="margin: 0 0 4px 0;"><b>Enfermeiros</b></p>
      <p style="margin: 0 0 8px 0;">${textToHtmlLines(payload.liderancaEnfermeiros)}</p>

      <p style="margin: 0 0 4px 0;"><b>Médicos / Horizontais</b></p>
      <p style="margin: 0;">${textToHtmlLines(payload.liderancaMedicos)}</p>
    </div>
  </div>

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">2. Escala Técnica de Enfermagem</div>
    <div style="padding: 8px;">
      <p style="margin: 0 0 8px 0;">${textToHtmlLines(payload.escalaH1H2)}</p>
      <p style="margin: 0 0 8px 0;">${textToHtmlLines(payload.escalaDemaisSetores)}</p>
      <p style="margin: 0;">${textToHtmlLines(payload.escalaFaltasFolgas)}</p>
    </div>
  </div>

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">3. Time de Resposta Rápida</div>
    <div style="padding: 8px;">
      <p style="margin: 0 0 8px 0;">${textToHtmlLines(payload.respostaRapidaFuncoes)}</p>
      <p style="margin: 0;">
        <b>Enfermeiros responsáveis:</b><br>
        ${textToHtmlLines(payload.respostaRapidaEnfermeiros)}
      </p>
    </div>
  </div>

  <div style="border: 1px solid #b5b5b5;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">4. Observações</div>
    <div style="padding: 8px;">
      <p style="margin: 0;">${textToHtmlLines(payload.observacoes)}</p>
    </div>
  </div>
</div>`.trim();
}

function normalizeLivroPayload(dados) {
  const dataPlantao = normalizeIsoDate(dados.data_plantao) || getTodayIsoDate();
  const horaInicio = normalizeHour(dados.hora_inicio, '07:00');
  const horaFim = normalizeHour(dados.hora_fim, '19:00');

  const payload = {
    dataPlantao,
    horaInicio,
    horaFim,
    liderancaEnfermeiros: dados.lideranca_enfermeiros || '',
    liderancaMedicos: dados.lideranca_medicos || '',
    escalaH1H2: dados.escala_h1_h2 || '',
    escalaDemaisSetores: dados.escala_demais_setores || '',
    escalaFaltasFolgas: dados.escala_faltas_folgas || '',
    respostaRapidaFuncoes: dados.resposta_rapida_funcoes || '',
    respostaRapidaEnfermeiros: dados.resposta_rapida_enfermeiros || '',
    observacoes: dados.observacoes || ''
  };

  const hasContent = [
    payload.liderancaEnfermeiros,
    payload.liderancaMedicos,
    payload.escalaH1H2,
    payload.escalaDemaisSetores,
    payload.escalaFaltasFolgas,
    payload.respostaRapidaFuncoes,
    payload.respostaRapidaEnfermeiros,
    payload.observacoes
  ].some(item => sanitizeTexto(item));

  if (!hasContent) {
    throw Object.assign(new Error('Preencha ao menos um campo do livro administrativo'), { status: 400 });
  }

  const cdSetorAtendimento = Number(dados.cd_setor_atendimento || 1);
  if (!Number.isInteger(cdSetorAtendimento)) {
    throw Object.assign(new Error('Setor inválido para livro administrativo'), { status: 400 });
  }

  const cdModulo = Number(dados.cd_modulo);
  if (!cdModulo || ![1, 4].includes(cdModulo)) {
    throw Object.assign(new Error('Módulo inválido para livro administrativo'), { status: 400 });
  }

  return { payload, cdSetorAtendimento, cd_modulo: cdModulo };
}

async function salvarLivroAdministrativo(dados, usuario) {
  const { payload, cdSetorAtendimento, cd_modulo } = normalizeLivroPayload(dados || {});
  const dsOcorrencia = buildLivroAdministrativoHtml(payload);

  const cdPerfil = getCdPerfilForInsert(usuario, cd_modulo);
  if (!cdPerfil) {
    throw Object.assign(new Error('Perfil não encontrado para este módulo'), { status: 400 });
  }

  let connection;
  try {
    connection = await getConnection();

    const sql = `
      INSERT INTO OCORRENCIA (
        nr_ocorrencia,
        dt_ocorrencia,
        ie_tipo_ocorrencia,
        dt_atualizacao,
        nm_usuario,
        cd_pessoa_fisica,
        ds_ocorrencia,
        cd_setor_atendimento,
        dt_liberacao,
        cd_estabelecimento,
        cd_perfil,
        nr_seq_turno
      )
      SELECT
        OCORRENCIA_SEQ.nextval,
        SYSDATE,
        'LA',
        SYSDATE,
        u.nm_usuario,
        u.cd_pessoa_fisica,
        :ds_ocorrencia,
        :cd_setor_atendimento,
        SYSDATE,
        1,
        :cd_perfil,
        NULL
      FROM usuario u
      WHERE UPPER(u.nm_usuario) = UPPER(:nm_usuario_logado)
        AND u.ie_situacao = 'A'`;

    const result = await connection.execute(
      sql,
      {
        nm_usuario_logado: usuario.nm_usuario,
        ds_ocorrencia: dsOcorrencia,
        cd_setor_atendimento: cdSetorAtendimento,
        cd_perfil: cdPerfil,
        data_plantao: payload.dataPlantao
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      throw Object.assign(new Error('Falha ao gravar: usuário logado não encontrado/ativo para livro administrativo'), { status: 400 });
    }
    if (result.rowsAffected > 1) {
      throw Object.assign(new Error('Falha ao gravar: múltiplos usuários encontrados para o livro administrativo'), { status: 400 });
    }

    return {
      inseridos: result.rowsAffected,
      tipo_ocorrencia: 'LA',
      data_plantao: payload.dataPlantao
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
}

async function obterLivroAdministrativo(dataInformada) {
  const dataPlantao = normalizeIsoDate(dataInformada) || getTodayIsoDate();

  let connection;
  try {
    connection = await getConnection();

    const sql = `
      SELECT * FROM (
        SELECT
          nr_ocorrencia,
          nm_usuario,
          TO_CHAR(dt_ocorrencia, 'YYYY-MM-DD HH24:MI:SS') AS dt_ocorrencia,
          ds_ocorrencia
        FROM ocorrencia
        WHERE ie_tipo_ocorrencia = 'LA'
          AND TRUNC(dt_liberacao) = TO_DATE(:data_plantao, 'YYYY-MM-DD')
        ORDER BY nr_ocorrencia DESC
      )
      WHERE ROWNUM = 1`;

    const result = await connection.execute(
      sql,
      { data_plantao: dataPlantao },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      nr_ocorrencia: row.NR_OCORRENCIA,
      nm_usuario: row.NM_USUARIO,
      dt_ocorrencia: row.DT_OCORRENCIA,
      ds_ocorrencia: row.DS_OCORRENCIA,
      data_plantao: dataPlantao
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
}

async function listarPassagensAnteriores(cdPerfil, setoresPermitidos = [], filtros = {}) {
  const setores = [...new Set((setoresPermitidos || []).map(Number).filter(Number.isInteger))];
  const binds = { cd_perfil: cdPerfil };
  let filtroSetores = '';
  
  // Se o usuário selecionou um setor específico no filtro, nós usamos ele (desde que ele tenha permissão)
  if (filtros.setor && !isNaN(Number(filtros.setor))) {
    const setorFiltro = Number(filtros.setor);
    if (setores.length === 0 || setores.includes(setorFiltro)) {
      binds.filtro_setor = setorFiltro;
      filtroSetores = `AND cd_setor_atendimento = :filtro_setor`;
    } else {
      // Se ele tentar filtrar um setor que não tem acesso
      return [];
    }
  } else if (setores.length > 0) {
    const placeholders = setores.map((setor, index) => {
      const key = `setor_${index}`;
      binds[key] = setor;
      return `:${key}`;
    });
    filtroSetores = `AND cd_setor_atendimento IN (${placeholders.join(', ')})`;
  }

  let filtroData = '';
  if (filtros.dtInicio) {
    binds.dt_inicio = filtros.dtInicio;
    filtroData += ` AND dt_liberacao >= TO_DATE(:dt_inicio, 'YYYY-MM-DD')`;
  }
  if (filtros.dtFim) {
    binds.dt_fim = filtros.dtFim;
    filtroData += ` AND dt_liberacao < TO_DATE(:dt_fim, 'YYYY-MM-DD') + 1`;
  }

  const temFiltro = filtros.setor || filtros.dtInicio || filtros.dtFim;
  // Se não tiver filtro: limita a 5. Se tiver filtro: traz até 200 para evitar travamento.
  const rowLimit = temFiltro ? 200 : 5;

  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT nr_ocorrencia,
              cd_setor_atendimento,
              obter_desc_setor_atend(cd_setor_atendimento) AS ds_setor,
              TO_CHAR(dt_liberacao, 'YYYY-MM-DD HH24:MI:SS') AS dt_lancamento,
              nm_usuario,
              ds_ocorrencia
       FROM ocorrencia
       WHERE ie_tipo_ocorrencia = '1'
         AND cd_perfil = :cd_perfil
         AND dt_liberacao IS NOT NULL
         AND NVL(ie_situacao, 'A') <> 'I'
         AND dt_inativacao IS NULL
         ${filtroSetores}
         ${filtroData}
       ORDER BY dt_liberacao DESC, nr_ocorrencia DESC
       FETCH FIRST ${rowLimit} ROWS ONLY`,
      binds,
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows || []).map(row => ({
      nr_ocorrencia: row.NR_OCORRENCIA,
      cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
      ds_setor: row.DS_SETOR,
      dt_lancamento: row.DT_LANCAMENTO,
      nm_usuario: row.NM_USUARIO,
      ds_ocorrencia: row.DS_OCORRENCIA || ''
    }));
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}

function normalizeEscalaTipo(value) {
  const text = sanitizeTexto(value).toLowerCase();
  if (text === 'falta') return 'Falta';
  if (text === 'folga') return 'Folga';
  return null;
}

const ESCALA_TURNO_CONFIG = {
  M: { label: 'Diurno', hora_inicio: '07:00', hora_fim: '19:00' },
  T: { label: 'Tarde', hora_inicio: '13:00', hora_fim: '19:00' },
  N: { label: 'Noturno', hora_inicio: '19:00', hora_fim: '07:00' }
};

function normalizeEscalaTurno(value) {
  const text = sanitizeTexto(value).toUpperCase();
  return ESCALA_TURNO_CONFIG[text] ? text : null;
}

function resolveEscalaTurnoAndHours(dados) {
  const turnoInformado = normalizeEscalaTurno(dados?.turno);
  if (turnoInformado) {
    const cfg = ESCALA_TURNO_CONFIG[turnoInformado];
    return {
      turno: turnoInformado,
      turnoLabel: cfg.label,
      horaInicio: cfg.hora_inicio,
      horaFim: cfg.hora_fim
    };
  }

  const horaInicio = normalizeHour(dados?.hora_inicio, ESCALA_TURNO_CONFIG.M.hora_inicio);
  const horaFim = normalizeHour(dados?.hora_fim, ESCALA_TURNO_CONFIG.M.hora_fim);
  const turnoInferido =
    horaInicio === ESCALA_TURNO_CONFIG.N.hora_inicio && horaFim === ESCALA_TURNO_CONFIG.N.hora_fim ? 'N' : 'M';
  const cfg = ESCALA_TURNO_CONFIG[turnoInferido];

  return {
    turno: turnoInferido,
    turnoLabel: cfg.label,
    horaInicio: cfg.hora_inicio,
    horaFim: cfg.hora_fim
  };
}

function normalizePatioCirculante(values) {
  const source = Array.isArray(values) ? values : [];
  const normalized = [];

  source.forEach(value => {
    const text = sanitizeTexto(value).toLowerCase();
    if (!text) return;

    if (text === 'patio' || text === 'p\u00e1tio') {
      normalized.push('Patio');
      return;
    }

    if (text === 'circulante') {
      normalized.push('Circulante');
    }
  });

  return [...new Set(normalized)];
}

function normalizeEscalaTecnicaPayload(dados) {
  const dataPlantao = normalizeIsoDate(dados?.data_plantao) || getTodayIsoDate();
  const { turno, turnoLabel, horaInicio, horaFim } = resolveEscalaTurnoAndHours(dados);

  const cdSetorAtendimento = Number(dados?.cd_setor_atendimento);
  if (!Number.isInteger(cdSetorAtendimento)) {
    throw Object.assign(new Error('Setor inválido para escala técnica'), { status: 400 });
  }

  const cdModulo = Number(dados?.cd_modulo);
  if (!cdModulo || ![1, 4].includes(cdModulo)) {
    throw Object.assign(new Error('Módulo inválido para escala técnica'), { status: 400 });
  }

  const enfermeiroCdPessoaFisica = Number(dados?.enfermeiro_cd_pessoa_fisica);
  if (!Number.isInteger(enfermeiroCdPessoaFisica)) {
    throw Object.assign(new Error('Enfermeiro responsável inválido para escala técnica'), { status: 400 });
  }

  const tecnicos = Array.isArray(dados?.tecnicos) ? dados.tecnicos : [];
  const tecnicosNormalizados = tecnicos
    .map(item => {
      const cdPessoaFisica = Number(item?.cd_pessoa_fisica);
      if (!Number.isInteger(cdPessoaFisica)) return null;

      const pacientes = Array.isArray(item?.pacientes)
        ? item.pacientes.map(Number).filter(Number.isInteger)
        : [];

      return {
        cd_pessoa_fisica: cdPessoaFisica,
        pacientes: [...new Set(pacientes)],
        patio_circulante: normalizePatioCirculante(item?.patio_circulante)
      };
    })
    .filter(Boolean);

  const faltasFolgas = Array.isArray(dados?.faltas_folgas) ? dados.faltas_folgas : [];
  const faltasNormalizadas = faltasFolgas
    .map(item => {
      const cdPessoaFisica = Number(item?.cd_pessoa_fisica);
      const tipo = normalizeEscalaTipo(item?.tipo);
      if (!Number.isInteger(cdPessoaFisica) || !tipo) return null;
      return { cd_pessoa_fisica: cdPessoaFisica, tipo };
    })
    .filter(Boolean);

  const avaliacaoExternaRaw = Array.isArray(dados?.avaliacao_externa) ? dados.avaliacao_externa : [];
  let avaliacaoExterna = [];

  if (
    avaliacaoExternaRaw.length > 0 &&
    typeof avaliacaoExternaRaw[0] === 'object' &&
    avaliacaoExternaRaw[0] !== null
  ) {
    avaliacaoExterna = avaliacaoExternaRaw
      .map(item => {
        const cdPessoaFisica = Number(item?.cd_pessoa_fisica);
        const pacientes = Array.isArray(item?.pacientes)
          ? [...new Set(item.pacientes.map(Number).filter(Number.isInteger))]
          : [];
        const descricao = sanitizeTexto(item?.descricao || '');

        return {
          cd_pessoa_fisica: Number.isInteger(cdPessoaFisica) ? cdPessoaFisica : null,
          pacientes,
          descricao
        };
      })
      .filter(item => Number.isInteger(item.cd_pessoa_fisica) && item.pacientes.length > 0);
  } else {
    const pacientes = [...new Set(avaliacaoExternaRaw.map(Number).filter(Number.isInteger))];
    if (pacientes.length > 0) {
      avaliacaoExterna = [
        {
          cd_pessoa_fisica: null,
          pacientes,
          descricao: ''
        }
      ];
    }
  }

  const ect = (dados.ect && typeof dados.ect === 'object') ? {
    pre_procedimento: Number.isInteger(Number(dados.ect.pre_procedimento)) ? Number(dados.ect.pre_procedimento) : null,
    sala_procedimento: Number.isInteger(Number(dados.ect.sala_procedimento)) ? Number(dados.ect.sala_procedimento) : null,
    sala_recuperacao: Number.isInteger(Number(dados.ect.sala_recuperacao)) ? Number(dados.ect.sala_recuperacao) : null
  } : null;

  const observacoes = sanitizeTexto(dados?.observacoes || '');
  const temPacientes = tecnicosNormalizados.some(item => item.pacientes.length > 0);
  const temPatioCirculante = tecnicosNormalizados.some(item => item.patio_circulante.length > 0);
  const temAvaliacaoExterna = avaliacaoExterna.some(item => item.pacientes.length > 0);
  const temEct = ect && (ect.pre_procedimento || ect.sala_procedimento || ect.sala_recuperacao);

  if (!temPacientes && !temPatioCirculante && faltasNormalizadas.length === 0 && !temAvaliacaoExterna && !temEct && !observacoes) {
    throw Object.assign(
      new Error('Preencha ao menos técnicos/pacientes, pátio/circulante, faltas/folgas, avaliação externa, equipe ECT ou observações'),
      { status: 400 }
    );
  }

  const pacienteVinculo = new Map();
  tecnicosNormalizados.forEach(item => {
    item.pacientes.forEach(atendimento => {
      if (pacienteVinculo.has(atendimento) && pacienteVinculo.get(atendimento) !== item.cd_pessoa_fisica) {
        throw Object.assign(new Error(`Paciente ${atendimento} vinculado a mais de um técnico`), { status: 400 });
      }
      pacienteVinculo.set(atendimento, item.cd_pessoa_fisica);
    });
  });

  return {
    dataPlantao,
    turno,
    turnoLabel,
    horaInicio,
    horaFim,
    cdSetorAtendimento,
    cd_modulo: cdModulo,
    enfermeiroCdPessoaFisica,
    ect,
    tecnicos: tecnicosNormalizados,
    faltas_folgas: faltasNormalizadas,
    avaliacao_externa: avaliacaoExterna,
    observacoes
  };
}

async function fetchTecnicosNomes(connection, tecnicoIds) {
  const ids = [...new Set((tecnicoIds || []).map(Number).filter(Number.isInteger))];
  if (ids.length === 0) return new Map();

  const binds = {};
  const placeholders = ids.map((id, index) => {
    const key = `tec_${index}`;
    binds[key] = id;
    return `:${key}`;
  });

  const sql = `
    SELECT cd_pessoa_fisica,
           nm_usuario,
           obter_nome_usuario(nm_usuario) AS nome
    FROM usuario
    WHERE cd_pessoa_fisica IN (${placeholders.join(',')})`;

  const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const map = new Map();
  (result.rows || []).forEach(row => {
    map.set(Number(row.CD_PESSOA_FISICA), row.NOME || row.NM_USUARIO);
  });

  return map;
}

async function fetchSetorNome(connection, cdSetorAtendimento) {
  const result = await connection.execute(
    `SELECT obter_desc_setor_atend(:cd_setor) AS ds_setor
     FROM dual`,
    { cd_setor: cdSetorAtendimento },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  const row = result.rows && result.rows[0];
  return row?.DS_SETOR || `Setor ${cdSetorAtendimento}`;
}

async function fetchPacientesNomes(connection, atendimentos, cdSetorAtendimento) {
  const ids = [...new Set((atendimentos || []).map(Number).filter(Number.isInteger))];
  if (ids.length === 0) return new Map();

  const binds = { cd_setor: cdSetorAtendimento };
  const placeholders = ids.map((id, index) => {
    const key = `atd_${index}`;
    binds[key] = id;
    return `:${key}`;
  });

  const sql = `
    SELECT nr_atendimento, obter_nome_paciente(nr_atendimento) AS nome
    FROM atendimento_paciente_v
    WHERE nr_atendimento IN (${placeholders.join(',')})
      AND cd_setor_atendimento = :cd_setor
      AND dt_alta IS NULL
      AND dt_saida_unidade IS NULL`;

  const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const map = new Map();
  (result.rows || []).forEach(row => {
    map.set(Number(row.NR_ATENDIMENTO), row.NOME);
  });
  return map;
}

function buildEscalaTecnicaHtml(payload, tecnicoNomeMap, pacienteNomeMap, contexto = {}) {
  const setorLabel = contexto.setorNome || `Setor ${payload.cdSetorAtendimento}`;
  const enfermeiroNome =
    tecnicoNomeMap.get(payload.enfermeiroCdPessoaFisica) ||
    `Enfermeiro ${payload.enfermeiroCdPessoaFisica}`;
  const turnoLabel = payload.turnoLabel || ESCALA_TURNO_CONFIG[payload.turno]?.label || '-';

  const tecnicosComPacientes = payload.tecnicos.filter(
    item => Array.isArray(item.pacientes) && item.pacientes.length > 0
  );

  const linhasTecnicos = tecnicosComPacientes
    .map(item => {
      const nomeTecnico = tecnicoNomeMap.get(item.cd_pessoa_fisica) || `Técnico ${item.cd_pessoa_fisica}`;
      const pacientesHtml = item.pacientes.length
        ? item.pacientes
            .map(atendimento => {
              const nomePaciente = pacienteNomeMap.get(atendimento) || `Paciente ${atendimento}`;
              return `<li>${escapeHtml(nomePaciente)} <span style="color:#666;">(Atendimento ${atendimento})</span></li>`;
            })
            .join('')
        : '<li>-</li>';

      return `
      <div style="border:1px solid #ddd; border-radius:6px; margin-bottom:8px; padding:8px;">
        <p style="margin:0 0 4px 0;"><b>${escapeHtml(nomeTecnico)}</b></p>
        <ul style="margin:0; padding-left:18px;">
          ${pacientesHtml}
        </ul>
      </div>`;
    })
    .join('');

  const patioNomes = [];
  const circulanteNomes = [];
  payload.tecnicos.forEach(item => {
    const extras = Array.isArray(item.patio_circulante) ? item.patio_circulante : [];
    const nomeTecnico = tecnicoNomeMap.get(item.cd_pessoa_fisica) || `Técnico ${item.cd_pessoa_fisica}`;
    if (extras.includes('Patio')) {
      patioNomes.push(nomeTecnico);
    }
    if (extras.includes('Circulante')) {
      circulanteNomes.push(nomeTecnico);
    }
  });

  const patioTexto = [...new Set(patioNomes)].map(nome => escapeHtml(nome)).join(', ') || '-';
  const circulanteTexto = [...new Set(circulanteNomes)].map(nome => escapeHtml(nome)).join(', ') || '-';

  const linhasFaltas = payload.faltas_folgas
    .map(item => {
      const nomeTecnico = tecnicoNomeMap.get(item.cd_pessoa_fisica) || `Técnico ${item.cd_pessoa_fisica}`;
      return `<li>${escapeHtml(nomeTecnico)} - ${escapeHtml(item.tipo)}</li>`;
    })
    .join('');

  const linhasAvaliacaoExterna = payload.avaliacao_externa
    .map(item => {
      const nomeTecnico = Number.isInteger(item.cd_pessoa_fisica)
        ? tecnicoNomeMap.get(item.cd_pessoa_fisica) || `Técnico ${item.cd_pessoa_fisica}`
        : 'Técnico não informado';

      const pacientesHtml = item.pacientes
        .map(atendimento => {
          const nomePaciente = pacienteNomeMap.get(atendimento) || `Paciente ${atendimento}`;
          return `<li>${escapeHtml(nomePaciente)} <span style="color:#666;">(Atendimento ${atendimento})</span></li>`;
        })
        .join('');
      const descricaoHtml = sanitizeTexto(item.descricao || '');

      return `
      <div style="border:1px solid #ddd; border-radius:6px; margin-bottom:8px; padding:8px;">
        <p style="margin:0 0 4px 0;"><b>${escapeHtml(nomeTecnico)}</b></p>
        <ul style="margin:0; padding-left:18px;">
          ${pacientesHtml || '<li>-</li>'}
        </ul>
        ${descricaoHtml ? `<p style="margin:6px 0 0 0;"><b>Descrição da saída:</b> ${textToHtmlLines(descricaoHtml)}</p>` : ''}
      </div>`;
    })
    .join('');

  const dadosSerializados = Buffer.from(
    JSON.stringify({
      data_plantao: payload.dataPlantao,
      turno: payload.turno,
      hora_inicio: payload.horaInicio,
      hora_fim: payload.horaFim,
      cd_setor_atendimento: payload.cdSetorAtendimento,
      enfermeiro_cd_pessoa_fisica: payload.enfermeiroCdPessoaFisica,
      ect: payload.ect,
      tecnicos: payload.tecnicos,
      faltas_folgas: payload.faltas_folgas,
      avaliacao_externa: payload.avaliacao_externa,
      observacoes: payload.observacoes
    }),
    'utf8'
  ).toString('base64');

  let secoesEquipeHtml = '';
  if (payload.ect) {
    const nomePre = payload.ect.pre_procedimento ? (tecnicoNomeMap.get(payload.ect.pre_procedimento) || `Profissional ${payload.ect.pre_procedimento}`) : '-';
    const nomeSala = payload.ect.sala_procedimento ? (tecnicoNomeMap.get(payload.ect.sala_procedimento) || `Profissional ${payload.ect.sala_procedimento}`) : '-';
    const nomeRec = payload.ect.sala_recuperacao ? (tecnicoNomeMap.get(payload.ect.sala_recuperacao) || `Profissional ${payload.ect.sala_recuperacao}`) : '-';

    secoesEquipeHtml = `
  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">2. Equipe ECT</div>
    <div style="padding: 8px;">
      <div style="border:1px solid #ddd; border-radius:6px; margin-bottom:8px; padding:8px;">
        <p style="margin:0 0 4px 0;"><b>Pré-Procedimento:</b> ${escapeHtml(nomePre)}</p>
        <p style="margin:0 0 4px 0;"><b>Sala de Procedimento:</b> ${escapeHtml(nomeSala)}</p>
        <p style="margin:0;"><b>Sala de Recuperação:</b> ${escapeHtml(nomeRec)}</p>
      </div>
    </div>
  </div>`;
  } else {
    secoesEquipeHtml = `
  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">2. Técnicos do Plantão</div>
    <div style="padding: 8px;">
      ${linhasTecnicos || '<p style="margin:0;">-</p>'}
    </div>
  </div>`;
  }

  return `
<!--ET_JSON:${dadosSerializados}-->
<div style="font-family: Arial; font-size: 13px; line-height: 1.35; width: 100%; max-width: 980px; margin: 0 auto; color: #111; box-sizing: border-box;">
  <div style="border: 1px solid #888; padding: 10px 12px; margin-bottom: 10px; box-sizing: border-box;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px; text-align: center;">Escala Assistencial</h2>
    <p style="margin: 0;">
      <b>Setor:</b> ${escapeHtml(setorLabel)} <span style="display:inline-block; width:14px;"></span>|<span style="display:inline-block; width:14px;"></span>
      <b>Plantão:</b> ${formatDatePtBr(payload.dataPlantao)} (${formatWeekdayPtBr(payload.dataPlantao)}) <span style="display:inline-block; width:14px;"></span>|<span style="display:inline-block; width:14px;"></span>
      <b>Turno:</b> ${escapeHtml(turnoLabel)} (${escapeHtml(payload.horaInicio)}h às ${escapeHtml(payload.horaFim)}h)
    </p>
  </div>

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">1. Enfermeiro Responsável</div>
    <div style="padding: 8px;">
      <div style="border:1px solid #ddd; border-radius:6px; margin-bottom:8px; padding:8px;">
        <p style="margin:0 0 4px 0;"><b>${escapeHtml(enfermeiroNome)}</b></p>
      </div>
    </div>
  </div>

  ${secoesEquipeHtml}

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">3. Pátio e Circulante</div>
    <div style="padding: 8px;">
      <div style="border:1px solid #ddd; border-radius:6px; margin-bottom:8px; padding:8px;">
        <p style="margin:0 0 6px 0;"><b>Pátio:</b> ${patioTexto}</p>
        <p style="margin:0;"><b>Circulante:</b> ${circulanteTexto}</p>
      </div>
    </div>
  </div>

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">4. Faltas e Folgas</div>
    <div style="padding: 8px;">
      <ul style="margin:0; padding-left:18px;">
        ${linhasFaltas || '<li>-</li>'}
      </ul>
    </div>
  </div>

  <div style="border: 1px solid #b5b5b5; margin-bottom: 8px; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">${payload.ect ? '3' : '5'}. Pacientes com Avaliação Externa</div>
    <div style="padding: 8px;">
      ${linhasAvaliacaoExterna || '<p style="margin:0;">-</p>'}
    </div>
  </div>

  <div style="border: 1px solid #b5b5b5; box-sizing: border-box;">
    <div style="background: #e9e9e9; padding: 5px 8px; font-weight: bold;">${payload.ect ? '4' : '6'}. Observações</div>
    <div style="padding: 8px;">
      <p style="margin:0;">${payload.observacoes ? textToHtmlLines(payload.observacoes) : '-'}</p>
    </div>
  </div>
</div>`.trim();
}

function normalizeEscalaPsicologiaPayload(dados) {
  const dataPlantao = normalizeIsoDate(dados?.data_plantao) || getTodayIsoDate();
  const { turno, turnoLabel, horaInicio, horaFim } = resolveEscalaTurnoAndHours(dados);
  const profissionais = [...new Set((Array.isArray(dados?.profissionais) ? dados.profissionais : [])
    .map(item => Number(item?.cd_pessoa_fisica))
    .filter(Number.isInteger))];
  const observacoes = sanitizeTexto(dados?.observacoes || '');

  if (Number(dados?.cd_setor_atendimento) !== 4 || Number(dados?.cd_modulo) !== 4) {
    throw Object.assign(new Error('A Escala Psicologia deve usar o setor e módulo 4'), { status: 400 });
  }
  if (profissionais.length === 0 && !observacoes) {
    throw Object.assign(new Error('Informe ao menos um profissional ou uma observação'), { status: 400 });
  }

  return { tipo_escala: 'PSICOLOGIA', dataPlantao, turno, turnoLabel, horaInicio, horaFim, cdSetorAtendimento: 4, cd_modulo: 4, profissionais, observacoes, dsJustificativa: sanitizeTexto(dados?.ds_justificativa || '') };
}

function buildEscalaPsicologiaHtml(payload, profissionaisMap, setorNome) {
  const turnos = { M: 'Manhã', T: 'Tarde', N: 'Noite' };
  const dias = [...payload.escalas].sort((a, b) => `${a.dataPlantao}-${a.turno}`.localeCompare(`${b.dataPlantao}-${b.turno}`));
  const linhas = dias.map(escala => {
    const profissionais = escala.profissionais
      .map(id => escapeHtml(profissionaisMap.get(id) || `Profissional ${id}`))
      .join(', ') || '-';
    return `<tr><td style="padding:7px;border:1px solid #ddd;">${formatDatePtBr(escala.dataPlantao)} (${formatWeekdayPtBr(escala.dataPlantao)})</td><td style="padding:7px;border:1px solid #ddd;">${turnos[escala.turno] || escala.turno}</td><td style="padding:7px;border:1px solid #ddd;">${profissionais}</td></tr>`;
  }).join('');
  const serializado = Buffer.from(JSON.stringify({
    tipo_escala: 'PSICOLOGIA', semana_inicio: payload.semanaInicio, semana_fim: payload.semanaFim,
    cd_setor_atendimento: 4, cd_modulo: 4,
    escalas: dias.map(escala => ({ data_plantao: escala.dataPlantao, turno: escala.turno, profissionais: escala.profissionais.map(cd_pessoa_fisica => ({ cd_pessoa_fisica })), observacoes: escala.observacoes }))
  }), 'utf8').toString('base64');
  return `<!--ET_JSON:${serializado}--><div style="font-family:Arial;font-size:13px;line-height:1.35;width:100%;max-width:980px;margin:0 auto;color:#111;box-sizing:border-box;"><div style="border:1px solid #888;padding:10px 12px;margin-bottom:10px;"><h2 style="margin:0 0 8px;font-size:24px;text-align:center;">Escala de Plantão — Psicologia</h2><p style="margin:0;"><b>Setor:</b> ${escapeHtml(setorNome)} <span style="display:inline-block;width:14px;"></span>|<span style="display:inline-block;width:14px;"></span><b>Semana liberada:</b> ${formatDatePtBr(payload.semanaInicio)} a ${formatDatePtBr(payload.semanaFim)}</p></div><div style="border:1px solid #b5b5b5;"><div style="background:#e9e9e9;padding:5px 8px;font-weight:bold;">Profissionais escalados por dia e turno</div><div style="padding:8px;"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:7px;border:1px solid #ddd;text-align:left;">Dia</th><th style="padding:7px;border:1px solid #ddd;text-align:left;">Turno</th><th style="padding:7px;border:1px solid #ddd;text-align:left;">Profissionais</th></tr></thead><tbody>${linhas}</tbody></table></div></div></div>`;
}

async function carregarEscalaPsicologiaSemanal(connection, semanaInicio, semanaFim) {
  const result = await connection.execute(
    `SELECT TO_CHAR(dt_plantao, 'YYYY-MM-DD') AS data_plantao, ie_turno, ie_tipo,
            cd_pessoa_fisica, ds_observacao
     FROM conecta_escala_ativa
     WHERE cd_setor_atendimento = 4
       AND TRUNC(dt_plantao) BETWEEN TO_DATE(:inicio, 'YYYY-MM-DD') AND TO_DATE(:fim, 'YYYY-MM-DD')
     ORDER BY dt_plantao, ie_turno, nr_sequencia`,
    { inicio: semanaInicio, fim: semanaFim }
  );

  const porCelula = new Map();
  (result.rows || []).forEach(row => {
    const key = `${row.DATA_PLANTAO}-${row.IE_TURNO}`;
    if (!porCelula.has(key)) {
      porCelula.set(key, { dataPlantao: row.DATA_PLANTAO, turno: row.IE_TURNO, profissionais: [], observacoes: '' });
    }
    const celula = porCelula.get(key);
    if (row.IE_TIPO === 'PSICOLOGO' && Number.isInteger(Number(row.CD_PESSOA_FISICA))) {
      celula.profissionais.push(Number(row.CD_PESSOA_FISICA));
    }
    if (row.IE_TIPO === 'OBSERVACAO') celula.observacoes = row.DS_OBSERVACAO || '';
  });

  const escalas = [];
  const inicio = new Date(`${semanaInicio}T12:00:00`);
  for (let dia = 0; dia < 7; dia += 1) {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + dia);
    const dataPlantao = data.toISOString().slice(0, 10);
    ['M', 'N'].forEach(turno => {
      const celula = porCelula.get(`${dataPlantao}-${turno}`) || { dataPlantao, turno, profissionais: [], observacoes: '' };
      celula.profissionais = [...new Set(celula.profissionais)];
      escalas.push(celula);
    });
  }
  return escalas;
}

async function salvarEscalaPsicologia(dados, usuario) {
  const escalasRaw = Array.isArray(dados?.escalas) ? dados.escalas : [];
  if (escalasRaw.length === 0) throw Object.assign(new Error('Informe ao menos uma escala para publicar'), { status: 400 });

  const escalas = escalasRaw.map(item => {
    const normalizada = normalizeEscalaPsicologiaPayload({ ...item, cd_setor_atendimento: 4, cd_modulo: 4 });
    return { dataPlantao: normalizada.dataPlantao, turno: normalizada.turno, profissionais: normalizada.profissionais, observacoes: normalizada.observacoes };
  });
  const datas = escalas.map(escala => escala.dataPlantao).sort();
  const inicio = new Date(`${datas[0]}T12:00:00`);
  const diaSemana = inicio.getDay() || 7;
  inicio.setDate(inicio.getDate() - diaSemana + 1);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  const semanaInicio = inicio.toISOString().slice(0, 10);
  const semanaFim = fim.toISOString().slice(0, 10);
  if (datas.some(data => data < semanaInicio || data > semanaFim)) {
    throw Object.assign(new Error('Publique uma semana por vez'), { status: 400 });
  }
  const payload = {
    cd_modulo: 4,
    semanaInicio,
    semanaFim,
    escalas,
    dsJustificativa: sanitizeTexto(dados?.ds_justificativa || '')
  };
  const cdPerfil = getCdPerfilForInsert(usuario, payload.cd_modulo);
  if (!cdPerfil) throw Object.assign(new Error('Perfil não encontrado para este módulo'), { status: 400 });
  let connection;
  try {
    connection = await getConnection();
    const resultAtivas = await connection.execute(
      `SELECT nr_ocorrencia, ds_ocorrencia FROM ocorrencia
       WHERE cd_setor_atendimento = 4 AND dt_inativacao IS NULL AND ie_tipo_ocorrencia = 'LA'
       ORDER BY nr_ocorrencia DESC`
    );
    const ativas = (resultAtivas.rows || []).filter(item => {
      const escalaAnterior = parseEscalaPsicologiaPayload(item.DS_OCORRENCIA);
      return escalaAnterior?.semana_inicio === payload.semanaInicio;
    });
    if (ativas.length > 0 && !payload.dsJustificativa) {
      throw Object.assign(new Error('Informe a justificativa para alterar uma semana já publicada'), { status: 400 });
    }
    if (ativas.length > 0) {
      await connection.execute(`UPDATE ocorrencia SET dt_inativacao = SYSDATE, nm_usuario_inativacao = :nm_usuario, ds_justificativa = :ds_justificativa WHERE nr_ocorrencia IN (${ativas.map((_, i) => `:nr${i}`).join(',')})`, Object.fromEntries([['nm_usuario', usuario.nm_usuario], ['ds_justificativa', payload.dsJustificativa], ...ativas.map((item, i) => [`nr${i}`, item.NR_OCORRENCIA])]));
    }
    payload.escalas = await carregarEscalaPsicologiaSemanal(connection, payload.semanaInicio, payload.semanaFim);
    const profissionaisIds = payload.escalas.flatMap(escala => escala.profissionais);
    const nomes = await fetchTecnicosNomes(connection, profissionaisIds);
    const setorNome = await fetchSetorNome(connection, 4);
    const dsOcorrencia = buildEscalaPsicologiaHtml(payload, nomes, setorNome);
    const result = await connection.execute(`INSERT INTO OCORRENCIA (nr_ocorrencia, dt_ocorrencia, ie_tipo_ocorrencia, dt_atualizacao, nm_usuario, cd_pessoa_fisica, ds_ocorrencia, cd_setor_atendimento, dt_liberacao, cd_estabelecimento, cd_perfil, nr_seq_turno) SELECT OCORRENCIA_SEQ.nextval, SYSDATE, 'LA', SYSDATE, u.nm_usuario, u.cd_pessoa_fisica, :ds_ocorrencia, 4, SYSDATE, 1, :cd_perfil, NULL FROM usuario u WHERE (UPPER(u.nm_usuario) = UPPER(:nm_usuario) OR UPPER(u.ds_login) = UPPER(:nm_usuario)) AND u.ie_situacao = 'A'`, { nm_usuario: usuario.nm_usuario, ds_ocorrencia: dsOcorrencia, cd_perfil: cdPerfil }, { autoCommit: false });
    if (!result.rowsAffected) throw Object.assign(new Error('Usuário logado não encontrado/ativo para publicar escala'), { status: 400 });
    await connection.commit();
    return { inseridos: result.rowsAffected, tipo_ocorrencia: 'LA', semana_inicio: payload.semanaInicio, semana_fim: payload.semanaFim, cd_setor_atendimento: 4, escalas: payload.escalas.length };
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) await connection.close();
  }
}

async function salvarEscalaTecnica(dados, usuario) {
  const payload = normalizeEscalaTecnicaPayload(dados || {});

  const cdPerfil = getCdPerfilForInsert(usuario, payload.cd_modulo);
  if (!cdPerfil) {
    throw Object.assign(new Error('Perfil não encontrado para este módulo'), { status: 400 });
  }

  let connection;
  try {
    connection = await getConnection();

    const escalasAtivasMesmoContexto = await listarEscalasTecnicasAtivasMesmoContexto(
      connection,
      payload.dataPlantao,
      payload.cdSetorAtendimento,
      payload.turno
    );
    if (escalasAtivasMesmoContexto.length > 0) {
      await connection.execute(
        `UPDATE ocorrencia
         SET dt_inativacao = SYSDATE,
             nm_usuario_inativacao = :nm_usuario,
             ds_justificativa = :ds_justificativa
         WHERE nr_ocorrencia IN (${escalasAtivasMesmoContexto.map((_, i) => `:nr${i}`).join(',')})`,
        Object.fromEntries([
          ['nm_usuario', usuario.nm_usuario],
          ['ds_justificativa', payload.dsJustificativa || 'Lançamento de nova escala'],
          ...escalasAtivasMesmoContexto.map((item, i) => [`nr${i}`, item.NR_OCORRENCIA])
        ])
      );
    }

    const tecnicoIds = [
      payload.enfermeiroCdPessoaFisica,
      payload.ect?.pre_procedimento,
      payload.ect?.sala_procedimento,
      payload.ect?.sala_recuperacao,
      ...payload.tecnicos.map(item => item.cd_pessoa_fisica),
      ...payload.avaliacao_externa
        .map(item => Number(item.cd_pessoa_fisica))
        .filter(Number.isInteger),
      ...payload.faltas_folgas.map(item => item.cd_pessoa_fisica)
    ];
    const atendimentos = [
      ...payload.tecnicos.flatMap(item => item.pacientes),
      ...payload.avaliacao_externa.flatMap(item =>
        Array.isArray(item.pacientes) ? item.pacientes.map(Number).filter(Number.isInteger) : []
      )
    ];

    const tecnicoNomeMap = await fetchTecnicosNomes(connection, tecnicoIds);
    const pacienteNomeMap = await fetchPacientesNomes(connection, atendimentos, payload.cdSetorAtendimento);
    const setorNome = await fetchSetorNome(connection, payload.cdSetorAtendimento);
    const dsOcorrencia = buildEscalaTecnicaHtml(payload, tecnicoNomeMap, pacienteNomeMap, {
      setorNome
    });

    const sql = `
      INSERT INTO OCORRENCIA (
        nr_ocorrencia,
        dt_ocorrencia,
        ie_tipo_ocorrencia,
        dt_atualizacao,
        nm_usuario,
        cd_pessoa_fisica,
        ds_ocorrencia,
        cd_setor_atendimento,
        dt_liberacao,
        cd_estabelecimento,
        cd_perfil,
        nr_seq_turno
      )
      SELECT
        OCORRENCIA_SEQ.nextval,
        SYSDATE,
        'LA',
        SYSDATE,
        u.nm_usuario,
        u.cd_pessoa_fisica,
        :ds_ocorrencia,
        :cd_setor_atendimento,
        SYSDATE,
        1,
        :cd_perfil,
        NULL
      FROM usuario u
      WHERE (UPPER(u.nm_usuario) = UPPER(:nm_usuario_logado) OR UPPER(u.ds_login) = UPPER(:nm_usuario_logado))
        AND u.ie_situacao = 'A'`;

    try {
      const result = await connection.execute(
        sql,
        {
          nm_usuario_logado: usuario.nm_usuario,
          ds_ocorrencia: dsOcorrencia,
          cd_setor_atendimento: payload.cdSetorAtendimento,
          cd_perfil: cdPerfil
        },
        { autoCommit: false }
      );

      if (!result.rowsAffected) {
        throw Object.assign(new Error('Usuário logado não encontrado/ativo para gravar escala técnica'), {
          status: 400
        });
      }

      await connection.commit();
      return {
        inseridos: result.rowsAffected,
        tipo_ocorrencia: 'LA',
        data_plantao: payload.dataPlantao,
        cd_setor_atendimento: payload.cdSetorAtendimento,
        turno: payload.turno
      };
    } catch (err) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {}
      throw err;
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
}

function parseEscalaTecnicaPayload(dsOcorrencia) {
  const marker = /<!--ET_JSON:([A-Za-z0-9+/=]+)-->/;
  const match = String(dsOcorrencia || '').match(marker);
  if (!match) return null;

  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

function parseEscalaPsicologiaPayload(dsOcorrencia) {
  const payload = parseEscalaTecnicaPayload(dsOcorrencia);
  return payload?.tipo_escala === 'PSICOLOGIA' ? payload : null;
}

function resolveTurnoFromEscalaPayload(payload) {
  const turnoDireto = normalizeEscalaTurno(payload?.turno);
  if (turnoDireto) return turnoDireto;

  try {
    const resolved = resolveEscalaTurnoAndHours(payload || {});
    return normalizeEscalaTurno(resolved?.turno);
  } catch (err) {
    return null;
  }
}

function getFirstDefinedValue(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
}

function sortUniqueIntegers(values) {
  return [...new Set((values || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
}

function normalizeEscalaPayloadForComparison(payload) {
  const tecnicosRaw = Array.isArray(getFirstDefinedValue(payload, ['tecnicos'])) ? getFirstDefinedValue(payload, ['tecnicos']) : [];
  const tecnicosMap = new Map();

  tecnicosRaw.forEach(item => {
    const cdPessoaFisica = Number(getFirstDefinedValue(item, ['cd_pessoa_fisica', 'cdPessoaFisica']));
    if (!Number.isInteger(cdPessoaFisica)) return;

    if (!tecnicosMap.has(cdPessoaFisica)) {
      tecnicosMap.set(cdPessoaFisica, {
        cd_pessoa_fisica: cdPessoaFisica,
        pacientes: new Set(),
        patio_circulante: new Set()
      });
    }

    const entry = tecnicosMap.get(cdPessoaFisica);
    sortUniqueIntegers(getFirstDefinedValue(item, ['pacientes'])).forEach(atendimento => entry.pacientes.add(atendimento));
    normalizePatioCirculante(getFirstDefinedValue(item, ['patio_circulante', 'patioCirculante'])).forEach(extra =>
      entry.patio_circulante.add(extra)
    );
  });

  const tecnicos = [...tecnicosMap.values()]
    .map(item => ({
      cd_pessoa_fisica: item.cd_pessoa_fisica,
      pacientes: [...item.pacientes].sort((a, b) => a - b),
      patio_circulante: [...item.patio_circulante].sort()
    }))
    .sort((a, b) => a.cd_pessoa_fisica - b.cd_pessoa_fisica);

  const faltasRaw = Array.isArray(getFirstDefinedValue(payload, ['faltas_folgas', 'faltasFolgas']))
    ? getFirstDefinedValue(payload, ['faltas_folgas', 'faltasFolgas'])
    : [];
  const faltasFolgas = faltasRaw
    .map(item => {
      const cdPessoaFisica = Number(getFirstDefinedValue(item, ['cd_pessoa_fisica', 'cdPessoaFisica']));
      const tipo = normalizeEscalaTipo(getFirstDefinedValue(item, ['tipo']));
      if (!Number.isInteger(cdPessoaFisica) || !tipo) return null;
      return { cd_pessoa_fisica: cdPessoaFisica, tipo };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.cd_pessoa_fisica !== b.cd_pessoa_fisica) return a.cd_pessoa_fisica - b.cd_pessoa_fisica;
      return a.tipo.localeCompare(b.tipo);
    });

  const avaliacaoRaw = getFirstDefinedValue(payload, ['avaliacao_externa', 'avaliacaoExterna']);
  let avaliacaoExterna = [];
  if (Array.isArray(avaliacaoRaw)) {
    if (avaliacaoRaw.length > 0 && typeof avaliacaoRaw[0] === 'object' && avaliacaoRaw[0] !== null) {
      avaliacaoExterna = avaliacaoRaw
        .map(item => ({
          cd_pessoa_fisica: Number(getFirstDefinedValue(item, ['cd_pessoa_fisica', 'cdPessoaFisica'])),
          pacientes: sortUniqueIntegers(getFirstDefinedValue(item, ['pacientes'])),
          descricao: sanitizeTexto(getFirstDefinedValue(item, ['descricao']) || '')
        }))
        .filter(item => item.pacientes.length > 0)
        .map(item => ({
          cd_pessoa_fisica: Number.isInteger(item.cd_pessoa_fisica) ? item.cd_pessoa_fisica : null,
          pacientes: item.pacientes,
          descricao: item.descricao
        }));
    } else {
      const pacientes = sortUniqueIntegers(avaliacaoRaw);
      if (pacientes.length > 0) {
        avaliacaoExterna = [{ cd_pessoa_fisica: null, pacientes, descricao: '' }];
      }
    }
  }

  avaliacaoExterna.sort((a, b) => {
    const aCd = Number.isInteger(a.cd_pessoa_fisica) ? a.cd_pessoa_fisica : Number.MAX_SAFE_INTEGER;
    const bCd = Number.isInteger(b.cd_pessoa_fisica) ? b.cd_pessoa_fisica : Number.MAX_SAFE_INTEGER;
    if (aCd !== bCd) return aCd - bCd;
    if (a.descricao !== b.descricao) return a.descricao.localeCompare(b.descricao);
    return a.pacientes.join(',').localeCompare(b.pacientes.join(','));
  });

  return {
    data_plantao: normalizeIsoDate(getFirstDefinedValue(payload, ['data_plantao', 'dataPlantao'])) || null,
    turno: resolveTurnoFromEscalaPayload(payload) || null,
    cd_setor_atendimento: Number(getFirstDefinedValue(payload, ['cd_setor_atendimento', 'cdSetorAtendimento'])) || null,
    enfermeiro_cd_pessoa_fisica:
      Number(getFirstDefinedValue(payload, ['enfermeiro_cd_pessoa_fisica', 'enfermeiroCdPessoaFisica'])) || null,
    tecnicos,
    faltas_folgas: faltasFolgas,
    avaliacao_externa: avaliacaoExterna,
    observacoes: sanitizeTexto(getFirstDefinedValue(payload, ['observacoes']) || '')
  };
}

async function listarEscalasTecnicasAtivasMesmoContexto(connection, dataPlantao, cdSetorAtendimento, turno, tipoEscala = null) {
  const turnoAlvo = normalizeEscalaTurno(turno);
  if (!turnoAlvo) return [];

  const result = await connection.execute(
    `
      SELECT nr_ocorrencia, ds_ocorrencia
      FROM ocorrencia
      WHERE ie_tipo_ocorrencia = 'LA'
        AND cd_setor_atendimento = :cd_setor
        AND TRUNC(dt_liberacao) = TO_DATE(:data_plantao, 'YYYY-MM-DD')
        AND NVL(ie_situacao, 'A') <> 'I'
      ORDER BY nr_ocorrencia DESC`,
    {
      cd_setor: cdSetorAtendimento,
      data_plantao: dataPlantao
    },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return (result.rows || []).filter(row => {
    const payloadExistente = parseEscalaTecnicaPayload(row.DS_OCORRENCIA);
    if (!payloadExistente) return false;
    if (tipoEscala && payloadExistente.tipo_escala !== tipoEscala) return false;
    return resolveTurnoFromEscalaPayload(payloadExistente) === turnoAlvo;
  });
}

async function obterEscalaTecnica(dataInformada, cdSetor, turnoInformado = null) {
  const dataPlantao = normalizeIsoDate(dataInformada) || getTodayIsoDate();
  const setorInformado = cdSetor ? Number(cdSetor) : null;
  const turnoFiltro = turnoInformado ? normalizeEscalaTurno(turnoInformado) : null;

  if (cdSetor && !Number.isInteger(setorInformado)) {
    throw Object.assign(new Error('Setor inválido para consulta da escala técnica'), { status: 400 });
  }
  if (turnoInformado && !turnoFiltro) {
    throw Object.assign(new Error('Turno inválido para consulta da escala técnica'), { status: 400 });
  }

  let connection;
  try {
    connection = await getConnection();

    const binds = { data_plantao: dataPlantao };
    let filtroSetor = '';
    if (Number.isInteger(setorInformado)) {
      filtroSetor = ' AND cd_setor_atendimento = :cd_setor ';
      binds.cd_setor = setorInformado;
    }

    const sql = `
      SELECT * FROM (
        SELECT
          nr_ocorrencia,
          nm_usuario,
          cd_setor_atendimento,
          TO_CHAR(dt_ocorrencia, 'YYYY-MM-DD HH24:MI:SS') AS dt_ocorrencia,
          ds_ocorrencia
        FROM ocorrencia
        WHERE ie_tipo_ocorrencia = 'LA'
          AND TRUNC(dt_liberacao) = TO_DATE(:data_plantao, 'YYYY-MM-DD')
          AND NVL(ie_situacao, 'A') <> 'I'
          ${filtroSetor}
        ORDER BY nr_ocorrencia DESC
      )
      WHERE ROWNUM <= 50`;

    const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const rowsComPayload = result.rows
      .map(item => ({
        row: item,
        payload: parseEscalaTecnicaPayload(item.DS_OCORRENCIA)
      }))
      .filter(item => Boolean(item.payload));

    if (!rowsComPayload.length) {
      return null;
    }

    const rowSelecionada = turnoFiltro
      ? rowsComPayload.find(item => resolveTurnoFromEscalaPayload(item.payload) === turnoFiltro)
      : rowsComPayload[0];

    const row = rowSelecionada?.row || null;
    const payload = rowSelecionada?.payload || null;
    if (!row) {
      return null;
    }
    return {
      nr_ocorrencia: row.NR_OCORRENCIA,
      nm_usuario: row.NM_USUARIO,
      dt_ocorrencia: row.DT_OCORRENCIA,
      ds_ocorrencia: row.DS_OCORRENCIA,
      cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
      data_plantao: dataPlantao,
      payload
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
}

async function listarTodasEscalasLiberadas(dataInformada, turnoInformado) {
  const dataPlantao = normalizeIsoDate(dataInformada) || getTodayIsoDate();
  const turnoFiltro = turnoInformado ? normalizeEscalaTurno(turnoInformado) : null;

  let connection;
  try {
    connection = await getConnection();

    const sql = `
      SELECT nr_ocorrencia, cd_setor_atendimento,
             obter_desc_setor_atend(cd_setor_atendimento) AS ds_setor,
             ds_ocorrencia,
             TO_CHAR(dt_liberacao, 'YYYY-MM-DD HH24:MI:SS') AS dt_liberacao,
             nm_usuario
      FROM ocorrencia
      WHERE ie_tipo_ocorrencia = 'LA'
        AND TRUNC(dt_liberacao) = TO_DATE(:data_plantao, 'YYYY-MM-DD')
        AND NVL(ie_situacao, 'A') <> 'I'
      ORDER BY obter_desc_setor_atend(cd_setor_atendimento)`;

    const result = await connection.execute(
      sql,
      { data_plantao: dataPlantao },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    const escalas = [];
    for (const row of result.rows) {
      const payload = parseEscalaTecnicaPayload(row.DS_OCORRENCIA);
      if (!payload) continue;

      const turnoRow = resolveTurnoFromEscalaPayload(payload);
      if (turnoFiltro && turnoRow !== turnoFiltro) continue;

      escalas.push({
        nr_ocorrencia: row.NR_OCORRENCIA,
        cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
        ds_setor: row.DS_SETOR,
        ds_ocorrencia: row.DS_OCORRENCIA,
        dt_liberacao: row.DT_LIBERACAO,
        nm_usuario: row.NM_USUARIO,
        payload
      });
    }

    return escalas;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

async function listarEscalasPsicologiaLiberadas(mesInformado) {
  const mes = /^\d{4}-\d{2}$/.test(String(mesInformado || ''))
    ? String(mesInformado)
    : getTodayIsoDate().slice(0, 7);
  const [ano, numeroMes] = mes.split('-').map(Number);
  const inicioMes = `${mes}-01`;
  const fimMes = new Date(ano, numeroMes, 0, 12, 0, 0).toISOString().slice(0, 10);

  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT nr_ocorrencia, ds_ocorrencia,
              TO_CHAR(dt_liberacao, 'YYYY-MM-DD HH24:MI:SS') AS dt_liberacao,
              nm_usuario
       FROM ocorrencia
       WHERE ie_tipo_ocorrencia = 'LA'
         AND cd_setor_atendimento = 4
         AND dt_liberacao IS NOT NULL
         AND NVL(ie_situacao, 'A') <> 'I'
         AND dt_inativacao IS NULL
       ORDER BY dt_liberacao DESC, nr_ocorrencia DESC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const liberadas = (result.rows || []).flatMap(row => {
      const payload = parseEscalaPsicologiaPayload(row.DS_OCORRENCIA);
      if (!payload?.semana_inicio || !payload?.semana_fim) return [];
      if (payload.semana_inicio > fimMes || payload.semana_fim < inicioMes) return [];
      return [{
        nr_ocorrencia: row.NR_OCORRENCIA,
        semana_inicio: payload.semana_inicio,
        semana_fim: payload.semana_fim,
        dt_liberacao: row.DT_LIBERACAO,
        nm_usuario: row.NM_USUARIO,
        escalas: Array.isArray(payload.escalas) ? payload.escalas : []
      }];
    });
    const ids = liberadas.flatMap(item => item.escalas).flatMap(escala => escala.profissionais || [])
      .map(profissional => Number(profissional?.cd_pessoa_fisica ?? profissional))
      .filter(Number.isInteger);
    const nomes = await fetchTecnicosNomes(connection, ids);
    liberadas.forEach(item => {
      item.escalas = item.escalas.map(escala => ({
        ...escala,
        profissionais: (escala.profissionais || []).map(profissional => {
          const cdPessoa = Number(profissional?.cd_pessoa_fisica ?? profissional);
          return { cd_pessoa_fisica: cdPessoa, nome: nomes.get(cdPessoa) || `Profissional ${cdPessoa}` };
        })
      }));
    });
    return liberadas;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}

async function listarSetoresHistorico(cdPerfil) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT DISTINCT cd_setor_atendimento, obter_desc_setor_atend(cd_setor_atendimento) AS ds_setor
       FROM ocorrencia
       WHERE ie_tipo_ocorrencia = '1'
         AND cd_perfil = :cd_perfil
         AND dt_liberacao IS NOT NULL
         AND NVL(ie_situacao, 'A') <> 'I'
         AND dt_inativacao IS NULL
       ORDER BY ds_setor`,
      { cd_perfil: cdPerfil },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows || []).map(row => ({
      cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
      ds_setor_atendimento: row.DS_SETOR
    }));
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}

module.exports = {
  salvarPassagem,
  listarPassagensAnteriores,
  listarSetoresHistorico,
  salvarLivroAdministrativo,
  obterLivroAdministrativo,
  salvarEscalaPsicologia,
  salvarEscalaTecnica,
  obterEscalaTecnica,
  listarTodasEscalasLiberadas,
  listarEscalasPsicologiaLiberadas
};
