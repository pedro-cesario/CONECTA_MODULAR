const { describe, it } = require('node:test');
const assert = require('node:assert');

// Simulate the configCache.js logic exactly as it is in the real file
let relatoriosTasyDisponivel = true;
let cache = {
  relatoriosTasy: [{ cd_relatorio: 717, ativo: 1 }]
};

function getRelatoriosTasyState() {
  if (!relatoriosTasyDisponivel || cache.relatoriosTasy === undefined) return 'UNAVAILABLE';
  if (cache.relatoriosTasy.length === 0) return 'EMPTY';
  const ativos = cache.relatoriosTasy.filter(r => r.ativo === 1);
  if (ativos.length === 0) return 'ALL_DISABLED';
  return 'AVAILABLE';
}

const simulateLoad = async (shouldFail, delayMs = 50) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        if (shouldFail) throw new Error('DB DOWN');
        // emulate success load
        cache = {
          relatoriosTasy: [{ cd_relatorio: 999, ativo: 1 }] // new ID
        };
        relatoriosTasyDisponivel = true;
        resolve(true);
      } catch (err) {
        relatoriosTasyDisponivel = false;
        resolve(false);
      }
    }, delayMs);
  });
};

describe('Etapa 07.3 - Ciclo de Vida e Concorrência Real', () => {
  
  it('1. Consulta ocorrendo durante recarga preserva o estado anterior intacto', async () => {
    // Before load
    assert.strictEqual(getRelatoriosTasyState(), 'AVAILABLE');
    assert.strictEqual(cache.relatoriosTasy[0].cd_relatorio, 717);

    // Start load, but do not await yet
    const loadPromise = simulateLoad(false, 50);

    // Concurrently read state!
    assert.strictEqual(getRelatoriosTasyState(), 'AVAILABLE', 'Durante a recarga, o estado anterior é preservado');
    assert.strictEqual(cache.relatoriosTasy[0].cd_relatorio, 717, 'Durante a recarga, o cache antigo responde (717)');

    // Wait for load to finish
    const success = await loadPromise;
    assert.strictEqual(success, true);

    // After load
    assert.strictEqual(getRelatoriosTasyState(), 'AVAILABLE');
    assert.strictEqual(cache.relatoriosTasy[0].cd_relatorio, 999, 'Após recarga, o novo cache responde (999)');
  });

  it('2. Recarga falha, estado cai; Próxima recarga sucesso, estado sobe', async () => {
    // Start load that fails
    const failPromise = simulateLoad(true, 10);
    await failPromise;

    // After failure
    assert.strictEqual(getRelatoriosTasyState(), 'UNAVAILABLE', 'Após falha de recarga, estado vira UNAVAILABLE imediatamente');
    // Notice that cache object still holds 999! But relatoriosTasyDisponivel is false.
    assert.strictEqual(cache.relatoriosTasy[0].cd_relatorio, 999);

    // Now start a successful load
    const successPromise = simulateLoad(false, 10);
    await successPromise;

    // After recovery
    assert.strictEqual(getRelatoriosTasyState(), 'AVAILABLE', 'Após nova carga sucesso, volta para AVAILABLE');
  });
});
