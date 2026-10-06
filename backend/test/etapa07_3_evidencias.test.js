const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mocks
const database = require('../src/core/database');
let queriesOracle = 0;
database.getConnection = async () => {
  queriesOracle++;
  return { execute: async () => ({ rows: [] }), close: async () => {} };
};

const tasyReportsClient = require('../src/modules/recepcao/tasyReportsClient');
let chamadasTasy = 0;
tasyReportsClient.gerarRelatorioPdf = async () => {
  chamadasTasy++;
  return { buffer: Buffer.from('pdf_fake'), fileName: 'teste.pdf', contentType: 'application/pdf' };
};

const configCache = require('../src/core/config/configCache');
const { requirePermission } = require('../src/core/middlewares/authMiddleware');
const recepcaoController = require('../src/modules/recepcao/recepcaoController');
const errorHandler = require('../src/core/middlewares/errorHandler');

let origAcesso, origPermissao;
origAcesso = configCache.perfilTemAcessoModulo;
origPermissao = configCache.perfilTemPermissao;
configCache.perfilTemAcessoModulo = () => true;
configCache.perfilTemPermissao = () => true;

const runExpress = (method, handler, reqArgs) => {
  return new Promise((resolve) => {
    const req = { ...reqArgs };
    const res = {
      _status: 200,
      headers: {},
      status(code) { this._status = code; return this; },
      json(data) { resolve({ status: this._status, body: data }); },
      setHeader(k, v) { this.headers[k] = v; return this; },
      send(buffer) { resolve({ status: this._status, buffer, headers: this.headers }); }
    };
    
    const next = (err) => {
      if (err) {
        errorHandler(err, req, res, () => {
          resolve({ status: res._status || 500, body: 'Unhandled Error' });
        });
      } else {
        resolve({ status: 200, body: 'Next called without error' });
      }
    };
    
    if (handler.name === 'gerarRelatorioAtendimento') {
      requirePermission('recepcao', 'emitir_relatorio')(req, res, () => {
        handler(req, res, next);
      });
    } else {
      handler(req, res, next);
    }
  });
};

const invokeListagem = (session) => runExpress('GET', recepcaoController.listarRelatoriosAtendimento, { session });
const invokeEmissao = (id, session) => runExpress('GET', recepcaoController.gerarRelatorioAtendimento, { params: { id }, query: { nr_atendimento: '123' }, session });

describe('Etapa 07.3 - Contratos HTTP Reais', () => {
  let originalGetState, originalGetTasy;

  beforeEach(() => {
    queriesOracle = 0;
    chamadasTasy = 0;
    
    originalGetState = configCache.getRelatoriosTasyState;
    originalGetTasy = configCache.getRelatoriosTasy;
  });

  afterEach(() => {
    configCache.getRelatoriosTasyState = originalGetState;
    configCache.getRelatoriosTasy = originalGetTasy;
  });

  const setupMockState = (state, list) => {
    configCache.getRelatoriosTasyState = () => state;
    configCache.getRelatoriosTasy = (ativos) => ativos ? list.filter(r => r.ativo) : list;
  };

  const VALID_SESSION = { usuario: { perfilAtivo: 'enfermagem', nm_usuario: 'teste' } };

  it('1. Estado AVAILABLE', async () => {
    setupMockState('AVAILABLE', [{ cd_relatorio: 717, ativo: 1, ds_titulo: 'Teste' }]);
    
    const resList = await invokeListagem(VALID_SESSION);
    assert.strictEqual(resList.status, 200);
    assert.strictEqual(resList.body.data.length, 1);
    
    const resEmissao = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(resEmissao.status, 200);
    assert.strictEqual(chamadasTasy, 1);
  });

  it('2. Estado ALL_DISABLED', async () => {
    setupMockState('ALL_DISABLED', [{ cd_relatorio: 717, ativo: 0, ds_titulo: 'Teste' }]);
    
    const resList = await invokeListagem(VALID_SESSION);
    assert.strictEqual(resList.status, 200);
    assert.deepStrictEqual(resList.body.data, []); // Empty list!
    
    const resEmissao = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(resEmissao.status, 403);
    assert.strictEqual(chamadasTasy, 0); 
  });

  it('3. Estado EMPTY', async () => {
    setupMockState('EMPTY', []);
    
    const resList = await invokeListagem(VALID_SESSION);
    assert.strictEqual(resList.status, 403);
    assert.strictEqual(resList.body.message, 'Catálogo de relatórios vazio.'); 
    
    const resEmissao = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(resEmissao.status, 403);
    assert.ok(String(resEmissao.buffer).includes('Catálogo de relatórios vazio.'));
    assert.strictEqual(chamadasTasy, 0); 
  });

  it('4. Estado UNAVAILABLE', async () => {
    setupMockState('UNAVAILABLE', []);
    
    const resList = await invokeListagem(VALID_SESSION);
    assert.strictEqual(resList.status, 503);
    assert.strictEqual(resList.body.message, 'Configuração de relatórios indisponível.');
    
    const resEmissao = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(resEmissao.status, 503);
    assert.ok(String(resEmissao.buffer).includes('Configuração de relatórios indisponível.'));
    assert.strictEqual(chamadasTasy, 0); 
  });
});
