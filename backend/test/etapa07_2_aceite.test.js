const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { requirePermission } = require('../src/core/middlewares/authMiddleware');

let queriesOracle = 0;
// Intercept DB connection BEFORE requiring repository
const database = require('../src/core/database');
const origGetConnection = database.getConnection;
database.getConnection = async () => {
  queriesOracle++;
  return { execute: async () => ({ rows: [] }), close: async () => {} };
};

const recepcaoController = require('../src/modules/recepcao/recepcaoController');
const recepcaoRepository = require('../src/modules/recepcao/recepcaoRepository');
const configCache = require('../src/core/config/configCache');
const tasyReportsClient = require('../src/modules/recepcao/tasyReportsClient');

let chamadasTasy = 0;

describe('Etapa 07.2 - Aceite do Ciclo de Vida do Catálogo', () => {
  let originalGetState, originalGetRelatorios;
  
  beforeEach(() => {
    chamadasTasy = 0;
    queriesOracle = 0;

    let mockState = 'AVAILABLE';
    let mockList = [{ cd_relatorio: 717, ativo: 1 }];

    originalGetState = configCache.getRelatoriosTasyState;
    originalGetRelatorios = configCache.getRelatoriosTasy;

    configCache.getRelatoriosTasyState = () => mockState;
    configCache.getRelatoriosTasy = (ativos) => ativos ? mockList.filter(r => r.ativo) : mockList;

    global.simulateLoad = (success, empty = false, allDisabled = false) => {
      if (!success) {
        mockState = 'UNAVAILABLE';
      } else if (empty) {
        mockState = 'EMPTY';
        mockList = [];
      } else if (allDisabled) {
        mockState = 'ALL_DISABLED';
        mockList = [{ cd_relatorio: 717, ativo: 0 }];
      } else {
        mockState = 'AVAILABLE';
        mockList = [{ cd_relatorio: 717, ativo: 1 }];
      }
    };
    
    tasyReportsClient.gerarRelatorioPdf = async () => {
      chamadasTasy++;
      return { buffer: Buffer.from('pdf'), fileName: 'teste.pdf', contentType: 'application/pdf' };
    };
  });
  
  afterEach(() => {
    configCache.getRelatoriosTasyState = originalGetState;
    configCache.getRelatoriosTasy = originalGetRelatorios;
  });

  const invokeEmissao = async (id, sessionObj) => {
    return new Promise((resolve) => {
      const req = { params: { id }, query: { nr_atendimento: '123' }, session: sessionObj };
      const res = {
        _status: 200,
        headers: {},
        status(code) { this._status = code; return this; },
        json(data) { resolve({ status: this._status, body: data }); },
        setHeader(k, v) { this.headers[k] = v; return this; },
        send(buffer) { resolve({ status: this._status, buffer, headers: this.headers }); }
      };
      const next = (err) => resolve({ status: err?.statusCode || err?.status || 500, body: err?.message || 'Error' });
      requirePermission('recepcao', 'emitir_relatorio')(req, res, () => {
        recepcaoController.gerarRelatorioAtendimento(req, res, next);
      });
    });
  };

  const VALID_SESSION = { usuario: { perfilAtivo: 'enfermagem', nm_usuario: 'teste' } };

  let origAcesso, origPermissao;
  beforeEach(() => {
    origAcesso = configCache.perfilTemAcessoModulo;
    origPermissao = configCache.perfilTemPermissao;
    configCache.perfilTemAcessoModulo = () => true;
    configCache.perfilTemPermissao = () => true;
  });
  afterEach(() => {
    configCache.perfilTemAcessoModulo = origAcesso;
    configCache.perfilTemPermissao = origPermissao;
  });

  it('1. Listagem e Emissão Reais com AppError: Catálogo Disponível', async () => {
    global.simulateLoad(true);
    // Para contornar cache interno de modulos de require, vamos injetar a conexão no repo:
    recepcaoRepository._setConnectionForTest && recepcaoRepository._setConnectionForTest(database.getConnection);
    const lista = await recepcaoRepository.listarRelatoriosAtendimento();
    assert.strictEqual(lista.length, 1);
    
    const res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(chamadasTasy, 1);
  });

  it('2. Listagem e Emissão Reais: Todos Desativados', async () => {
    global.simulateLoad(true, false, true);
    const lista = await recepcaoRepository.listarRelatoriosAtendimento();
    assert.strictEqual(lista.length, 0); 
    
    const res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(chamadasTasy, 0);
  });

  it('3. Cadastro vazio: Emissão Bloqueada com msg simples', async () => {
    global.simulateLoad(true, true);
    const res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 403);
    assert.ok(String(res.buffer).includes('Catálogo de relatórios vazio.'));
    assert.strictEqual(String(res.buffer).includes('decisão institucional pendente'), false);
    assert.strictEqual(chamadasTasy, 0);
  });

  it('4. Falha de recarga após sucesso: emissão bloqueada (HTTP 503)', async () => {
    global.simulateLoad(true);
    let res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 200);

    global.simulateLoad(false);
    res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 503);
    assert.ok(String(res.buffer).includes('Configuração de relatórios indisponível'));
  });

  it('5. Recuperação: catálogo atualizado utilizado', async () => {
    global.simulateLoad(false);
    let res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 503);

    global.simulateLoad(true);
    res = await invokeEmissao('717', VALID_SESSION);
    assert.strictEqual(res.status, 200);
  });
});
