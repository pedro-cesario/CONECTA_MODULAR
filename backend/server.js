const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const RedisStore = require('connect-redis').default;
const { RedisStore: RateLimitRedisStore } = require('rate-limit-redis');
const redisClient = require('./src/core/config/redisClient');

const { initPool, closePool, initEscalaAtivaTables } = require('./src/core/database');
const routes = require('./src/routes');
const errorHandler = require('./src/core/middlewares/errorHandler');
const responseHandler = require('./src/core/middlewares/responseHandler');
const correlationIdMiddleware = require('./src/core/middlewares/correlationIdMiddleware');
const logger = require('./src/core/utils/logger');
const dashboardService = require('./src/modules/dashboard/dashboardService');
const { parseBoolean } = require('./src/core/utils/parseBoolean');
const configCache = require('./src/core/config/configCache');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(correlationIdMiddleware);

// HTTP Access Logging com Correlation ID
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.http(req, res, durationMs);
  });
  next();
});

const dbRequiredOnStartup = parseBoolean(process.env.DB_REQUIRED_ON_STARTUP, true);

// Trust Proxy
const TRUST_PROXY = process.env.TRUST_PROXY || false;
if (TRUST_PROXY === 'true' || TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
} else if (TRUST_PROXY) {
  // Can be configured to a specific number of hops or IPs
  app.set('trust proxy', isNaN(TRUST_PROXY) ? TRUST_PROXY : parseInt(TRUST_PROXY));
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = ALLOWED_ORIGINS.length > 0
  ? { origin: ALLOWED_ORIGINS, credentials: true }
  : { origin: false };

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));

// Limiter com Redis Store
const createRedisLimiterStore = (prefix) => new RateLimitRedisStore({
  sendCommand: (...args) => redisClient.sendCommand(args),
  prefix: prefix
});

const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 600, // Padrão de 600
  store: createRedisLimiterStore('rl:global:'),
  keyGenerator: (req) => {
    // Autenticados tem limite próprio de 600/15min, não autenticados limitados por IP (100)
    if (req.session && req.session.userId) return `limit:auth:${req.session.userId}`;
    return `limit:ip:${req.ip}`;
  }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 20,
  store: createRedisLimiterStore('rl:login:'),
  keyGenerator: (req) => `login:${req.ip}:${req.body?.username || 'unknown'}`
});
app.use('/api/login', loginLimiter);

const nativeSsoLimiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 30,
  store: createRedisLimiterStore('rl:sso:'),
  keyGenerator: (req) => `sso:${req.ip}`
});
app.use('/api/native-sso', nativeSsoLimiter);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(responseHandler);

// Aplica no-cache apenas para rotas da API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('[Server] ERRO: SESSION_SECRET não definido. Defina a variável de ambiente.');
  process.exit(1);
}

const SESSION_TTL = parseInt(process.env.SESSION_TTL_HOURS || '12') * 3600;

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:', ttl: SESSION_TTL }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    expires: false,
    sameSite: 'lax',
    secure: parseBoolean(process.env.COOKIE_SECURE, false)
  },
  name: 'connect.sid'
}));

const APP_VERSION = require('../package.json').version.replace(/\./g, '');

// Cache busting: injeta versão do package.json nos query strings dos HTMLs
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();

  let filePath;
  if (req.path === '/' || req.path === '') {
    filePath = path.join(__dirname, '../frontend/index.html');
  } else if (req.path === '/studio' || req.path === '/builder') {
    filePath = path.join(__dirname, '../frontend/builder.html');
  } else if (req.path.endsWith('.html')) {
    filePath = path.join(__dirname, '../frontend', req.path);
  } else {
    return next();
  }

  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return next();

    const busted = html.replace(/\?v=[^"'\s]*/g, `?v=${APP_VERSION}`);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(busted);
  });
});

// Servir arquivos estáticos (JS, CSS, imagens) com validação de cache
app.use(express.static(path.join(__dirname, '../frontend'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.set('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.set('Cache-Control', 'public, max-age=86400');
    }
  }
}));

const { getPoolStats, getConnection } = require('./src/core/database');

app.get('/health', async (req, res) => {
  const health = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    services: {
      redis: 'DOWN',
      oracle: 'DOWN'
    }
  };
  let isDown = false;

  try {
    if (redisClient.isReady) {
      health.services.redis = 'UP';
    } else {
      isDown = true;
    }
  } catch (e) {
    isDown = true;
  }

  try {
    const conn = await getConnection();
    health.services.oracle = 'UP';
    await conn.close();
  } catch (e) {
    isDown = true;
    health.oracleError = e.message;
  }

  if (isDown) {
    health.status = 'DOWN';
    return res.status(503).json(health);
  }
  res.json(health);
});

app.get('/metrics', (req, res) => {
  const adminIp = req.ip;
  // Simples proteção, em produção pode ser melhorada
  
  const poolStats = getPoolStats();
  const memUsage = process.memoryUsage();
  
  res.json({
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    },
    oraclePool: poolStats || { error: 'Pool not initialized' },
    redisReady: redisClient.isReady
  });
});

app.use('/api', routes);

// Qualquer rota /api que não foi tratada retorna 404 JSON, evitando retornar HTML do index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Rota da API não encontrada: ${req.method} ${req.originalUrl}` });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Middleware Centralizado de Tratamento de Erros
app.use(errorHandler);

async function start() {
  try {
    await configCache.load();
    const metadata = configCache.getCacheMetadata();
    console.log(`[ConfigCache] Cache carregado: ${metadata.perfisCount} perfis, ${metadata.modulosCount} módulos, ${metadata.permissoesCount} permissões`);
  } catch (err) {
    console.error('[ConfigCache] Erro ao carregar cache:', err.message);
  }

  try {
    await initPool();
    console.log('[DB] Conexão Oracle estabelecida');

    await initEscalaAtivaTables();

    const prewarmSetores = process.env.DASHBOARD_CACHE_PREWARM_SETORES;
    if (prewarmSetores) {
      dashboardService.prewarmDashboardCache(prewarmSetores).catch(() => {});
    }
  } catch (err) {
    console.error('[DB] Erro ao validar conexão Oracle na inicialização:', err.message);
    if (dbRequiredOnStartup) {
      console.error('[DB] Encerrando aplicação porque DB_REQUIRED_ON_STARTUP=true.');
      process.exit(1);
    }
    console.warn('[DB] Continuando sem Oracle (DB_REQUIRED_ON_STARTUP=false). Funcionalidades limitadas.');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[Servidor] Conecta Heal rodando em http://localhost:${PORT}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Servidor] ERRO: Porta ${PORT} já está em uso!`);
      process.exit(1);
    }
  });

  const gracefulShutdown = async (signal) => {
    console.log(`\n[Shutdown] Recebido ${signal}. Iniciando graceful shutdown...`);
    
    server.close(async (err) => {
      if (err) console.error('[Shutdown] Erro ao fechar servidor HTTP:', err);
      else console.log('[Shutdown] Servidor HTTP fechado. Não aceitando novas requisições.');

      try {
        await closePool();
        console.log('[Shutdown] Conexões Oracle encerradas.');
      } catch (poolErr) {
        console.error('[Shutdown] Erro ao fechar Oracle:', poolErr);
      }

      try {
        if (redisClient.isOpen) {
          await redisClient.quit();
          console.log('[Shutdown] Conexão Redis encerrada.');
        }
      } catch (redisErr) {
        console.error('[Shutdown] Erro ao fechar Redis:', redisErr);
      }

      console.log('[Shutdown] Processo finalizado de forma segura.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start();
