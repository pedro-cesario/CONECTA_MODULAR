const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const pacienteController = require('../src/modules/pacientes/pacienteController');
const dashboardRepository = require('../src/modules/dashboard/dashboardRepository');
const configCache = require('../src/core/config/configCache');
const errorHandler = require('../src/core/middlewares/errorHandler');

let connectionAcquired = 0;
let connectionClosed = 0;
let queryExecuted = 0;
let mockQueryResult = { rows: [] };
let forceConnectionError = null; // 'ACQUISITION', 'EXECUTION', 'CLOSE'

function setupMockConnection() {
  dashboardRepository.setCustomGetConnectionForTest(async () => {
    if (forceConnectionError === 'ACQUISITION') {
      throw new Error('ORA-12541: TNS:no listener (Acquisition Failed)');
    }
    connectionAcquired++;
    return {
      execute: async (sql, binds) => {
        if (forceConnectionError === 'EXECUTION') {
          throw new Error('ORA-00942: table or view does not exist (Execution Failed)');
        }
        queryExecuted++;
        
        // Retorno mock inteligente conforme query
        if (sql.includes('FROM atendimento_paciente_v a') && !sql.includes('pessoa_fisica b')) {
          return mockQueryResult.atendimentos || { rows: [{ NR_ATENDIMENTO: 1001 }] };
        }
        if (sql.includes('b.nm_pessoa_fisica nome')) {
          return mockQueryResult.pacientes || {
            rows: [{
              NR_ATENDIMENTO: 1001,
              NOME: 'PACIENTE TESTE FICTICIO',
              NM_SOCIAL: null,
              CONVENIO: 'UNIMED',
              UNIDADE: '101',
              CLASSIFIC_ATEND: 'VERDE',
              CD_SETOR_ATENDIMENTO: 10,
              SETOR: 'POSTO 1'
            }]
          };
        }
        return { rows: [] };
      },
      close: async () => {
        connectionClosed++;
        if (forceConnectionError === 'CLOSE') {
          throw new Error('NJS-503: connection release failed (Close Failed)');
        }
      }
    };
  });
}

function runExpress(req) {
  return new Promise((resolve) => {
    const res = {
      _status: 200,
      _body: null,
      status(code) {
        this._status = code;
        return this;
      },
      json(data) {
        this._body = data;
        resolve({ status: this._status, body: this._body });
      }
    };

    const next = (err) => {
      if (err) {
        errorHandler(err, req, res, () => {
          resolve({ status: res._status || 500, body: res._body });
        });
      } else {
        resolve({ status: res._status || 200, body: res._body });
      }
    };

    pacienteController.listarPacientesDashboard(req, res, next);
  });
}

describe('Etapa 11 — Padronização de POST /api/dashboard/pacientes-setor/:cd_setor', () => {
  let origEnv;
  let origPerfilPodeVisualizar;
  let origTemAcessoModulo;

  beforeEach(() => {
    origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    connectionAcquired = 0;
    connectionClosed = 0;
    queryExecuted = 0;
    forceConnectionError = null;
    mockQueryResult = { rows: [] };

    setupMockConnection();

    origPerfilPodeVisualizar = configCache.perfilPodeVisualizarSetor;
    origTemAcessoModulo = configCache.perfilTemAcessoModulo;
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    dashboardRepository.resetCustomGetConnectionForTest();
    configCache.perfilPodeVisualizarSetor = origPerfilPodeVisualizar;
    configCache.perfilTemAcessoModulo = origTemAcessoModulo;
  });

  it('1. Rejeição de entradas inválidas em HTTP 400 sem alocação de conexão', async () => {
    const invalidInputs = [
      ' 10', '10 ', ' 10 ', '1 0', '', '0', '-5', '1.5', '1e3', 'abc', 'setor_1', '9007199254740992'
    ];

    const reqValidSession = {
      session: { usuario: { nm_usuario: 'enfermeiro_teste', perfilAtivo: 'enfermagem' } },
      params: {}
    };

    configCache.perfilTemAcessoModulo = () => true;

    for (const input of invalidInputs) {
      reqValidSession.params = { cd_setor: input };
      const res = await runExpress(reqValidSession);
      assert.strictEqual(res.status, 400, `Deveria rejeitar com 400 a entrada '${input}'`);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    }

    assert.strictEqual(connectionAcquired, 0, 'Zero conexões devem ser adquiridas para parâmetros inválidos');
    assert.strictEqual(queryExecuted, 0, 'Zero queries devem ser executadas');
  });

  it('2. Sessão ausente: rejeição com HTTP 401 via UnauthorizedError', async () => {
    const reqSemSessao = {
      session: null,
      params: { cd_setor: '10' }
    };

    const res = await runExpress(reqSemSessao);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(connectionAcquired, 0);
  });

  it('3. Perfil sem acesso ao módulo dashboard: rejeição com HTTP 403 via ForbiddenError', async () => {
    const reqPerfilBloqueado = {
      session: { usuario: { nm_usuario: 'recepcionista', perfilAtivo: 'recepcao' } },
      params: { cd_setor: '10' }
    };

    configCache.perfilTemAcessoModulo = (perfil, modulo) => {
      if (modulo === 'dashboard') return false;
      return true;
    };

    const res = await runExpress(reqPerfilBloqueado);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    assert.strictEqual(res.body.message, 'Dashboard disponível apenas para os perfis com este módulo habilitado');
    assert.strictEqual(connectionAcquired, 0);
  });

  it('4. Perfil com módulo, mas sem acesso ao setor específico: rejeição com HTTP 403 via ForbiddenError', async () => {
    const reqSetorBloqueado = {
      session: { usuario: { nm_usuario: 'tecnico_enfermagem', perfilAtivo: 'enfermagem' } },
      params: { cd_setor: '99' }
    };

    configCache.perfilTemAcessoModulo = (perfil, modulo) => modulo === 'dashboard';
    configCache.perfilPodeVisualizarSetor = (perfil, cdSetor, modulo) => {
      // Autorizado somente setor 10
      return Number(cdSetor) === 10;
    };

    const res = await runExpress(reqSetorBloqueado);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    assert.strictEqual(res.body.message, 'Setor não autorizado para o dashboard');
    assert.strictEqual(connectionAcquired, 0);
  });

  it('5. Sucesso com dados fictícios: HTTP 200, mapeamento de status e liberação de conexão', async () => {
    const reqValido = {
      session: { usuario: { nm_usuario: 'enfermeiro_chefe', perfilAtivo: 'enfermagem' } },
      params: { cd_setor: '10' },
      body: {}
    };

    configCache.perfilTemAcessoModulo = () => true;
    configCache.perfilPodeVisualizarSetor = () => true;

    const res = await runExpress(reqValido);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 1);

    const paciente = res.body.data[0];
    assert.strictEqual(paciente.nr_atendimento, 1001);
    assert.strictEqual(paciente.nome, 'PACIENTE TESTE FICTICIO');
    assert.strictEqual(paciente.setor, 'POSTO 1');
    assert.strictEqual(typeof paciente.medicacao_agora, 'number');
    assert.strictEqual(typeof paciente.checagem_pendente, 'number');

    assert.strictEqual(connectionAcquired, 1, 'Exatamente uma conexão adquirida');
    assert.strictEqual(connectionClosed, 1, 'Conexão devidamente fechada no finally');
  });

  it('6. Lista vazia de pacientes: HTTP 200, data: [], e liberação de conexão', async () => {
    const reqSemPacientes = {
      session: { usuario: { nm_usuario: 'enfermeiro_chefe', perfilAtivo: 'enfermagem' } },
      params: { cd_setor: '20' },
      body: {}
    };

    configCache.perfilTemAcessoModulo = () => true;
    configCache.perfilPodeVisualizarSetor = () => true;

    mockQueryResult.atendimentos = { rows: [] }; // Nenhum paciente internado

    const res = await runExpress(reqSemPacientes);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 0);

    assert.strictEqual(connectionAcquired, 1);
    assert.strictEqual(connectionClosed, 1, 'Conexão fechada mesmo quando lista é vazia');
  });

  it('7. Falha inesperada de execução SQL: HTTP 500 sanitizado em produção sem vazamento de SQL', async () => {
    const reqErroSql = {
      session: { usuario: { nm_usuario: 'enfermeiro_chefe', perfilAtivo: 'enfermagem' } },
      params: { cd_setor: '10' },
      body: {}
    };

    configCache.perfilTemAcessoModulo = () => true;
    configCache.perfilPodeVisualizarSetor = () => true;

    forceConnectionError = 'EXECUTION';

    const res = await runExpress(reqErroSql);
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'INTERNAL_SERVER_ERROR');
    // Em ambiente de produção simulado, mensagem deve ser sanitizada
    assert.strictEqual(res.body.error.message, 'Erro interno do servidor');
    assert.strictEqual(res.body.error.stack, undefined);
    assert.strictEqual(res.body.message, 'Erro interno do servidor');

    // Conexão adquirida e fechada no finally
    assert.strictEqual(connectionAcquired, 1);
    assert.strictEqual(connectionClosed, 1);
  });

  it('8. Ciclo de Conexões Oracle: Falha de aquisição, preservação de erro de execução e falha de close', async () => {
    // 8a. Falha de Aquisição: não tenta fechar conexão inexistente
    forceConnectionError = 'ACQUISITION';
    await assert.rejects(
      async () => await dashboardRepository.findPacientesComStatus(10, 'M'),
      { message: 'ORA-12541: TNS:no listener (Acquisition Failed)' }
    );
    assert.strictEqual(connectionAcquired, 0);
    assert.strictEqual(connectionClosed, 0);

    // 8b. Execução bem-sucedida + Falha no close: propaga o erro de fechamento
    forceConnectionError = 'CLOSE';
    await assert.rejects(
      async () => await dashboardRepository.findPacientesComStatus(10, 'M'),
      { message: 'NJS-503: connection release failed (Close Failed)' }
    );
    assert.strictEqual(connectionAcquired, 1);
    assert.strictEqual(connectionClosed, 1);
  });
});
