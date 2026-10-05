const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const configCache = require('../src/core/config/configCache');

describe('Painel Conecta TV & Guichês — Unit Tests', () => {

  before(async () => {
    await configCache.load();
  });

  describe('Resolução de Mapeamento de Máquinas', () => {
    it('deve retornar mapeamento cadastrado ou fallback seguro', () => {
      const mapping = configCache.getMaquinaGuiche('NOTE-CESARIO');
      if (mapping) {
        assert.ok(mapping.ds_guiche);
      }
    });

    it('deve listar painéis de TV cadastrados no SQLite', () => {
      const paineis = configCache.getPaineisTv();
      assert.ok(Array.isArray(paineis));
      assert.ok(paineis.length > 0);
      assert.strictEqual(paineis[0].id, 'recepcao_principal');
    });

    it('deve buscar painel por ID slug corretamente', () => {
      const painel = configCache.getPainelTvById('recepcao_principal');
      assert.ok(painel);
      assert.strictEqual(painel.id, 'recepcao_principal');
      assert.strictEqual(painel.ativo, 1);
    });
  });

});
