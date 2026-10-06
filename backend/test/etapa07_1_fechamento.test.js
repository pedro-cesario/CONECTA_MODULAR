const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { requirePermission } = require('../src/core/middlewares/authMiddleware');
const recepcaoController = require('../src/modules/recepcao/recepcaoController');
const recepcaoRepository = require('../src/modules/recepcao/recepcaoRepository');
const configCache = require('../src/core/config/configCache');
const tasyReportsClient = require('../src/modules/recepcao/tasyReportsClient');

let chamadasTasy = 0;
let queriesOracle = 0;

// Injection on the internal connection getter just to ensure no connections are made where they shouldn't
const origGetConnection = require('../src/core/database').getConnection;
require('../src/core/database').getConnection = async () => {
  queriesOracle++;
  return { execute: async () => {}, close: async () => {} };
};

describe('Etapa 07.1 - Fechamento do Catálogo de Relatórios', () => {
  let originalGetRelatoriosTasy, originalGetRelatoriosState, originalGerarPdf;
  
  beforeEach(() => {
    chamadasTasy = 0;
    queriesOracle = 0;
    
    // We will control state through this variable inside the test
    let mockRelatorios = [];
    let mockState = 'UNAVAILABLE';
    
    global.setMockConfig = (state, rels = []) => {
      mockState = state;
      mockRelatorios = rels;
    };

    originalGetRelatoriosTasy = configCache.getRelatoriosTasy;
    originalGetRelatoriosState = configCache.getRelatoriosTasyState;
    
    configCache.getRelatoriosTasyState = () => mockState;
    configCache.getRelatoriosTasy = (apenasAtivos) => {
      if (apenasAtivos) return mockRelatorios.filter(r => r.ativo === 1);
      return mockRelatorios;
    };
    
    originalGerarPdf = tasyReportsClient.gerarRelatorioPdf;
    tasyReportsClient.gerarRelatorioPdf = async () => {
      chamadasTasy++;
      return { buffer: Buffer.from('pdf'), fileName: 'teste.pdf', contentType: 'application/pdf' };
    };
  });
  
  afterEach(() => {
    configCache.getRelatoriosTasy = originalGetRelatoriosTasy;
    configCache.getRelatoriosTasyState = originalGetRelatoriosState;
    tasyReportsClient.gerarRelatorioPdf = originalGerarPdf;
  });

  const invokeRoute = async (id, sessionObj, query = { nr_atendimento: '123' }) => {
    return new Promise((resolve) => {
      const req = { params: { id }, query, session: sessionObj };
      const res = {
        _status: 200,
        headers: {},
        status(code) { this._status = code; return this; },
        json(data) { resolve({ status: this._status, body: data }); },
        setHeader(k, v) { this.headers[k] = v; return this; },
        send(buffer) { resolve({ status: this._status, buffer, headers: this.headers }); }
      };
      const next = (err) => resolve({ status: err?.status || 500, body: err?.message || 'Error' });
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
    configCache.perfilTemAcessoModulo = (p, m) => m === 'recepcao' && p === 'enfermagem';
    configCache.perfilTemPermissao = (p, m, perm) => m === 'recepcao' && perm === 'emitir_relatorio' && p === 'enfermagem';
  });
  afterEach(() => {
    configCache.perfilTemAcessoModulo = origAcesso;
    configCache.perfilTemPermissao = origPermissao;
  });

  it('1. Catálogo carregado com ID ativo (Emissão válida)', async () => {
    global.setMockConfig('AVAILABLE', [{ cd_relatorio: 717, ativo: 1 }]);
    const res = await invokeRoute('717', VALID_SESSION);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(chamadasTasy, 1);
  });

  it('2. ID desativado quando existem outros ativos', async () => {
    global.setMockConfig('AVAILABLE', [{ cd_relatorio: 717, ativo: 1 }, { cd_relatorio: 999, ativo: 0 }]);
    const res = await invokeRoute('999', VALID_SESSION);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Relatório não autorizado ou não disponível no catálogo vigente');
    assert.strictEqual(chamadasTasy, 0);
  });

  it('3. Todos desativados, inclusive IDs presentes nas constantes', async () => {
    // 70125 is in constants. If all disabled, state is ALL_DISABLED.
    global.setMockConfig('ALL_DISABLED', [{ cd_relatorio: 70125, ativo: 0 }]);
    const res = await invokeRoute('70125', VALID_SESSION);
    assert.strictEqual(res.status, 403);
    // Devemos usar a mesma base
    assert.deepStrictEqual(recepcaoRepository.obterCatalogoBase(), []);
    assert.strictEqual(chamadasTasy, 0);
  });

  it('4. Cadastro vazio (decisão institucional)', async () => {
    global.setMockConfig('EMPTY', []);
    const res = await invokeRoute('70125', VALID_SESSION);
    // Controller catches error from obterCatalogoBase
    assert.strictEqual(res.status, 403);
    assert.ok(String(res.buffer).includes('Catálogo de relatórios vazio.'));
  });

  it('5. Configuração indisponível', async () => {
    global.setMockConfig('UNAVAILABLE', []);
    const res = await invokeRoute('70125', VALID_SESSION);
    assert.strictEqual(res.status, 503);
    assert.ok(String(res.buffer).includes('Configuração de relatórios indisponível.'));
  });

  it('6. Colisão entre cadastro desativado e constante (Não deve usar constante)', async () => {
    // 70125 is in constants but disabled in DB. Because state ALL_DISABLED, no constants fallback
    global.setMockConfig('ALL_DISABLED', [{ cd_relatorio: 70125, ativo: 0 }]);
    const res = await invokeRoute('70125', VALID_SESSION);
    assert.strictEqual(res.status, 403);
  });

  it('7. ID desconhecido, malformado e acima do inteiro seguro', async () => {
    global.setMockConfig('AVAILABLE', [{ cd_relatorio: 717, ativo: 1 }]);
    const cases = [
      { id: '888', code: 403 }, // desconhecido
      { id: '123abc', code: 400 }, // malformado
      { id: '9007199254740992', code: 400 } // MAX_SAFE_INTEGER + 1
    ];
    for (const c of cases) {
      const res = await invokeRoute(c.id, VALID_SESSION);
      assert.strictEqual(res.status, c.code);
    }
  });

  it('8. Ausência de sessão e de permissão', async () => {
    global.setMockConfig('AVAILABLE', [{ cd_relatorio: 717, ativo: 1 }]);
    const resAuth = await invokeRoute('717', null);
    assert.strictEqual(resAuth.status, 401);
    
    const resPerm = await invokeRoute('717', { usuario: { perfilAtivo: 'outro' } });
    assert.strictEqual(resPerm.status, 403);
    assert.strictEqual(chamadasTasy, 0);
  });

  it('9. Emissão válida e falha simulada do TasyAppServer', async () => {
    global.setMockConfig('AVAILABLE', [{ cd_relatorio: 717, ativo: 1 }]);
    tasyReportsClient.gerarRelatorioPdf = async () => {
      chamadasTasy++;
      throw new Error('Falha TasyAppServer Interna');
    };
    const res = await invokeRoute('717', VALID_SESSION);
    assert.strictEqual(res.status, 500);
    assert.ok(String(res.buffer).includes('Falha TasyAppServer Interna'));
    assert.strictEqual(chamadasTasy, 1);
  });
});
