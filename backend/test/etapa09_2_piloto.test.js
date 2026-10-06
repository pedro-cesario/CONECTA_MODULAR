const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const database = require('../src/core/database');
let oracleConns = 0;
let oracleCloses = 0;
let oracleExecs = 0;
let forceOracleError = false;

database.getConnection = async () => {
  if (forceOracleError && forceOracleError === 'ACQUISITION') throw new Error('Acquisition Failed');
  oracleConns++;
  return {
    execute: async (sql, binds) => {
      if (forceOracleError === 'EXECUTION') throw new Error('Execution Failed');
      oracleExecs++;
      if (sql.includes('ind.nr_atendimento')) { 
        return { rows: binds && binds[0] === '123' ? [{ NR_ATENDIMENTO: 123, NOME: 'Teste Decidido', NR_SEQ_TEMPL: '1' }] : [] };
      }
      if (sql.includes('a.nr_seq_temp_conteudo IN')) {
        return { rows: [{ CONTEUDO: 'Detalhe A' }] };
      }
      return { rows: [{ NR_ATENDIMENTO: 123, NOME: 'Teste Indicação', NR_SEQ_TEMPL: '1' }] };
    },
    close: async () => {
      oracleCloses++;
    }
  };
};

const configCache = require('../src/core/config/configCache');
const errorHandler = require('../src/core/middlewares/errorHandler');
const dashboardController = require('../src/modules/dashboard/dashboardController');

let mockAuth = true;
let mockRole = 'enfermagem';
dashboardController._validarAcessoDashboardPA = (req, res) => {
  if (!mockAuth) { res.status(401).json({ success: false, message: 'Não autenticado' }); return false; }
  if (mockRole !== 'enfermagem') { res.status(403).json({ success: false, message: 'Proibido' }); return false; }
  return true;
};

// Sobrescrever o middleware importado via cache injection ou manual test rig
const runExpress = (handler, reqArgs) => {
  return new Promise((resolve) => {
    const req = { ...reqArgs, requestId: 'req-id-555' };
    const res = {
      _status: 200,
      headers: {},
      status(code) { this._status = code; return this; },
      json(data) { resolve({ status: this._status, body: data }); },
    };
    
    const next = (err) => {
      if (err) {
        errorHandler(err, req, res, () => resolve({ status: 500 }));
      } else {
        resolve({ status: 200 });
      }
    };
    
    // Simulate original middleware behaviour directly in test wrapper via _validar
    // (In production, the controller calls validarAcessoDashboardPA which is defined inside the same file. 
    // Wait, the controller calls `validarAcessoDashboardPA` which is NOT exported. I must override `req.session` so the real function fails/succeeds.)
    req.session = mockAuth ? { usuario: { perfilAtivo: mockRole, nm_usuario: 'teste' } } : null;
    
    let origAcesso = configCache.perfilTemAcessoModulo;
    configCache.perfilTemAcessoModulo = (perfil, mod) => perfil === 'enfermagem';

    handler(req, res, next).finally(() => {
      configCache.perfilTemAcessoModulo = origAcesso;
    });
  });
};

describe('Etapa 09.2 - Provas Finais do Piloto Dashboard', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production'; // To verify 500 errors hide stack traces
    oracleConns = 0; oracleCloses = 0; oracleExecs = 0;
    forceOracleError = false;
    mockAuth = true; mockRole = 'enfermagem';
  });

  const invokeDetalhes = (nrAtendimento) => runExpress(dashboardController.obterDetalhesInternacao, { params: { nrAtendimento } });

  it('1. Testes de 401 e 403 (Autenticação/Autorização)', async () => {
    mockAuth = false;
    let res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 401);
    
    mockAuth = true; mockRole = 'medico'; // Sem permissão para dashboard_pa
    res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(oracleConns, 0); // No service calls
  });

  it('2. Rejeita parâmetros inválidos, notavelmente ESPAÇOS e OVERFLOW (HTTP 400)', async () => {
    // Note que " 123 ", "1 23" são testados para garantir que não usa .trim()
    const invalidInputs = [" 123", "123 ", " 123 ", "1 23", "", "0", "-1", "1.5", "1e5", "9007199254740992"];
    for (const input of invalidInputs) {
      const res = await invokeDetalhes(input);
      assert.strictEqual(res.status, 400, `Falhou proteção contra input: '${input}'`);
      assert.strictEqual(res.body.success, false);
    }
    assert.strictEqual(oracleConns, 0);
  });

  it('3. Sucesso para valor válido puro', async () => {
    const res = await invokeDetalhes('123'); 
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.nr_atendimento, '123');
    assert.ok(oracleConns > 0);
  });

  it('4. Zeros à esquerda ("00123") resultam em 404 porque comparativo legado falha (String(123) !== String("00123"))', async () => {
    const res = await invokeDetalhes('00123');
    // Validação passou (pois são apenas dígitos).
    // Mas no Service, o Oracle devolve 123 numérico. 
    // String(123) === String('00123') é FALSE.
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
    assert.ok(oracleConns > 0);
  });

  it('5. Erro inesperado em 500 sem exposição de detalhes internos', async () => {
    forceOracleError = 'EXECUTION';
    const res = await invokeDetalhes('123');
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error.code, 'INTERNAL_SERVER_ERROR');
    // Mensagem genérica da API em prod, não o "Execution Failed"
    assert.strictEqual(res.body.error.message, 'Erro interno do servidor');
    assert.strictEqual(res.body.error.stack, undefined);
  });
});
