const { describe, it } = require('node:test');
const assert = require('node:assert');
const correlationIdMiddleware = require('../src/core/middlewares/correlationIdMiddleware');

describe('Correlation ID Middleware — Unit Tests', () => {
  it('should generate a new requestId if none provided', () => {
    const req = { headers: {} };
    const headersSent = {};
    const res = {
      setHeader(k, v) { headersSent[k] = v; }
    };
    let nextCalled = false;

    correlationIdMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.ok(typeof req.requestId === 'string' && req.requestId.length > 0);
    assert.strictEqual(headersSent['X-Request-Id'], req.requestId);
  });

  it('should reuse existing incoming X-Request-Id header', () => {
    const req = { headers: { 'x-request-id': 'custom-hospital-uuid-999' } };
    const headersSent = {};
    const res = {
      setHeader(k, v) { headersSent[k] = v; }
    };

    correlationIdMiddleware(req, res, () => {});

    assert.strictEqual(req.requestId, 'custom-hospital-uuid-999');
    assert.strictEqual(headersSent['X-Request-Id'], 'custom-hospital-uuid-999');
  });
});
