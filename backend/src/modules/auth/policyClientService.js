const fs = require('fs');
const path = require('path');

const managerUrl = String(process.env.TASY_NATIVE_MANAGER_URL || 'http://tasymanager.heal.br').replace(/\/+$/, '');
const serviceSecret = String(process.env.POLICY_SERVICE_SECRET || '');
const cacheDir = path.resolve(__dirname, '../../../../data');
const cachePath = path.join(cacheDir, 'policy-cache.json');
const cache = new Map();
let loaded = false;

function cacheKey(feature, context) {
  return [
    feature,
    String(context.username || '').toLowerCase(),
    String(context.clientId || context.client?.clientId || '').toLowerCase(),
    String(context.machineName || context.client?.machineName || '').toLowerCase()
  ].join('|');
}

function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed || {})) cache.set(key, value);
  } catch (_) {}
}

async function saveCache() {
  await fs.promises.mkdir(cacheDir, { recursive: true });
  await fs.promises.writeFile(cachePath, JSON.stringify(Object.fromEntries(cache), null, 2), 'utf8');
}

function fallbackDecision(feature, context) {
  loadCache();
  return cache.get(cacheKey(feature, context)) || {
    feature,
    allowed: false,
    effect: 'deny',
    source: 'outage-no-cache',
    version: null,
    evaluatedAt: new Date().toISOString()
  };
}

const pendingRequests = new Map();

async function evaluate(feature, context = {}) {
  const key = cacheKey(feature, context);

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const promise = (async () => {
    try {
      if (!serviceSecret) throw new Error('POLICY_SERVICE_SECRET ausente');
      const response = await fetch(managerUrl + '/api/access/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-policy-service-secret': serviceSecret
        },
        body: JSON.stringify({
          feature,
          username: context.username,
          groups: context.groups || [],
          client: context.client || {}
        }),
        signal: AbortSignal.timeout(5000)
      });
      const json = await response.json();
      if (!response.ok || !json.success || !json.data?.[feature]) {
        throw new Error(json.message || `Manager HTTP ${response.status}`);
      }
      const decision = json.data[feature];
      loadCache();
      cache.set(key, decision);
      saveCache().catch(() => {});
      return decision;
    } catch (err) {
      console.warn(`[Policy] Manager indisponivel: ${err.message}. Usando ultima decisao valida.`);
      return fallbackDecision(feature, context);
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

async function requireAccess(feature, context) {
  const decision = await evaluate(feature, context);
  if (!decision.allowed) {
    const error = new Error('Acesso ao Conecta bloqueado pela politica central.');
    error.status = 403;
    error.code = 'FEATURE_ACCESS_DENIED';
    throw error;
  }
  return decision;
}

module.exports = { evaluate, requireAccess };
