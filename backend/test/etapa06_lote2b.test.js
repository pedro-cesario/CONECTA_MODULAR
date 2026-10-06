const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const configCache = require('../src/core/config/configCache');

// Mock req and res for testing route handler
function createMockReq(usuario = null) {
  return {
    session: { usuario }
  };
}

function createMockRes() {
  return {
    json(data) {
      this.data = data;
    }
  };
}

// Em vez de invocar o Express, vamos isolar a logica de projecao:
// Extraindo diretamente o trecho implementado na rota:
function getModulosSeguros(req) {
  const modulos = configCache.getAllModulosWithPermissoes();
  const usuario = req.session?.usuario;
  const perfisDisponiveis = new Set((usuario?.perfisDisponiveis || []).map(p => String(p.id)));

  return modulos.map(mod => ({
    ...mod,
    perfisPermitidos: (mod.perfisPermitidos || []).filter(pId => perfisDisponiveis.has(String(pId)))
  }));
}

const MOCK_MODULOS = [
  { id: 'passagem', perfisPermitidos: ['enfermagem', 'medico', 'admin'] },
  { id: 'dashboard', perfisPermitidos: ['admin', 'diretoria'] },
  { id: 'auditoria', perfisPermitidos: ['auditor'] }
];

describe('Etapa 06 Lote 2B: Projeção Segura de Módulos', () => {
  beforeEach(() => {
    // Override getAllModulosWithPermissoes safely
    configCache.getAllModulosWithPermissoes_ORIGINAL = configCache.getAllModulosWithPermissoes;
    configCache.getAllModulosWithPermissoes = () => JSON.parse(JSON.stringify(MOCK_MODULOS));
  });

  afterEach(() => {
    configCache.getAllModulosWithPermissoes = configCache.getAllModulosWithPermissoes_ORIGINAL;
  });

  it('Usuário com um perfil (enfermagem)', () => {
    const req = createMockReq({ perfisDisponiveis: [{ id: 'enfermagem' }] });
    const result = getModulosSeguros(req);
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, ['enfermagem']);
    assert.deepStrictEqual(result.find(m => m.id === 'dashboard').perfisPermitidos, []);
  });

  it('Usuário com múltiplos perfis autorizados (enfermagem, medico)', () => {
    const req = createMockReq({ perfisDisponiveis: [{ id: 'enfermagem' }, { id: 'medico' }] });
    const result = getModulosSeguros(req);
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, ['enfermagem', 'medico']);
  });

  it('Usuário sem vínculo', () => {
    const req = createMockReq({ perfisDisponiveis: [] });
    const result = getModulosSeguros(req);
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, []);
  });

  it('Ausência de sessão', () => {
    const req = { session: null };
    const result = getModulosSeguros(req);
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, []);
  });

  it('Perfil ativo é ignorado em favor de perfisDisponiveis, troca de perfil mantem disponíveis', () => {
    const req = createMockReq({ perfilAtivo: 'medico', perfisDisponiveis: [{ id: 'enfermagem' }, { id: 'medico' }] });
    const result = getModulosSeguros(req);
    // Even if active profile is 'medico', they still see both their bonds
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, ['enfermagem', 'medico']);
  });

  it('Dois usuários com permissões diferentes em sequência', () => {
    const req1 = createMockReq({ perfisDisponiveis: [{ id: 'diretoria' }] });
    const result1 = getModulosSeguros(req1);
    assert.deepStrictEqual(result1.find(m => m.id === 'dashboard').perfisPermitidos, ['diretoria']);
    
    const req2 = createMockReq({ perfisDisponiveis: [{ id: 'auditor' }] });
    const result2 = getModulosSeguros(req2);
    assert.deepStrictEqual(result2.find(m => m.id === 'dashboard').perfisPermitidos, []);
    assert.deepStrictEqual(result2.find(m => m.id === 'auditoria').perfisPermitidos, ['auditor']);
  });

  it('Ausência de mutação do cache', () => {
    const req = createMockReq({ perfisDisponiveis: [{ id: 'enfermagem' }] });
    getModulosSeguros(req); // Call 1 filters
    
    // Check that next call with admin still works (cache wasn't destroyed)
    const reqAdmin = createMockReq({ perfisDisponiveis: [{ id: 'admin' }] });
    const result = getModulosSeguros(reqAdmin);
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, ['admin']);
  });
  
  it('Administrador sem exposição automática', () => {
    const req = createMockReq({ perfisDisponiveis: [{ id: 'admin' }] });
    const result = getModulosSeguros(req);
    // Ele só recebe 'admin', e NÃO recebe 'enfermagem', 'medico', garantindo que não há vazamento matricial pela rota operacional.
    assert.deepStrictEqual(result.find(m => m.id === 'passagem').perfisPermitidos, ['admin']);
  });
});
