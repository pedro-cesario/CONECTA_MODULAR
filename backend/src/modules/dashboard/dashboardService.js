const dashboardRepository = require('.//dashboardRepository');
const { NotFoundError } = require('../../core/errors/AppError');

const DASHBOARD_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30000);
const DASHBOARD_CACHE_STALE_MS = Number(process.env.DASHBOARD_CACHE_STALE_MS || 300000);
const DASHBOARD_CACHE_ENABLED = process.env.DASHBOARD_CACHE_ENABLED !== 'false';
const DASHBOARD_CACHE_MAX_ENTRIES = Number(process.env.DASHBOARD_CACHE_MAX_ENTRIES || 50);
const pacientesCache = new Map();

const TIPO_PARA_STATUS = {
  CARD_VERMELHO: { key: 'medicacao_agora', label: 'Prescrição de Agora', color: 'red' },
  CARD_LARANJA: { key: 'medicacao_suspensa', label: 'Medicações Suspensas', color: 'orange' },
  CARD_AMARELO: { key: 'checagem_pendente', label: 'Checagens Pendentes', color: 'yellow' },
  CARD_VERDE: { key: 'contencao_sn', label: 'Contenção SN', color: 'blue' },
  CARD_AZUL: { key: 'alta_medica_programada', label: 'Alta Médica Liberada', color: 'green' },
  CARD_LARANJA_2: { key: 'material_agora', label: 'Material de Agora', color: 'orange' },
};

function getTurnoAtual(date = new Date()) {
  const hour = date.getHours();
  const isManha = hour >= 7 && hour < 19;

  return {
    codigo: isManha ? 'M' : 'N',
    descricao: isManha ? 'Diurno' : 'Noturno',
  };
}

function validateCdSetor(cdSetorRaw) {
  const cdSetor = Number(cdSetorRaw);
  if (!Number.isInteger(cdSetor) || cdSetor <= 0) {
    const error = new Error('Setor inválido');
    error.status = 400;
    throw error;
  }

  return cdSetor;
}

function buildStatus(statusSet) {
  if (!(statusSet instanceof Set)) {
    return [];
  }

  return Array.from(statusSet)
    .map((tipo) => TIPO_PARA_STATUS[tipo])
    .filter(Boolean);
}

function buildResumo(pacientes) {
  return pacientes.reduce((acc, paciente) => {
    acc.total += 1;

    paciente.status.forEach((status) => {
      if (status.key === 'medicacao_agora') acc.medicacao_prescrita_agora += 1;
      if (status.key === 'medicacao_suspensa') acc.medicacoes_suspensas += 1;
      if (status.key === 'checagem_pendente') acc.checagens_pendentes += 1;
      if (status.key === 'contencao_sn') acc.contencao_sn += 1;
      if (status.key === 'alta_medica_programada') acc.alta_medica_programada += 1;
    });

    return acc;
  }, {
    total: 0,
    medicacao_prescrita_agora: 0,
    medicacoes_suspensas: 0,
    checagens_pendentes: 0,
    contencao_sn: 0,
    alta_medica_programada: 0,
  });
}

async function listarSetores() {
  const rows = await dashboardRepository.findSetoresInternacao();

  return rows.map((row) => ({
    cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
    ds_setor_atendimento: row.DS_SETOR_ATENDIMENTO,
  }));
}

function evictCacheIfNeeded() {
  if (pacientesCache.size > DASHBOARD_CACHE_MAX_ENTRIES) {
    const keysByAge = [...pacientesCache.entries()]
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    while (pacientesCache.size > DASHBOARD_CACHE_MAX_ENTRIES) {
      const oldest = keysByAge.shift();
      if (oldest) pacientesCache.delete(oldest[0]);
      else break;
    }
  }
}

function isFresh(entry, now = Date.now()) {
  return entry?.data && now - entry.updatedAt <= DASHBOARD_CACHE_TTL_MS;
}

function canServeStale(entry, now = Date.now()) {
  return entry?.data && now - entry.updatedAt <= DASHBOARD_CACHE_STALE_MS;
}

function refreshCache(cdSetor, entry) {
  if (entry?.refreshPromise) {
    return entry.refreshPromise;
  }

  const refreshPromise = buildPacientesPayload(cdSetor)
    .then((data) => {
      pacientesCache.set(cdSetor, {
        data,
        updatedAt: Date.now(),
        refreshPromise: null,
      });
      evictCacheIfNeeded();

      return data;
    })
    .catch((error) => {
      console.error('[Dashboard Cache] Erro ao atualizar setor', cdSetor, error.message);

      if (entry?.data) {
        pacientesCache.set(cdSetor, {
          ...entry,
          refreshPromise: null,
        });
      } else {
        pacientesCache.delete(cdSetor);
      }

      throw error;
    });

  pacientesCache.set(cdSetor, {
    data: entry?.data || null,
    updatedAt: entry?.updatedAt || 0,
    refreshPromise,
  });

  return refreshPromise;
}

async function buildPacientesPayload(cdSetor) {
  const turno = getTurnoAtual().codigo;
  const rows = await dashboardRepository.findPacientesComStatus(cdSetor, turno);

  const pacientes = rows
    .map((row) => {
      const status = buildStatus(row.STATUS);
      const nomeSocial = String(row.NM_SOCIAL || '').trim();
      const nomeCivil = String(row.NM_PESSOA_FISICA || '').trim();

      return {
        nr_atendimento: row.NR_ATENDIMENTO,
        atendimento: row.NR_ATENDIMENTO,
        nome: row.NOME || '-',
        ...(nomeSocial && nomeCivil ? { nome_civil: nomeCivil } : {}),
        convenio: row.CONVENIO || '-',
        cd_unidade: row.CD_UNIDADE,
        cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO || cdSetor,
        setor: row.SETOR || '-',
        status,
        prescricoes_agora: Array.isArray(row.PRESCRICOES_AGORA) ? row.PRESCRICOES_AGORA : [],
        prioritario: status.some((item) => item.key === 'medicacao_agora'),
        news_pontuacao: row.NEWS_PONTUACAO,
        news_resultado: row.NEWS_RESULTADO,
      };
    })
    .sort((a, b) => {
      if (a.prioritario !== b.prioritario) return a.prioritario ? -1 : 1;
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });

  return {
    setor: cdSetor,
    turno: getTurnoAtual(),
    resumo: buildResumo(pacientes),
    pacientes,
    atualizado_em: new Date().toISOString(),
  };
}

async function listarPacientes(cdSetorRaw) {
  const cdSetor = validateCdSetor(cdSetorRaw);

  if (!DASHBOARD_CACHE_ENABLED || DASHBOARD_CACHE_TTL_MS <= 0) {
    return buildPacientesPayload(cdSetor);
  }

  const now = Date.now();
  const entry = pacientesCache.get(cdSetor);

  if (isFresh(entry, now)) {
    return entry.data;
  }

  if (canServeStale(entry, now)) {
    refreshCache(cdSetor, entry).catch(() => {});
    return entry.data;
  }

  return refreshCache(cdSetor, entry);
}

async function prewarmDashboardCache(setoresRaw) {
  const setores = String(setoresRaw || '')
    .split(',')
    .map((setor) => setor.trim())
    .filter(Boolean)
    .map(validateCdSetor)
    .filter((setor, index, array) => array.indexOf(setor) === index);

  for (const setor of setores) {
    const start = Date.now();

    try {
      const data = await refreshCache(setor, pacientesCache.get(setor));
      console.log(
        `[Dashboard Cache] Setor ${setor} pré-aquecido com ${data.pacientes.length} pacientes em ${Date.now() - start}ms`
      );
    } catch (error) {
      console.error(`[Dashboard Cache] Falha ao pré-aquecer setor ${setor}:`, error.message);
    }
  }
}

let dashboardPaCache = { data: null, updatedAt: 0, refreshPromise: null };

function refreshDashboardPaCache() {
  if (dashboardPaCache.refreshPromise) {
    return dashboardPaCache.refreshPromise;
  }

  const promise = (async () => {
    const [particularesAlta, altaMedica, salaObservacao, indicacaoInternacao, decididos] = await Promise.all([
      dashboardRepository.findPacientesParticularesAlta(),
      dashboardRepository.findPacientesAltaMedica(),
      dashboardRepository.findPacientesSalaObservacao(),
      dashboardRepository.findPacientesIndicacaoInternacao(),
      dashboardRepository.findPacientesDecididos()
    ]);

    const mapear = (rows) => rows.map(row => {
      const nomeSocial = String(row.NM_SOCIAL || '').trim();
      const nomeCivil = String(row.NOME || '').trim();
      return {
        nr_atendimento: row.NR_ATENDIMENTO,
        nome: row.NOME || '-',
        ...(nomeSocial && nomeCivil && nomeSocial !== nomeCivil ? { nome_civil: nomeCivil } : {}),
        nome_social: nomeSocial || null,
        convenio: row.CONVENIO || '-',
        cd_unidade: row.UNIDADE,
        cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
        setor: row.SETOR || '-',
        nr_seq_templ: row.NR_SEQ_TEMPL || null
      };
    });

    const mapearDecididos = (rows) => rows.map(row => {
      const base = mapear([row])[0];
      return {
        ...base,
        decisao: row.DECISAO || null,
        dt_decisao: row.DT_DECISAO || null,
        decidido_por: row.DECIDIDO_POR || row.NM_USUARIO_DECISAO || '-',
        motivo: row.MOTIVO || null,
        cd_setor_desejado: row.CD_SETOR_DESEJADO || null,
        setor_desejado: row.DS_SETOR_DESEJADO || null
      };
    });

    return {
      turno: getTurnoAtual(),
      particularesAlta: mapear(particularesAlta),
      altaMedica: mapear(altaMedica),
      salaObservacao: mapear(salaObservacao),
      indicacaoInternacao: mapear(indicacaoInternacao),
      decididos: mapearDecididos(decididos),
      atualizado_em: new Date().toISOString()
    };
  })();

  dashboardPaCache.refreshPromise = promise
    .then((data) => {
      dashboardPaCache = { data, updatedAt: Date.now(), refreshPromise: null };
      return data;
    })
    .catch((error) => {
      console.error('[Dashboard PA Cache] Erro ao atualizar', error.message);
      dashboardPaCache.refreshPromise = null;
      throw error;
    });

  return dashboardPaCache.refreshPromise;
}

async function listarDashboardPA() {
  if (!DASHBOARD_CACHE_ENABLED || DASHBOARD_CACHE_TTL_MS <= 0) {
    return refreshDashboardPaCache();
  }

  const now = Date.now();
  
  if (dashboardPaCache.data && (now - dashboardPaCache.updatedAt <= DASHBOARD_CACHE_TTL_MS)) {
    return dashboardPaCache.data;
  }
  
  if (dashboardPaCache.data && (now - dashboardPaCache.updatedAt <= DASHBOARD_CACHE_STALE_MS)) {
    refreshDashboardPaCache().catch(() => {});
    return dashboardPaCache.data;
  }
  
  return refreshDashboardPaCache();
}

async function listarDetalhesInternacao(nrAtendimento) {
  const rows = await dashboardRepository.findPacientesIndicacaoInternacao();
  let paciente = rows.find(r => String(r.NR_ATENDIMENTO) === String(nrAtendimento));
  let decidido = null;

  if (!paciente) {
    const decididos = await dashboardRepository.findPacientesDecididos();
    decidido = decididos.find(r => String(r.NR_ATENDIMENTO) === String(nrAtendimento));
    if (!decidido) {
      throw new NotFoundError('Paciente não encontrado na lista de indicação de internação');
    }
    paciente = decidido;
  }

  const detalhes = await dashboardRepository.findDetalhesInternacao(
    nrAtendimento,
    paciente.NR_SEQ_TEMPL
  );

  const resultado = {};
  detalhes.forEach(d => {
    resultado[`campo_${d.NR_SEQ_TEMP_CONTEUDO}`] = d.DS_RESULTADO || '-';
  });

  const base = {
    nr_atendimento: nrAtendimento,
    nr_seq_templ: paciente.NR_SEQ_TEMPL,
    nome: paciente.NOME || '-',
    setor: paciente.SETOR || '-',
    convenio: paciente.CONVENIO || '-',
    cd_convenio: paciente.CD_CONVENIO || null,
    resultado
  };

  if (decidido) {
    base.decisao = decidido.DECISAO || null;
    base.dt_decisao = decidido.DT_DECISAO || null;
    base.decidido_por = decidido.DECIDIDO_POR || decidido.NM_USUARIO_DECISAO || '-';
    base.motivo = decidido.MOTIVO || null;
    base.cd_setor_desejado = decidido.CD_SETOR_DESEJADO || null;
    base.setor_desejado = decidido.DS_SETOR_DESEJADO || null;
  }

  return base;
}

async function acaoInternacao(nrAtendimento, acao, nmUsuario, motivo, cdPessoaFisica, cdSetorDesejado, cdConvenio) {
  let result = { success: true };
  if (acao === 'aceitar') {
    result = await dashboardRepository.aceitarInternacao(nrAtendimento, nmUsuario, motivo, cdPessoaFisica, cdSetorDesejado, cdConvenio);
  } else if (acao === 'recusar') {
    await dashboardRepository.recusarInternacao(nrAtendimento, nmUsuario, motivo, cdPessoaFisica, cdSetorDesejado, cdConvenio);
  } else {
    const err = new Error('Ação inválida. Use: aceitar ou recusar');
    err.status = 400;
    throw err;
  }
  
  // Invalida o cache do P.A.
  dashboardPaCache.updatedAt = 0;
  dashboardPaCache.data = null;

  return result;
}

function clearCache() {
  pacientesCache.clear();
}

module.exports = {
  listarSetores,
  listarPacientes,
  getTurnoAtual,
  prewarmDashboardCache,
  listarDashboardPA,
  listarDetalhesInternacao,
  acaoInternacao,
  clearCache
};
