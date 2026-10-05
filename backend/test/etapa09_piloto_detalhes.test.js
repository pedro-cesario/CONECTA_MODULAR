const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const database = require('../src/core/database');
let oracleConns = 0;
let oracleCloses = 0;
let oracleExecs = 0;
let forceOracleError = false;
let forceCloseError = false;

database.getConnection = async () => {
  if (forceOracleError && forceOracleError === 'ACQUISITION') throw new Error('Acquisition Failed');
  oracleConns++;
  return {
    execute: async (sql, binds) => {
      if (forceOracleError === 'EXECUTION') throw new Error('Execution Failed');
      oracleExecs++;
      if (sql.includes('ind.nr_atendimento')) { // mock for decididos
        return { rows: binds && binds.nr_atendimento === '999999' ? [] : [{ NR_ATENDIMENTO: '123', NM_PESSOA_FISICA: 'Teste Decidido', NR_SEQ_TEMPL: '1' }] };
      }
      if (sql.includes('a.nr_seq_temp_conteudo IN')) { // mock for detalhes
        return { rows: [{ CONTEUDO: 'Detalhe A' }] };
      }
      return { rows: [{ NR_ATENDIMENTO: '00123', NOME: 'Teste Indicação', NR_SEQ_TEMPL: '1' }, { NR_ATENDIMENTO: '123', NOME: 'Teste Indicação', NR_SEQ_TEMPL: '1' }] };
    },
    close: async () => {
      if (forceCloseError) throw new Error('Close Failed');
      oracleCloses++;
    }
  };
};

const configCache = require('../src/core/config/configCache');
const errorHandler = require('../src/core/middlewares/errorHandler');
const dashboardController = require('../src/modules/dashboard/dashboardController');

dashboardController._validarAcessoDashboardPA = () => true;
const origValidar = dashboardController.__get__ ? dashboardController.__get__('validarAcessoDashboardPA') : null;

const runExpress = (handler, reqArgs) => {
  return new Promise((resolve) => {
    const req = { ...reqArgs, requestId: 'test-req-id-123' };
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
        errorHandler(err, req, res, () => resolve({ status: 500 }));
      } else {
        resolve({ status: 200 });
      }
    };
    
    req.session = { usuario: { perfilAtivo: 'enfermagem', nm_usuario: 'teste' } };
    let origAcesso = configCache.perfilTemAcessoModulo;
    configCache.perfilTemAcessoModulo = () => true;

    handler(req, res, next).finally(() => {
      configCache.perfilTemAcessoModulo = origAcesso;
    });
  });
};

describe('Etapa 09.1 - Piloto Dashboard Detalhes (Ciclo de Vida de Conexões)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    oracleConns = 0;
    oracleCloses = 0;
    oracleExecs = 0;
    forceOracleError = false;
    forceCloseError = false;
  });

  const invokeDetalhes = (nrAtendimento) => runExpress(dashboardController.obterDetalhesInternacao, { params: { nrAtendimento } });

  it('1. Rejeita parâmetros inválidos com 400 (Zero Aquisições/Execuções)', async () => {
    const invalidInputs = ['texto', ' ', '', '0', '-5', '12.5', '1e5', '9007199254740992'];
    for (const input of invalidInputs) {
      const res = await invokeDetalhes(input);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    }
    assert.strictEqual(oracleConns, 0);
    assert.strictEqual(oracleExecs, 0);
  });

  it('2. Aceita zeros à esquerda e executa sucesso preservando contrato', async () => {
    const res = await invokeDetalhes('00123'); 
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.nr_atendimento, '00123');
    assert.ok(oracleConns > 0);
    assert.strictEqual(oracleConns, oracleCloses); // Execução OK + Close OK
  });

  it('3. Retorna 404 padronizado para paciente não encontrado', async () => {
    const res = await invokeDetalhes('999999');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
    assert.strictEqual(oracleConns, oracleCloses);
  });

  it('4. Falha de Aquisição: Não tenta fechar conexão inexistente', async () => {
    forceOracleError = 'ACQUISITION';
    const res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(oracleConns, 0);
    assert.strictEqual(oracleCloses, 0);
  });

  it('5. Falha de Execução + Close Funciona: Propaga erro de execução', async () => {
    forceOracleError = 'EXECUTION';
    const res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(oracleConns, 1);
    assert.strictEqual(oracleCloses, 1);
  });

  it('6. Execução Funciona + Close Falha: Propaga erro de fechamento', async () => {
    forceCloseError = true;
    const res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error.message, 'Close Failed');
    assert.strictEqual(oracleConns, 1); // Opened 1, then failed to close it (threw)
    assert.strictEqual(oracleCloses, 0); // Didn't increment inside our mock
  });

  it('7. Falha de Execução + Close Falha: Preserva erro da consulta e loga close (mock engole log)', async () => {
    forceOracleError = 'EXECUTION';
    forceCloseError = true;
    const res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error.message, 'Execution Failed');
    assert.strictEqual(oracleConns, 1);
    assert.strictEqual(oracleCloses, 0);
  });
});
