const config = require('../../core/config/nativeSso');

let fetchImpl = globalThis.fetch;

function authError(message, status = 401) {
  return Object.assign(new Error(message), { status });
}

function normalizeToken(token) {
  const value = String(token || '').trim();
  if (!value || value.length > config.maxTokenLength) {
    throw authError('Token Tasy ausente ou inválido.', 401);
  }
  return value.replace(/^Bearer\s+/i, '');
}

function extractUsername(payload) {
  const candidate =
    payload?.medico?.nm_usuario ||
    payload?.data?.nm_usuario ||
    payload?.usuario?.nm_usuario ||
    payload?.nm_usuario;
  const username = String(candidate || '').trim().toLowerCase();
  if (!username || !/^[a-z0-9._-]+$/i.test(username)) {
    throw authError('O validador não devolveu uma identidade Tasy válida.', 401);
  }
  return username;
}

async function validateTasyToken(token) {
  if (!config.enabled) {
    throw authError('SSO do Native não habilitado.', 503);
  }
  if (typeof fetchImpl !== 'function') {
    throw authError('Cliente HTTP indisponível para validar o token Tasy.', 503);
  }
  const normalizedToken = normalizeToken(token);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.validatorTimeoutMs);

  try {
    const response = await fetchImpl(config.validatorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt: normalizedToken }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.success === false) {
      const status = response.status === 401 || response.status === 403 ? 401 : 503;
      throw authError(
        status === 401 ? 'Sessão Tasy inválida ou expirada.' : 'Validador Tasy indisponível.',
        status
      );
    }
    return {
      username: extractUsername(payload),
      validatorStatus: response.status
    };
  } catch (err) {
    if (err.status) throw err;
    if (err.name === 'AbortError') {
      throw authError('Tempo excedido ao validar a sessão Tasy.', 503);
    }
    throw authError('Não foi possível validar a sessão Tasy.', 503);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  extractUsername,
  normalizeToken,
  validateTasyToken,
  _setFetchForTests(candidate) {
    fetchImpl = candidate;
  },
  _resetFetchForTests() {
    fetchImpl = globalThis.fetch;
  }
};
