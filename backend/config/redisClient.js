const { createClient } = require('redis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'redis_pwd_default';

const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('[Redis] Client Error:', err));
redisClient.on('connect', () => console.log('[Redis] Conectado com sucesso.'));

// Conecta assíncronamente, sem interromper o servidor
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('[Redis] Erro ao conectar na inicialização:', err);
  }
})();

module.exports = redisClient;
