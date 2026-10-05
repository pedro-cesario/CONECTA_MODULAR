const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const configCache = require('../src/core/config/configCache');

describe('Passagem Checkboxes — Integration Tests', () => {
  it('should retrieve seeded intercorrencias checkboxes from SQLite', async () => {
    await configCache.load();
    const list = await configCache.getPassagemCheckboxes();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 9);

    const jejum = list.find(c => c.chave === 'jejum');
    assert.ok(jejum);
    assert.strictEqual(jejum.label, 'Jejum');
    assert.strictEqual(jejum.categoria, 'Nutrição');

    const queda = list.find(c => c.chave === 'queda');
    assert.ok(queda);
    assert.strictEqual(queda.label, 'Queda');
    assert.strictEqual(queda.categoria, 'Segurança');
  });

  it('should create, update, toggle and delete a custom intercorrencia item', async () => {
    await configCache.load();
    const testChave = 'test_intercorrencia_' + Date.now();

    // 1. Create
    const created = await configCache.savePassagemCheckbox({
      chave: testChave,
      label: 'Intercorrência de Teste',
      categoria: 'Testes',
      icone: 'bi-bug',
      ordem: 99,
      ativo: 1
    });
    assert.strictEqual(created.chave, testChave);
    assert.strictEqual(created.label, 'Intercorrência de Teste');

    // 2. Toggle
    const toggled = await configCache.togglePassagemCheckbox(created.id, 0);
    assert.strictEqual(toggled.ativo, 0);

    // 3. Update
    const updated = await configCache.savePassagemCheckbox({
      id: created.id,
      chave: testChave,
      label: 'Intercorrência de Teste Modificada',
      categoria: 'Testes',
      icone: 'bi-bug-fill',
      ordem: 100,
      ativo: 1
    });
    assert.strictEqual(updated.label, 'Intercorrência de Teste Modificada');

    // 4. Delete
    const deleted = await configCache.deletePassagemCheckbox(created.id);
    assert.strictEqual(deleted.success, true);

    const listAfter = await configCache.getPassagemCheckboxes();
    const found = listAfter.find(c => c.id === created.id);
    assert.strictEqual(found, undefined);
  });
});
