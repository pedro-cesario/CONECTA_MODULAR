const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const configCache = require('../src/core/config/configCache');

describe('Passagem Checkboxes — Integration Tests', () => {
  it('should retrieve seeded checkboxes from SQLite', async () => {
    await configCache.load();
    const list = await configCache.getPassagemCheckboxes();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 12);

    const dieta = list.find(c => c.chave === 'dieta_zero');
    assert.ok(dieta);
    assert.strictEqual(dieta.label, 'Dieta Zero / Jejum');
    assert.strictEqual(dieta.categoria, 'Nutrição');
  });

  it('should create, update, toggle and delete a custom checkbox', async () => {
    await configCache.load();
    const testChave = 'test_item_temp_' + Date.now();

    // 1. Create
    const created = await configCache.savePassagemCheckbox({
      chave: testChave,
      label: 'Item de Teste Temporário',
      categoria: 'Testes',
      icone: 'bi-bug',
      ordem: 99,
      ativo: 1
    });
    assert.strictEqual(created.chave, testChave);
    assert.strictEqual(created.label, 'Item de Teste Temporário');

    // 2. Toggle
    const toggled = await configCache.togglePassagemCheckbox(created.id, 0);
    assert.strictEqual(toggled.ativo, 0);

    // 3. Update
    const updated = await configCache.savePassagemCheckbox({
      id: created.id,
      chave: testChave,
      label: 'Item de Teste Modificado',
      categoria: 'Testes',
      icone: 'bi-bug-fill',
      ordem: 100,
      ativo: 1
    });
    assert.strictEqual(updated.label, 'Item de Teste Modificado');

    // 4. Delete
    const deleted = await configCache.deletePassagemCheckbox(created.id);
    assert.strictEqual(deleted.success, true);

    const listAfter = await configCache.getPassagemCheckboxes();
    const found = listAfter.find(c => c.id === created.id);
    assert.strictEqual(found, undefined);
  });
});
