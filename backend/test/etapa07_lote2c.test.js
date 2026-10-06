const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { requirePermission } = require('../src/core/middlewares/authMiddleware');
const recepcaoController = require('../src/modules/recepcao/recepcaoController');
const configCache = require('../src/core/config/configCache');
const tasyReportsClient = require('../src/modules/recepcao/tasyReportsClient');

let chamadasTasy = 0;
const app = express();

const MOCK_CONFIG = [
  { cd_relatorio: 717, nr_sequencia: 111, ds_titulo: 'Ativo via DB', ativo: 1 },
  { cd_relatorio: 999, nr_sequencia: 222, ds_titulo: 'Desativado via DB', ativo: 0 },
  { cd_relatorio: 70125, nr_sequencia: 333, ds_titulo: 'Colisao TISS Ativa', ativo: 1 }
];

describe('Etapa 07 - Lote 2C: Catálogo Autorizado de Relatórios', () => {
  let originalGetRelatorios, originalGetRelatoriosState, originalGerarPdf;
  
  beforeEach(() => {
    chamadasTasy = 0;
    
    originalGetRelatorios = configCache.getRelatoriosTasy;
    originalGetRelatoriosState = configCache.getRelatoriosTasyState;
    configCache.getRelatoriosTasyState = () => 'LOADED';
    configCache.getRelatoriosTasy = (apenasAtivos) => {
      if (apenasAtivos === 'FALHA') return undefined; 
      if (apenasAtivos) return MOCK_CONFIG.filter(r => r.ativo === 1);
      return MOCK_CONFIG;
    };
    
    originalGerarPdf = tasyReportsClient.gerarRelatorioPdf;
    tasyReportsClient.gerarRelatorioPdf = async () => {
      chamadasTasy++;
      return { buffer: Buffer.from('pdf'), fileName: 'teste.pdf', contentType: 'application/pdf' };
    };
  });
  
  afterEach(() => {
    configCache.getRelatoriosTasy = originalGetRelatorios;
    configCache.getRelatoriosTasyState = originalGetRelatoriosState;
    tasyReportsClient.gerarRelatorioPdf = originalGerarPdf;
  });

  const invokeRoute = async (id, sessionObj, query = { nr_atendimento: '123' }) => {
    return new Promise((resolve) => {
      const req = {
        params: { id },
        query,
        session: sessionObj,
      };
      const res = {
        _status: 200,
        headers: {},
        status(code) { this._status = code; return this; },
        json(data) { resolve({ status: this._status, body: data }); },
        setHeader(k, v) { this.headers[k] = v; return this; },
        send(buffer) { resolve({ status: this._status, buffer, headers: this.headers }); }
      };
      
      const next = (err) => {
         if (err) resolve({ status: err.status || 500, body: err.message });
         else resolve({ status: 500, body: 'Next without error' });
      };

      requirePermission('recepcao', 'emitir_relatorio')(req, res, () => {
        recepcaoController.gerarRelatorioAtendimento(req, res, next);
      });
    });
  };

  const VALID_SESSION = {
    usuario: { perfilAtivo: 'enfermagem', nm_usuario: 'teste' }
  };

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

  it('Sem sessão (HTTP 401)', async () => {
    const response = await invokeRoute('717', null);
    assert.strictEqual(response.status, 401);
  });

  it('Sem permissão emitir_relatorio (HTTP 403 via middleware)', async () => {
    const response = await invokeRoute('717', { usuario: { perfilAtivo: 'medico' } });
    assert.strictEqual(response.status, 403);
  });

  it('ID válido e disponível no banco', async () => {
    const response = await invokeRoute('717', VALID_SESSION);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(chamadasTasy, 1);
  });

  it('ID desconhecido', async () => {
    const response = await invokeRoute('888', VALID_SESSION);
    assert.strictEqual(response.status, 403);
  });

  it('ID desativado (999)', async () => {
    const response = await invokeRoute('999', VALID_SESSION);
    assert.strictEqual(response.status, 403);
  });

  it('ID malformado, vazio, negativo ou fracionário', async () => {
    const ids = ['123abc', '-717', '717.5', ' ', ''];
    for (const id of ids) {
      const response = await invokeRoute(id, VALID_SESSION);
      assert.strictEqual(response.status, 400);
    }
  });

  it('Cadastro e constante com o mesmo ID (Colisão TISS)', async () => {
    const response = await invokeRoute('70125', VALID_SESSION);
    assert.strictEqual(response.status, 200);
  });


  it('Falha do TasyAppServer simulado', async () => {
    tasyReportsClient.gerarRelatorioPdf = async () => {
      chamadasTasy++;
      throw new Error('TasyAppServer indisponível');
    };
    const res = await invokeRoute('717', VALID_SESSION);
    assert.strictEqual(res.status, 500);
    assert.ok(String(res.buffer).includes('TasyAppServer indisponível'));
  });
});
