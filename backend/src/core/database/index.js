const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

const path = require('path');
const candidatePaths = [
  process.env.OCI_LIB_DIR,
  '/tmp/ic19',
  '/opt/oracle/instantclient',
  path.resolve(__dirname, '../../../instantclient-files'),
  path.resolve(__dirname, '../../../../instantclient-files')
].filter(Boolean);

let thickMode = false;
try {
  const fs = require('fs');
  for (const instantClientPath of candidatePaths) {
    if (fs.existsSync(instantClientPath)) {
      const files = fs.readdirSync(instantClientPath);
      if (files.includes('libclntsh.so.19.1') || files.includes('libclntsh.so')) {
        oracledb.initOracleClient({ libDir: instantClientPath });
        thickMode = true;
        console.log(`[Oracle] Modo Thick ativado - Instant Client em ${instantClientPath}`);
        break;
      }
    }
  }
} catch (err) {
  if (!err.message.includes('already initialized')) {
    console.warn('[Oracle] Erro ao carregar Instant Client:', err.message);
  } else {
    thickMode = true;
  }
}

let currentDbUser = ((process.env.DB_USER || '').trim()).toUpperCase();
let currentDbPassword = (process.env.DB_PASSWORD || '').trim();
let currentDbHost = (process.env.DB_HOST || '').trim();
let currentDbPort = (process.env.DB_PORT || '1521').trim();
let currentDbService = (process.env.DB_SERVICE || '').trim();
let currentPoolMin = parseInt(process.env.DB_POOL_MIN || '3', 10);
let currentPoolMax = parseInt(process.env.DB_POOL_MAX || '15', 10);

function getConnectString() {
  return `${currentDbHost}:${currentDbPort}/${currentDbService}`;
}

console.log('[Oracle] Modo:', thickMode ? 'Thick' : 'Thin');
console.log('[Oracle] Connect:', getConnectString());

let pool;

async function initPool(customParams = null) {
  if (customParams) {
    if (customParams.host) currentDbHost = String(customParams.host).trim();
    if (customParams.port) currentDbPort = String(customParams.port).trim();
    if (customParams.service) currentDbService = String(customParams.service).trim();
    if (customParams.user) currentDbUser = String(customParams.user).trim().toUpperCase();
    if (customParams.password) currentDbPassword = String(customParams.password).trim();
    if (customParams.poolMin) currentPoolMin = parseInt(customParams.poolMin, 10) || 3;
    if (customParams.poolMax) currentPoolMax = parseInt(customParams.poolMax, 10) || 15;
  }

  if (!pool) {
    console.log('[Oracle] Criando pool...');
    try {
      const poolIncrement = parseInt(process.env.DB_POOL_INCREMENT || '2', 10);
      const queueTimeout = parseInt(process.env.DB_QUEUE_TIMEOUT || '10', 10) * 1000;
      const poolTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || '60', 10);

      pool = await oracledb.createPool({
        user: currentDbUser,
        password: currentDbPassword,
        connectString: getConnectString(),
        poolMin: currentPoolMin,
        poolMax: currentPoolMax,
        poolIncrement: poolIncrement,
        poolTimeout: poolTimeout,
        queueTimeout: queueTimeout
      });
      console.log(`[Oracle] Pool criado com sucesso: ${getConnectString()} (min:${currentPoolMin}, max:${currentPoolMax})`);
    } catch (err) {
      console.error('[Oracle] Erro ao criar pool:', err.message);
      throw err;
    }
  }
  return pool;
}

async function reconnectPool(newParams) {
  await closePool();
  await initPool(newParams);
  const conn = await getConnection();
  try {
    await conn.execute('SELECT 1 FROM DUAL');
  } finally {
    await conn.close();
  }
  return {
    success: true,
    connectString: getConnectString(),
    user: currentDbUser,
    poolMin: currentPoolMin,
    poolMax: currentPoolMax
  };
}

async function getConnection() {
  if (!pool) await initPool();
  return pool.getConnection();
}

async function closePool() {
  if (pool) {
    try {
      await pool.close(0);
    } catch (e) {
      console.warn('[Oracle] Aviso ao fechar pool anterior:', e.message);
    }
    pool = null;
  }
}

async function initEscalaAtivaTables() {
  try {
    const { initTables } = require('../../modules/escalas/escalaAtivaRepository');
    await initTables();
  } catch (err) {
    console.warn('[DB] Não foi possível verificar/criar tabelas da escala ativa:', err.message);
  }
}

function getPoolStats() {
  if (!pool) return null;
  return {
    connectionsInUse: pool.connectionsInUse,
    connectionsOpen: pool.connectionsOpen,
    poolMin: pool.poolMin,
    poolMax: pool.poolMax
  };
}

function getOracleConfig() {
  let sysConfig = {};
  try {
    const configCache = require('../config/configCache');
    sysConfig = configCache.getSystemConfig() || {};
  } catch (e) {}

  const host = sysConfig.db_host || currentDbHost;
  const port = sysConfig.db_port || currentDbPort;
  const service = sysConfig.db_service || currentDbService;
  const user = (sysConfig.db_user || currentDbUser || '').toUpperCase();
  const poolMin = parseInt(sysConfig.db_pool_min || currentPoolMin, 10) || 3;
  const poolMax = parseInt(sysConfig.db_pool_max || currentPoolMax, 10) || 15;
  const connectString = `${host}:${port}/${service}`;

  return {
    host,
    port,
    service,
    user,
    hasPassword: Boolean(currentDbPassword),
    poolMin,
    poolMax,
    connectString
  };
}

module.exports = {
  initPool,
  getConnection,
  closePool,
  reconnectPool,
  getOracleConfig,
  thickMode,
  initEscalaAtivaTables,
  getPoolStats
};
