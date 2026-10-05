const { describe, it } = require('node:test');
const assert = require('node:assert');
const { insertAuditLog, queryAuditLogs } = require('../src/core/database/auditDatabase');

describe('LGPD Audit Trail — Integration Tests', () => {
  it('should insert and retrieve audit logs from SQLite', async () => {
    const testEntry = {
      timestamp: new Date().toISOString(),
      requestId: 'test-req-12345',
      cdUsuario: '999',
      nmUsuario: 'teste.unitario',
      perfil: 'enfermagem',
      action: 'TESTE_UNITARIO_AUDITORIA',
      resourceType: 'PACIENTE',
      resourceId: '778899',
      details: { teste: true },
      ip: '127.0.0.1',
      userAgent: 'NodeTestRunner'
    };

    const insertedId = await insertAuditLog(testEntry);
    assert.ok(insertedId > 0, 'Should return positive inserted ID');

    const logs = await queryAuditLogs({ usuario: 'teste.unitario', limit: 5 });
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length > 0);
    assert.strictEqual(logs[0].action, 'TESTE_UNITARIO_AUDITORIA');
    assert.strictEqual(logs[0].resource_type, 'PACIENTE');
    assert.strictEqual(logs[0].resource_id, '778899');
  });
});
