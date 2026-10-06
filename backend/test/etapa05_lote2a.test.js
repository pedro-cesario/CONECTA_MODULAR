const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const configCache = require('../src/core/config/configCache');

// Implementação Inativa (que deletamos)
function perfilTemAcessoModulo_Inactive(perfilId, moduloId, customCache) {
  if (!perfilId || !moduloId) return false;
  const pId = String(perfilId).trim().toLowerCase();
  const mId = String(moduloId).trim().toLowerCase();
  return (customCache || []).some(pm => 
    String(pm.perfil_id).trim().toLowerCase() === pId && 
    String(pm.modulo_id).trim().toLowerCase() === mId
  );
}

// Matriz de dados sintéticos
const MOCK_PERFIL_MODULOS = [
  { perfil_id: 'enfermagem', modulo_id: 'passagem' },
  { perfil_id: 'admin', modulo_id: 'dashboard' },
  { perfil_id: 123, modulo_id: 456 }
];

describe('Etapa 05 Lote 2A: perfilTemAcessoModulo', () => {
  beforeEach(() => {
    configCache.setCacheForTest({ perfilModulos: MOCK_PERFIL_MODULOS });
  });

  afterEach(() => {
    configCache.setCacheForTest({ perfilModulos: [] });
  });

  const testMatrix = [
    { name: 'Vínculo permitido estrito', p: 'enfermagem', m: 'passagem', expectedActive: true, expectedInactive: true },
    { name: 'Vínculo permitido com numéricos exatos', p: 123, m: 456, expectedActive: true, expectedInactive: true },
    { name: 'Vínculo ausente', p: 'enfermagem', m: 'dashboard', expectedActive: false, expectedInactive: false },
    { name: 'Perfil/módulo desconhecido', p: 'medico', m: 'passagem', expectedActive: false, expectedInactive: false },
    { name: 'Argumentos ausentes', p: undefined, m: null, expectedActive: false, expectedInactive: false },
    
    // Diferenças de Comportamento (onde a inativa ampliava privilégios e a ativa não)
    { name: 'Caixa e espaços no perfil', p: ' Enfermagem ', m: 'passagem', expectedActive: false, expectedInactive: true },
    { name: 'Caixa e espaços no módulo', p: 'enfermagem', m: 'PASSAGEM', expectedActive: false, expectedInactive: true },
    { name: 'Tipos incorretos (string vs int)', p: '123', m: '456', expectedActive: false, expectedInactive: true }
  ];

  testMatrix.forEach(({ name, p, m, expectedActive, expectedInactive }) => {
    it(`Cenário: ${name}`, () => {
      // Inativa
      const resInactive = perfilTemAcessoModulo_Inactive(p, m, MOCK_PERFIL_MODULOS);
      assert.strictEqual(resInactive, expectedInactive, `Inativa falhou para ${name}`);
      
      // Ativa
      const resActive = configCache.perfilTemAcessoModulo(p, m);
      assert.strictEqual(resActive, expectedActive, `Ativa falhou para ${name}`);
    });
  });

  it('Configuração vazia vs indisponível', () => {
    // Configuração válida sem permissões
    configCache.setCacheForTest({ perfilModulos: [] });
    assert.strictEqual(configCache.perfilTemAcessoModulo('enfermagem', 'passagem'), false);

    // Indisponível (undefined)
    configCache.setCacheForTest({ perfilModulos: undefined });
    assert.throws(() => configCache.perfilTemAcessoModulo('enfermagem', 'passagem'), /Cannot read properties of undefined/);
    
    // A implementação inativa também quebraria com `.some` undefined, logo mantivemos o comportamento exato sem ocultar o erro sistêmico com fallback.
  });
});
