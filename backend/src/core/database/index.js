const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

const instantClientPath = '/opt/oracle/instantclient';
let thickMode = false;

try {
  const fs = require('fs');
  if (fs.existsSync(instantClientPath)) {
    const files = fs.readdirSync(instantClientPath);
    if (files.includes('libclntsh.so.19.1')) {
      oracledb.initOracleClient({ libDir: instantClientPath });
      thickMode = true;
      console.log('[Oracle] Modo Thick ativado - Instant Client 19c');
    }
  }
} catch (err) {
  if (!err.message.includes('already initialized')) {
    console.warn('[Oracle] Erro ao carregar Instant Client:', err.message);
  } else {
    thickMode = true;
  }
}

const dbUser = ((process.env.DB_USER || '').trim()).toUpperCase();
const dbPassword = (process.env.DB_PASSWORD || '').trim();
const dbHost = (process.env.DB_HOST || '').trim();
const dbPort = (process.env.DB_PORT || '1521').trim();
const dbService = (process.env.DB_SERVICE || '').trim();

const connectString = `${dbHost}:${dbPort}/${dbService}`;

console.log('[Oracle] Modo:', thickMode ? 'Thick' : 'Thin');
console.log('[Oracle] Connect:', connectString);

let pool;

async function initPool() {
  if (!pool) {
    console.log('[Oracle] Criando pool...');
    try {
      const poolMin = parseInt(process.env.DB_POOL_MIN || '3');
      const poolMax = parseInt(process.env.DB_POOL_MAX || '15');
      const poolIncrement = parseInt(process.env.DB_POOL_INCREMENT || '2');
      const queueTimeout = parseInt(process.env.DB_QUEUE_TIMEOUT || '10') * 1000;
      const poolTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || '60');

      pool = await oracledb.createPool({
        user: dbUser,
        password: dbPassword,
        connectString: connectString,
        poolMin: poolMin,
        poolMax: poolMax,
        poolIncrement: poolIncrement,
        poolTimeout: poolTimeout,
        queueTimeout: queueTimeout
      });
      console.log(`[Oracle] Pool criado (min:${poolMin}, max:${poolMax}, inc:${poolIncrement})`);
    } catch (err) {
      console.error('[Oracle] Erro ao criar pool:', err.message);
      throw err;
    }
  }
  return pool;
}

async function getConnection() {
  if (!pool) await initPool();
  return pool.getConnection();
}

async function closePool() {
  if (pool) {
    await pool.close(0);
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

module.exports = { initPool, getConnection, closePool, thickMode, initEscalaAtivaTables, getPoolStats };
