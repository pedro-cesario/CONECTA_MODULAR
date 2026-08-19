const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { verbose } = sqlite3;
const sqlite3v = verbose();

const dbDir = path.resolve(__dirname, '../../auth.sqlite');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'config.db');

let db;

function getConnection() {
  if (!db) {
    db = new sqlite3v.Database(dbPath);
  }
  return db;
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getConnection().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getConnection().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

let cache = {
  perfis: [],
  modulos: [],
  perfilModulos: [],
  perfilPermissoes: [],
  perfilModuloSetores: [],
  dashboardPA: null,
  systemConfig: {}
};

async function ensureAccessSchema() {
  await run(`CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS config_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS perfis (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    setorId INTEGER NOT NULL,
    grupoLdap TEXT NOT NULL,
    sessionFlag TEXT NOT NULL,
    setorReferenciaFixo INTEGER DEFAULT 0,
    dsPerfilTasy TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS modulos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    icon TEXT DEFAULT 'bi-gear',
    setorId INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS perfil_modulos (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS perfil_permissoes (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    permissao TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id, permissao),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS perfil_modulo_setores (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    cd_setor_atendimento INTEGER NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id, cd_setor_atendimento),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);

  await run(`INSERT OR IGNORE INTO perfil_modulo_setores (perfil_id, modulo_id, cd_setor_atendimento)
    SELECT perfil_id, modulo_id, CAST(permissao AS INTEGER)
    FROM perfil_permissoes
    WHERE modulo_id = 'passagem' AND permissao GLOB '[0-9]*'`);
  await run(`DELETE FROM perfil_permissoes
    WHERE modulo_id = 'passagem' AND permissao GLOB '[0-9]*'`);
  await run(`DELETE FROM perfil_permissoes
    WHERE modulo_id = 'passagem' AND LOWER(TRIM(permissao)) IN ('undefined', 'null', '')`);
  const migration = await all("SELECT id FROM config_migrations WHERE id = '2026_08_passagem_access'");
  if (migration.length === 0) {
    await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao)
      SELECT perfil_id, modulo_id, 'lancar_nova_passagem'
      FROM perfil_modulos
      WHERE modulo_id = 'passagem'`);
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_passagem_access')");
  }
  const migrationCheckboxes = await all("SELECT id FROM config_migrations WHERE id = '2026_08_passagem_checkboxes'");
  if (migrationCheckboxes.length === 0) {
    const campos = ['acompanhante', 'broncoaspiracao', 'contencao', 'heteroautoagressao', 'jejum', 'lesao', 'queda', 'tae', 'riscofuga'];
    for (const campo of campos) {
      await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao)
        SELECT perfil_id, modulo_id, 'campo_${campo}'
        FROM perfil_modulos
        WHERE modulo_id = 'passagem'`);
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_passagem_checkboxes')");
  }
}

async function load() {
  try {
    await ensureAccessSchema();
    const perfis = await all('SELECT * FROM perfis WHERE ativo = 1');
    const modulos = await all('SELECT * FROM modulos');
    const perfilModulos = await all('SELECT * FROM perfil_modulos');
    const perfilPermissoes = await all('SELECT * FROM perfil_permissoes');
    const perfilModuloSetores = await all('SELECT * FROM perfil_modulo_setores');
    const dbRows = await all("SELECT * FROM configuracoes_dashboard_pa WHERE chave = 'dest'");
    const dashboardPA = dbRows.length > 0 ? dbRows[0] : null;

    const dbSys = await all('SELECT * FROM configuracoes_sistema');
    const systemConfig = {};
    for (const row of dbSys) {
      systemConfig[row.chave] = row.valor;
    }

    cache = { perfis, modulos, perfilModulos, perfilPermissoes, perfilModuloSetores, dashboardPA, systemConfig };
    return true;
  } catch (err) {
    console.error('[ConfigCache] Erro ao carregar cache:', err.message);
    return false;
  }
}

function getCachedPerfis() {
  return cache.perfis;
}

function getCachedModulos() {
  return cache.modulos;
}

function getCachedPerfilModulos() {
  return cache.perfilModulos;
}

function getCachedPerfilPermissoes() {
  return cache.perfilPermissoes;
}

function getCachedPerfilModuloSetores() {
  return cache.perfilModuloSetores;
}

function perfilTemPermissao(perfilId, moduloId, permissao) {
  if (!perfilId || !moduloId || !permissao) return false;
  return cache.perfilPermissoes.some(pp => pp.perfil_id === perfilId && pp.modulo_id === moduloId && pp.permissao === permissao);
}

function getSetoresPermitidos(perfilId, moduloId = 'passagem') {
  return cache.perfilModuloSetores
    .filter(item => item.perfil_id === perfilId && item.modulo_id === moduloId)
    .map(item => Number(item.cd_setor_atendimento))
    .filter(Number.isInteger);
}

function perfilPodeVisualizarSetor(perfilId, cdSetor, moduloId = 'passagem') {
  const permitidos = getSetoresPermitidos(perfilId, moduloId);
  if (permitidos.length > 0) {
    return permitidos.includes(Number(cdSetor));
  }
  return perfilTemPermissao(perfilId, moduloId, 'admin');
}

function getPerfilById(id) {
  return cache.perfis.find(p => p.id === id) || null;
}

function getModuloById(id) {
  return cache.modulos.find(m => m.id === id) || null;
}

function getModulosByPerfil(perfilId) {
  const modIds = cache.perfilModulos
    .filter(pm => pm.perfil_id === perfilId)
    .map(pm => pm.modulo_id);
  return cache.modulos.filter(m => modIds.includes(m.id));
}

function getModuloIdsByPerfil(perfilId) {
  return cache.perfilModulos
    .filter(pm => pm.perfil_id === perfilId)
    .map(pm => pm.modulo_id);
}

function perfilTemAcessoModulo(perfilId, moduloId) {
  if (!perfilId || !moduloId) return false;
  return cache.perfilModulos.some(pm => pm.perfil_id === perfilId && pm.modulo_id === moduloId);
}

function getPerfisDisponiveis(gruposAd = []) {
  const grupos = new Set(
    (gruposAd || [])
      .filter(g => typeof g === 'string')
      .map(g => g.trim().toUpperCase())
  );
  return cache.perfis
    .filter(p => grupos.has(p.grupoLdap.toUpperCase()))
    .map(p => {
      const permissoesObj = {};
      cache.perfilPermissoes.filter(pp => pp.perfil_id === p.id).forEach(pp => {
        if (!permissoesObj[pp.modulo_id]) permissoesObj[pp.modulo_id] = [];
        permissoesObj[pp.modulo_id].push(pp.permissao);
      });
      return {
        id: p.id,
        nome: p.nome,
        sessionFlag: p.sessionFlag,
        setorId: p.setorId,
        setorReferenciaFixo: Boolean(p.setorReferenciaFixo),
        dsPerfilTasy: p.dsPerfilTasy || p.grupoLdap,
        permissoes: permissoesObj
      };
    });
}

function getSessionFlags(perfis = {}) {
  const flags = {};
  cache.perfis.forEach(p => {
    flags[p.sessionFlag] = Boolean(perfis[p.id]);
  });
  return flags;
}

function getSetoresByPerfis(perfis = {}) {
  return cache.perfis
    .filter(p => perfis[p.id])
    .map(p => ({
      cd_setor_atendimento: p.setorId,
      ds_setor_atendimento: p.nome
    }));
}

function getSetorReferenciaFixo(setoresSelecionados = []) {
  const setores = new Set((setoresSelecionados || []).map(Number).filter(Number.isInteger));
  const perfil = cache.perfis.find(p => p.setorReferenciaFixo && setores.has(p.setorId));
  return perfil ? perfil.setorId : null;
}

function getEspecialidadeBySetor(cdSetor) {
  return cache.perfis.find(p => p.setorId === Number(cdSetor)) || null;
}

function getCdPerfilBySetor(cdSetor, cdPerfisMap) {
  const perfil = getEspecialidadeBySetor(cdSetor);
  if (!perfil) return null;
  return cdPerfisMap ? cdPerfisMap[perfil.id] : null;
}

function getCdPerfilByModulo(cdModulo, cdPerfisMap) {
  const perfil = cache.perfis.find(p => p.setorId === Number(cdModulo));
  if (!perfil) return null;
  return cdPerfisMap ? cdPerfisMap[perfil.id] : null;
}

function buildCdPerfisMap(perfisPorEspecialidade) {
  const map = {};
  for (const [id, cdPerfil] of Object.entries(perfisPorEspecialidade)) {
    if (cdPerfil) map[id] = cdPerfil;
  }
  return map;
}

async function saveProfile(data) {
  const { id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy } = data;
  if (!id || !nome || !grupoLdap) throw new Error('id, nome e grupoLdap são obrigatórios');

  const existing = await all('SELECT id FROM perfis WHERE id = ?', [id]);

  if (existing.length > 0) {
    await run(`UPDATE perfis SET nome=?, setorId=?, grupoLdap=?, sessionFlag=?, setorReferenciaFixo=?, dsPerfilTasy=?, updated_at=datetime('now') WHERE id=?`,
      [nome, setorId, grupoLdap, sessionFlag || `acesso_${id}`, setorReferenciaFixo ? 1 : 0, dsPerfilTasy || grupoLdap, id]);
  } else {
    await run(`INSERT INTO perfis (id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy) VALUES (?,?,?,?,?,?,?)`,
      [id, nome, setorId || 0, grupoLdap, sessionFlag || `acesso_${id}`, setorReferenciaFixo ? 1 : 0, dsPerfilTasy || grupoLdap]);
  }

  await load();
  return getPerfilById(id);
}

async function deleteProfile(id) {
  await run('DELETE FROM perfil_modulo_setores WHERE perfil_id = ?', [id]);
  const deleted = await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [id]);
  await run('DELETE FROM perfis WHERE id = ?', [id]);
  await load();
  return deleted.changes > 0;
}

async function setProfileModules(perfilId, moduloIds = []) {
  await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [perfilId]);
  await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
  for (const modId of moduloIds) {
    await run('INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES (?, ?)', [perfilId, modId]);
  }
  await load();
}

async function setProfilePermissions(perfilId, permissions = {}) {
  await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
  for (const [moduloId, permissoes] of Object.entries(permissions)) {
    for (const permissao of permissoes || []) {
      await run('INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, ?, ?)', [perfilId, moduloId, permissao]);
    }
  }
  await load();
}

async function setProfileAccess(perfilId, moduloIds = [], permissions = {}, setoresPorModulo = {}) {
  await run('BEGIN IMMEDIATE TRANSACTION');
  try {
    await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [perfilId]);
    await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
    await run('DELETE FROM perfil_modulo_setores WHERE perfil_id = ?', [perfilId]);

    for (const moduloId of moduloIds) {
      await run('INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES (?, ?)', [perfilId, moduloId]);
    }
    for (const [moduloId, permissoes] of Object.entries(permissions || {})) {
      if (!moduloIds.includes(moduloId)) continue;
      for (const permissao of permissoes || []) {
        await run(
          'INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, ?, ?)',
          [perfilId, moduloId, String(permissao)]
        );
      }
    }
    for (const [moduloId, setores] of Object.entries(setoresPorModulo || {})) {
      if (!moduloIds.includes(moduloId)) continue;
      for (const setor of setores || []) {
        const cdSetor = Number(setor);
        if (!Number.isInteger(cdSetor)) continue;
        await run(
          'INSERT OR IGNORE INTO perfil_modulo_setores (perfil_id, modulo_id, cd_setor_atendimento) VALUES (?, ?, ?)',
          [perfilId, moduloId, cdSetor]
        );
      }
    }
    await run('COMMIT');
  } catch (err) {
    try { await run('ROLLBACK'); } catch (_) {}
    throw err;
  }
  await load();
}

async function saveModule(data) {
  const { id, nome, descricao, icon, setorId } = data;
  if (!id || !nome) throw new Error('id e nome são obrigatórios para módulo');

  const existing = await all('SELECT id FROM modulos WHERE id = ?', [id]);
  if (existing.length > 0) {
    await run('UPDATE modulos SET nome=?, descricao=?, icon=?, setorId=? WHERE id=?',
      [nome, descricao || '', icon || 'bi-gear', setorId || null, id]);
  } else {
    await run('INSERT INTO modulos (id, nome, descricao, icon, setorId) VALUES (?,?,?,?,?)',
      [id, nome, descricao || '', icon || 'bi-gear', setorId || null]);
  }

  await load();
  return getModuloById(id);
}

async function deleteModule(id) {
  await run('DELETE FROM perfil_modulo_setores WHERE modulo_id = ?', [id]);
  await run('DELETE FROM perfil_modulos WHERE modulo_id = ?', [id]);
  const deleted = await run('DELETE FROM modulos WHERE id = ?', [id]);
  await load();
  return deleted.changes > 0;
}

function getAllPerfisWithModulos() {
  return cache.perfis.map(p => {
    const moduloIds = cache.perfilModulos
      .filter(pm => pm.perfil_id === p.id)
      .map(pm => pm.modulo_id);
    return {
      ...p,
      setorReferenciaFixo: Boolean(p.setorReferenciaFixo),
      modulos: moduloIds
    };
  });
}

function getAllModulosWithPermissoes() {
  return cache.modulos.map(m => {
    const perfisComAcesso = cache.perfilModulos
      .filter(pm => pm.modulo_id === m.id)
      .map(pm => pm.perfil_id);
    return {
      ...m,
      perfisPermitidos: perfisComAcesso
    };
  });
}

async function getPerfisFromGroups(gruposAd = []) {
  const grupos = new Set(
    (gruposAd || [])
      .filter(g => typeof g === 'string')
      .map(g => g.trim().toUpperCase())
  );
  const result = {};
  cache.perfis.forEach(p => {
    result[p.id] = grupos.has(p.grupoLdap.toUpperCase());
  });
  return result;
}

function getCacheMetadata() {
  return {
    perfisCount: cache.perfis.length,
    modulosCount: cache.modulos.length,
    permissoesCount: cache.perfilModulos.length,
    perfilModulos: cache.perfilModulos,
    perfilPermissoes: cache.perfilPermissoes,
    perfilModuloSetores: cache.perfilModuloSetores
  };
}

function getSystemConfig() {
  return cache.systemConfig || {};
}

async function saveSystemConfig(configs) {
  for (const [key, val] of Object.entries(configs)) {
    const existing = await all('SELECT 1 FROM configuracoes_sistema WHERE chave = ?', [key]);
    if (existing.length > 0) {
      await run("UPDATE configuracoes_sistema SET valor = ?, updated_at = datetime('now') WHERE chave = ?", [String(val), key]);
    } else {
      await run("INSERT INTO configuracoes_sistema (chave, valor) VALUES (?, ?)", [key, String(val)]);
    }
  }
  await load();
  return getSystemConfig();
}

function getDashboardPAConfig() {
  return cache.dashboardPA;
}

async function saveDashboardPAConfig(nr_sequencia_fila, ds_fila) {
  try {
    const existing = await all("SELECT 1 FROM configuracoes_dashboard_pa WHERE chave = 'dest'");
    if (existing.length > 0) {
      await run(
        "UPDATE configuracoes_dashboard_pa SET nr_sequencia_fila = ?, ds_fila = ?, updated_at = datetime('now') WHERE chave = 'dest'",
        [nr_sequencia_fila, ds_fila]
      );
    } else {
      await run(
        "INSERT INTO configuracoes_dashboard_pa (chave, nr_sequencia_fila, ds_fila) VALUES ('dest', ?, ?)",
        [nr_sequencia_fila, ds_fila]
      );
    }
    await load();
    return cache.dashboardPA;
  } catch (err) {
    console.error('[ConfigCache] Erro ao salvar config dashboard P.A:', err.message);
    throw err;
  }
}

module.exports = {
  load,
  loadConfig: load,
  getSystemConfig,
  saveSystemConfig,
  getCachedPerfis,
  getCachedModulos,
  getCachedPerfilModulos,
  getPerfilById,
  getModuloById,
  getModulosByPerfil,
  getModuloIdsByPerfil,
  perfilTemAcessoModulo,
  getPerfisDisponiveis,
  getSessionFlags,
  getSetoresByPerfis,
  getSetorReferenciaFixo,
  getEspecialidadeBySetor,
  getCdPerfilBySetor,
  getCdPerfilByModulo,
  buildCdPerfisMap,
  getPerfisFromGroups,
  saveProfile,
  deleteProfile,
  setProfileModules,
  setProfilePermissions,
  setProfileAccess,
  saveModule,
  deleteModule,
  getAllPerfisWithModulos,
  getAllModulosWithPermissoes,
  getCacheMetadata,
  getDashboardPAConfig,
  saveDashboardPAConfig,
  perfilTemPermissao,
  getCachedPerfilPermissoes,
  getCachedPerfilModuloSetores,
  getSetoresPermitidos,
  perfilPodeVisualizarSetor
};
