const test = require('node:test');
const assert = require('node:assert/strict');

const nativeSsoService = require('../services/nativeSsoService');
const ldapService = require('../services/ldapService');
const authController = require('./authController');
const controller = require('./nativeSsoController');

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('creates a Conecta session using the validated Tasy username and LDAP groups', async t => {
  const originals = {
    validate: nativeSsoService.validateTasyToken,
    groups: ldapService.getUserGroupsAsAdmin,
    session: authController.createAuthenticatedSession
  };
  t.after(() => {
    nativeSsoService.validateTasyToken = originals.validate;
    ldapService.getUserGroupsAsAdmin = originals.groups;
    authController.createAuthenticatedSession = originals.session;
  });

  nativeSsoService.validateTasyToken = async token => {
    assert.equal(token, 'valid-token');
    return { username: 'pedro.cesario' };
  };
  ldapService.getUserGroupsAsAdmin = async username => {
    assert.equal(username, 'pedro.cesario');
    return ['API_CONECTA_ASSISTENCIAL_ENF'];
  };
  authController.createAuthenticatedSession = async (_req, username, groups, metadata) => {
    assert.equal(username, 'pedro.cesario');
    assert.deepEqual(groups, ['API_CONECTA_ASSISTENCIAL_ENF']);
    assert.deepEqual(metadata, {
      source: 'native_sso',
      client: { clientId: 'native-test', machineName: 'PC-TESTE' }
    });
    return { nm_usuario: username, acesso_enfermagem: true };
  };

  const req = {
    body: {
      tasy_token: 'valid-token',
      client: { clientId: 'native-test', machineName: 'PC-TESTE' }
    }
  };
  const res = createResponse();
  await controller.login(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.nm_usuario, 'pedro.cesario');
});
