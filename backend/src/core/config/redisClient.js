const { createClient } = require('redis');
const dns = require('dns');

let REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
if (REDIS_HOST === 'redis' && process.env.DOCKER_CONTAINER !== 'true') {
  REDIS_HOST = '172.18.0.2';
}

const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'redis_pwd_default';

const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
  },
  password: REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('[Redis] Client Error:', err.message || err));
redisClient.on('connect', () => console.log(`[Redis] Conectado com sucesso em ${REDIS_HOST}:${REDIS_PORT}.`));

// Conecta assíncronamente, sem interromper o servidor
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('[Redis] Erro ao conectar na inicialização:', err.message || err);
  }
})();

module.exports = redisClient;
