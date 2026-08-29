let useCache = false;
let configCacheInstance = null;

try {
  configCacheInstance = require('./configCache');
  const metadata = configCacheInstance.getCacheMetadata();
  if (metadata && metadata.perfisCount > 0) {
    useCache = true;
  }
} catch (_) {
  useCache = false;
}

const ESPECIALIDADES_STATIC = [
  {
    id: 'enfermagem',
    nome: 'Enfermagem',
    setorId: 1,
    grupoAd: 'API_CONECTA_ASSISTENCIAL_ENF',
    dsPerfilTasy: 'API_CONECTA_ASSISTENCIAL_ENF',
    sessionFlag: 'acesso_enfermagem',
    setorReferenciaFixo: false
  },
  {
    id: 'psicologia',
    nome: 'Psicologia',
    setorId: 4,
    grupoAd: 'API_CONECTA_ASSISTENCIAL_PSI',
    dsPerfilTasy: 'API_CONECTA_ASSISTENCIAL_PSI',
    sessionFlag: 'acesso_psicologia',
    setorReferenciaFixo: true
  },
  {
    id: 'tecnico_enfermagem',
    nome: 'Técnico de Enfermagem',
    setorId: 1,
    grupoAd: 'API_CONECTA_ASSISTENCIAL_TEC_ENF',
    dsPerfilTasy: 'API_CONECTA_ASSISTENCIAL_TEC_ENF',
    sessionFlag: 'acesso_tecnico_enfermagem',
    setorReferenciaFixo: false
  }
];

function getESpecialidades() {
  const cachedPerfis = configCacheInstance ? configCacheInstance.getCachedPerfis() : [];
  if (cachedPerfis.length > 0) {
    return cachedPerfis.map(p => ({
      id: p.id,
      nome: p.nome,
      setorId: p.setorId,
      grupoAd: p.grupoLdap,
      dsPerfilTasy: p.dsPerfilTasy,
      sessionFlag: p.sessionFlag,
      setorReferenciaFixo: Boolean(p.setorReferenciaFixo)
    }));
  }
  return ESPECIALIDADES_STATIC;
}

const ESPECIALIDADES = getESpecialidades();

const DASHBOARD_PACIENTES_CONFIG = {
  id: 'dashboard-pacientes',
  nome: 'Dashboard de Pacientes',
  grupoAd: 'API_CONECTA_ASSISTENCIAL_ENF',
  sessionFlag: 'acesso_enfermagem',
  cdClassifSetor: 3,
  refreshMs: 30000,
  allowedProfiles: ['enfermagem', 'tecnico_enfermagem']
};

const DASHBOARD_PA_CONFIG = {
  id: 'dashboard-pa',
  nome: 'Dashboard P.A.',
  grupoAd: 'API_CONECTA_ASSISTENCIAL_ENF',
  sessionFlag: 'acesso_enfermagem',
  refreshMs: 30000,
  allowedProfiles: ['enfermagem']
};

function normalizeGroups(grupos = []) {
  return grupos
    .filter(g => typeof g === 'string')
    .map(g => g.trim().toUpperCase());
}

function getPerfisFromGroups(gruposAd = []) {
  const grupos = new Set(normalizeGroups(gruposAd));
  const especialidades = getESpecialidades();
  return especialidades.reduce((acc, especialidade) => {
    acc[especialidade.id] = grupos.has(especialidade.grupoAd.toUpperCase());
    return acc;
  }, {});
}

function getSetoresByPerfis(perfis = {}) {
  const especialidades = getESpecialidades();
  return especialidades
    .filter(e => perfis[e.id])
    .map(e => ({
      cd_setor_atendimento: e.setorId,
      ds_setor_atendimento: e.nome
    }));
}

function getSessionFlags(perfis = {}) {
  const especialidades = getESpecialidades();
  return especialidades.reduce((acc, especialidade) => {
    acc[especialidade.sessionFlag] = Boolean(perfis[especialidade.id]);
    return acc;
  }, {});
}

function getSetorReferenciaFixo(setoresSelecionados = [], cdModulo = null) {
  const especialidades = getESpecialidades();
  
  if (cdModulo) {
    const especialidade = especialidades.find(e => e.setorId === Number(cdModulo));
    if (especialidade && especialidade.setorReferenciaFixo) {
      return especialidade.setorId;
    }
  }

  const setores = new Set((setoresSelecionados || []).map(Number).filter(Number.isInteger));
  const especialidade = especialidades.find(e => e.setorReferenciaFixo && setores.has(e.setorId));
  return especialidade ? especialidade.setorId : null;
}

function getEspecialidadeBySetor(cdSetor) {
  const especialidades = getESpecialidades();
  return especialidades.find(e => e.setorId === Number(cdSetor));
}

function getCdPerfilBySetor(cdSetor, cdPerfisMap) {
  if (!cdPerfisMap || typeof cdPerfisMap !== 'object') return null;
  const especialidades = getESpecialidades();
  const matching = especialidades.filter(e => e.setorId === Number(cdSetor));
  for (const esp of matching) {
    if (cdPerfisMap[esp.id]) return cdPerfisMap[esp.id];
  }
  return null;
}

function getCdPerfilByModulo(cdModulo, cdPerfisMap) {
  if (!cdPerfisMap || typeof cdPerfisMap !== 'object') return null;
  const especialidades = getESpecialidades();
  const matching = especialidades.filter(e => e.setorId === Number(cdModulo));
  for (const esp of matching) {
    if (cdPerfisMap[esp.id]) return cdPerfisMap[esp.id];
  }
  return null;
}

function buildCdPerfisMap(perfisPorEspecialidade) {
  const map = {};
  for (const [id, cdPerfil] of Object.entries(perfisPorEspecialidade)) {
    if (cdPerfil) map[id] = cdPerfil;
  }
  return map;
}

module.exports = {
  ESPECIALIDADES,
  DASHBOARD_PACIENTES_CONFIG,
  DASHBOARD_PA_CONFIG,
  getPerfisFromGroups,
  getSetoresByPerfis,
  getSessionFlags,
  getSetorReferenciaFixo,
  getEspecialidadeBySetor,
  getCdPerfilBySetor,
  getCdPerfilByModulo,
  buildCdPerfisMap
};
