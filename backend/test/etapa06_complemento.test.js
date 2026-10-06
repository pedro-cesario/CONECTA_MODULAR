const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { requireAuth } = require('../src/core/middlewares/authMiddleware');
const configCache = require('../src/core/config/configCache');

// We test the route handler logic by extracting it or simulating Express routing.
// Since we don't have supertest, we mock req, res, next.

const getModulosHandler = (req, res) => {
  const modulos = configCache.getAllModulosWithPermissoes();
  const usuario = req.session?.usuario;
  const perfisDisponiveis = new Set((usuario?.perfisDisponiveis || []).map(p => String(p.id)));

  const projecao = modulos.map(mod => ({
    ...mod,
    perfisPermitidos: (mod.perfisPermitidos || []).filter(pId => perfisDisponiveis.has(String(pId)))
  }));

  res.json({ success: true, data: projecao });
};

describe('Etapa 06 - Complemento: Cadeia de Middlewares /api/modulos', () => {
  let originalGetAll;
  
  beforeEach(() => {
    originalGetAll = configCache.getAllModulosWithPermissoes;
    configCache.getAllModulosWithPermissoes = () => [
      { id: 'passagem', perfisPermitidos: ['enfermagem', 'medico', 'admin'] }
    ];
  });
  
  afterEach(() => {
    configCache.getAllModulosWithPermissoes = originalGetAll;
  });

  it('HTTP 401 para ausência de sessão no middleware', (t, done) => {
    const req = { session: null };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        assert.strictEqual(this.statusCode, 401);
        assert.strictEqual(data.message, 'Sessão expirada. Faça login novamente.');
        done();
      }
    };
    requireAuth(req, res, () => {
      assert.fail('Next should not be called');
    });
  });

  it('Sessão válida permite acesso e aciona o handler projetado', (t, done) => {
    const req = { 
      session: { 
        usuario: { perfisDisponiveis: [{ id: 'enfermagem' }], perfilAtivo: 'enfermagem' } 
      } 
    };
    const res = {
      json(data) {
        assert.strictEqual(data.success, true);
        assert.deepStrictEqual(data.data[0].perfisPermitidos, ['enfermagem']);
        done();
      }
    };
    
    // Simulate chain:
    requireAuth(req, res, () => {
      getModulosHandler(req, res);
    });
  });
});
