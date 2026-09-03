const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const adminController = require('../src/modules/admin/adminController');
const { closePool } = require('../src/core/database');

describe('Infrastructure & Integrations — Integration Tests', () => {
  after(async () => {
    try {
      await closePool();
    } catch (e) {}
  });
  it('should test Oracle connection and return latency and pool status', async () => {
    let responseData = null;

    const req = {};
    const res = {
      status(code) {
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      }
    };

    await adminController.testarConexaoOracle(req, res);

    assert.ok(responseData);
    assert.ok(responseData.data);
    assert.ok(typeof responseData.data.latencyMs === 'number');
    assert.ok(['UP', 'DOWN'].includes(responseData.data.status));
  });

  it('should diagnose a user against TASY and LDAP and return a structured report', async () => {
    let responseData = null;

    const req = {
      body: { username: 'pedro.teles' }
    };
    const res = {
      status(code) {
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      }
    };

    await adminController.diagnosticarUsuarioLdap(req, res);

    assert.ok(responseData);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.data.username, 'pedro.teles');
    assert.ok(responseData.data.tasy);
    assert.ok(responseData.data.ldap);
    assert.ok(Array.isArray(responseData.data.perfisMapeados));
    assert.ok(responseData.data.veredicto);
  });

  it('should reject LDAP diagnosis when username is missing', async () => {
    let responseData = null;
    let statusCode = 200;

    const req = { body: { username: '   ' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      }
    };

    await adminController.diagnosticarUsuarioLdap(req, res);

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.success, false);
  });
});
