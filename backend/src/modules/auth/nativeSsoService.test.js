const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../../core/config/nativeSso');
const service = require('./nativeSsoService');

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test('validates the Tasy token and normalizes the returned username', async t => {
  config.enabled = true;
  service._setFetchForTests(async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { jwt: 'valid-token' });
    return response(200, {
      success: true,
      medico: { nm_usuario: 'Pedro.Cesario' }
    });
  });
  t.after(() => service._resetFetchForTests());

  const identity = await service.validateTasyToken('Bearer valid-token');
  assert.equal(identity.username, 'pedro.cesario');
});

test('rejects invalid or expired Tasy tokens', async t => {
  config.enabled = true;
  service._setFetchForTests(async () => response(401, {
    success: false,
    message: 'expired'
  }));
  t.after(() => service._resetFetchForTests());

  await assert.rejects(
    service.validateTasyToken('expired-token'),
    error => error.status === 401 && /inválida ou expirada/.test(error.message)
  );
});

test('fails closed when the validator is unavailable', async t => {
  config.enabled = true;
  service._setFetchForTests(async () => {
    throw new Error('connection refused');
  });
  t.after(() => service._resetFetchForTests());

  await assert.rejects(
    service.validateTasyToken('valid-looking-token'),
    error => error.status === 503 && /Não foi possível validar/.test(error.message)
  );
});

test('rejects a validator response without a valid Tasy username', async t => {
  config.enabled = true;
  service._setFetchForTests(async () => response(200, {
    success: true,
    medico: { nm_usuario: '<script>' }
  }));
  t.after(() => service._resetFetchForTests());

  await assert.rejects(
    service.validateTasyToken('valid-token'),
    error => error.status === 401 && /identidade Tasy válida/.test(error.message)
  );
});
