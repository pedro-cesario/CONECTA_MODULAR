const { describe, it } = require('node:test');
const assert = require('node:assert');
const recepcaoController = require('../src/modules/recepcao/recepcaoController');
const configCache = require('../src/core/config/configCache');
const errorHandler = require('../src/core/middlewares/errorHandler');

const runCatExpress = (handler, id) => {
  return new Promise((resolve) => {
    const req = { query: { nr_atendimento: '123' }, params: { id, nrAtendimento: '123' }, session: { usuario: { perfilAtivo: 'admin', nm_usuario: 'teste' } } };
    const res = {
      _status: 200, headers: {},
      status(code) { this._status = code; return this; },
      setHeader(k, v) { this.headers[k] = v; return this; },
      send(buffer) { resolve({ status: this._status }); },
      json(data) { resolve({ status: this._status, body: data }); }
    };
    const next = (err) => {
      if (err) errorHandler(err, req, res, () => resolve({ status: res._status || 500 }));
      else resolve({ status: 200 });
    };
    handler(req, res, next);
  });
};

describe('Etapa 09.2 - Prova Real de Revogação do Catálogo', () => {
  it('Deve revogar ID antigo e aceitar o novo numérico', async () => {
    require('../src/modules/recepcao/tasyReportsClient').gerarRelatorioPdf = async () => Buffer.from('PDF');

    // Preparação 1: Catálogo inicial tem ID 101 ativo
    configCache.getRelatoriosTasyState = () => 'AVAILABLE';
    configCache.getRelatoriosTasy = () => [{ cd_relatorio: 101, ativo: 1 }];

    let res101 = await runCatExpress(recepcaoController.gerarRelatorioAtendimento, '101');
    assert.strictEqual(res101.status, 200);

    // Preparação 2: Falha de recarga derruba estado
    configCache.getRelatoriosTasyState = () => 'UNAVAILABLE';
    let resFail = await runCatExpress(recepcaoController.gerarRelatorioAtendimento, '101');
    assert.strictEqual(resFail.status, 503);

    // Preparação 3: Recuperação carrega NOVO ID 202
    configCache.getRelatoriosTasyState = () => 'AVAILABLE';
    configCache.getRelatoriosTasy = () => [{ cd_relatorio: 202, ativo: 1 }];

    // ID Antigo (101) deve ser bloqueado com 403
    let resVelho = await runCatExpress(recepcaoController.gerarRelatorioAtendimento, '101');
    assert.strictEqual(resVelho.status, 403);
    
    // ID Novo (202) deve ser aceito
    let resNovo = await runCatExpress(recepcaoController.gerarRelatorioAtendimento, '202');
    assert.strictEqual(resNovo.status, 200);
    
    // String Invalida (velho_id) deve falhar na validação
    let resString = await runCatExpress(recepcaoController.gerarRelatorioAtendimento, 'velho_id');
    assert.strictEqual(resString.status, 400);
  });
});
