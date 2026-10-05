const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('node:events');
const express = require('express');

const ldapService = require('../src/modules/auth/ldapService');
const dashboardRepository = require('../src/modules/dashboard/dashboardRepository');
const authController = require('../src/modules/auth/authController');
const usuarioRepository = require('../src/modules/usuarios/usuarioRepository');
const { getVersionData, versionHandler } = require('../src/core/utils/versionHandler');

// ============================================================================
// 1. TESTES ISOLADOS: FRONTEND REAL (loadVersion com DOM e API simulados)
// ============================================================================
describe('Etapa 02.1: Frontend loadVersion Real Implementation', () => {
  let originalDocument;
  let domElements;
  let apiModule;
  let loadVersionFn;

  beforeEach(async () => {
    originalDocument = global.document;

    // DOM simulado representativo dos elementos reais de frontend/index.html
    const classListStatus = new Set();
    const classListTestBar = new Set();

    domElements = {
      'app-version-footer': { textContent: '' },
      'system-status': {
        classList: {
          add: (cls) => classListStatus.add(cls),
          remove: (cls) => classListStatus.delete(cls),
          contains: (cls) => classListStatus.has(cls),
          has: (cls) => classListStatus.has(cls)
        }
      },
      'system-status-text': { textContent: '' },
      'test-environment-bar': {
        classList: {
          add: (cls) => classListTestBar.add(cls),
          remove: (cls) => classListTestBar.delete(cls),
          toggle: (cls, force) => {
            if (force) classListTestBar.add(cls);
            else classListTestBar.delete(cls);
          },
          contains: (cls) => classListTestBar.has(cls),
          has: (cls) => classListTestBar.has(cls)
        }
      }
    };

    global.document = {
      getElementById: (id) => domElements[id] || null,
      documentElement: {
        style: {
          setProperty: () => {}
        }
      }
    };

    // Importa dinamicamente a implementação real dos módulos ESM do frontend
    const apiImport = await import('../../frontend/src/core/api.js');
    const utilsImport = await import('../../frontend/src/core/utils.js');
    apiModule = apiImport.api;
    loadVersionFn = utilsImport.loadVersion;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  it('Sucesso HTTP: atualiza versão, remove .offline e exibe "Aplicação disponível"', async () => {
    domElements['system-status'].classList.add('offline');
    apiModule.get = async (url) => {
      assert.strictEqual(url, '/api/version');
      return { ok: true, version: '2.2.1', showTestBar: false };
    };

    await loadVersionFn();

    assert.strictEqual(domElements['app-version-footer'].textContent, 'v2.2.1');
    assert.strictEqual(domElements['system-status'].classList.has('offline'), false);
    assert.strictEqual(domElements['system-status-text'].textContent, 'Aplicação disponível');
    assert.strictEqual(domElements['test-environment-bar'].classList.has('d-none'), true);
  });

  it('HTTP não exitoso (ex: 500, 404): adiciona .offline e exibe "Serviço temporariamente indisponível"', async () => {
    apiModule.get = async () => {
      const err = new Error('HTTP 500 Internal Server Error');
      err.status = 500;
      throw err;
    };

    await loadVersionFn();

    assert.strictEqual(domElements['system-status'].classList.has('offline'), true);
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });

  it('Resposta incompatível/inválida ({ ok: false } ou nulo): trata como falha e adiciona .offline', async () => {
    apiModule.get = async () => ({ ok: false });

    await loadVersionFn();

    assert.strictEqual(domElements['system-status'].classList.has('offline'), true);
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });

  it('Falha de rede (Network Error / Timeout / Abort): adiciona .offline', async () => {
    apiModule.get = async () => {
      const netErr = new TypeError('Failed to fetch');
      throw netErr;
    };

    await loadVersionFn();

    assert.strictEqual(domElements['system-status'].classList.has('offline'), true);
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });

  it('Recuperação de falha para sucesso: transiciona de offline para online corretamente', async () => {
    // 1. Simula falha inicial
    apiModule.get = async () => {
      throw new Error('Falha de rede temporária');
    };
    await loadVersionFn();
    assert.strictEqual(domElements['system-status'].classList.has('offline'), true);
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');

    // 2. Simula recuperação do serviço
    apiModule.get = async () => ({ ok: true, version: '2.2.1', showTestBar: false });
    await loadVersionFn();
    assert.strictEqual(domElements['system-status'].classList.has('offline'), false);
    assert.strictEqual(domElements['system-status-text'].textContent, 'Aplicação disponível');
    assert.strictEqual(domElements['app-version-footer'].textContent, 'v2.2.1');
  });
});

// ============================================================================
// 2. TESTES ISOLADOS: CONTRATO REAL DE /api/version E /api/ping
// ============================================================================
describe('Etapa 02.1: Version & Ping Route Contract (Isolated)', () => {
  it('Contrato: versionHandler retorna ok, version e showTestBar compatíveis com package.json', () => {
    const pkg = require('../../package.json');
    const data = getVersionData();

    assert.strictEqual(data.ok, true);
    assert.strictEqual(typeof data.version, 'string');
    assert.strictEqual(data.version, pkg.version);
    assert.strictEqual(typeof data.showTestBar, 'boolean');
  });

  it('Roteamento Express: router responde igualmente para /version e /ping sem dependências externas', async () => {
    const testRouter = express.Router();
    testRouter.get(['/version', '/ping'], versionHandler);

    const routes = ['/version', '/ping'];

    for (const route of routes) {
      let responseJson = null;
      const req = { method: 'GET', url: route };
      const res = {
        json: (data) => {
          responseJson = data;
        }
      };

      testRouter.handle(req, res, () => {});

      assert.ok(responseJson, `Deveria ter respondido para a rota ${route}`);
      assert.strictEqual(responseJson.ok, true);
      assert.strictEqual(typeof responseJson.version, 'string');
      assert.strictEqual(typeof responseJson.showTestBar, 'boolean');
    }
  });
});

// ============================================================================
// 3. TESTES ISOLADOS: LDAP SERVICE E FLUXO REAL DO CONTROLLER
// ============================================================================
describe('Etapa 02.1: LDAP Service & Real Controller Authentication Flow', () => {
  let originalFindByUsername;

  beforeEach(() => {
    originalFindByUsername = usuarioRepository.findByUsername;
    usuarioRepository.findByUsername = async (u) => ({
      NM_USUARIO: u,
      NOME: `Usuário ${u}`,
      CD_PESSOA_FISICA: 12345,
      IE_PROFISSIONAL: 'S'
    });
  });

  afterEach(() => {
    usuarioRepository.findByUsername = originalFindByUsername;
    ldapService.resetCustomCreateClientForTest();
  });

  function createMockLdapClient({ shouldBindFail = false, searchEntries = [], searchError = null }) {
    return {
      bind(dn, password, callback) {
        if (shouldBindFail) {
          const err = new Error('Invalid Credentials');
          err.code = 49;
          return callback(err);
        }
        return callback(null);
      },
      search(baseDn, opts, callback) {
        if (searchError) {
          return callback(searchError);
        }
        const res = new EventEmitter();
        process.nextTick(() => {
          searchEntries.forEach((entry) => res.emit('searchEntry', entry));
          res.emit('end');
        });
        return callback(null, res);
      },
      unbind(callback) {
        if (typeof callback === 'function') callback();
      }
    };
  }

  // --- Testes unitários do ldapService ---
  it('ldapService: credenciais inválidas rejeitam com erro', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(createMockLdapClient({ shouldBindFail: true }));
    });

    await assert.rejects(
      async () => await ldapService.authenticate('qualquer.usuario', 'senha_errada'),
      { message: 'Credenciais inválidas' }
    );
  });

  it('ldapService: falha de conexão rejeita com erro de comunicação', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.reject(new Error('LDAP connection timeout'));
    });

    await assert.rejects(
      async () => await ldapService.authenticate('qualquer.usuario', 'senha'),
      { message: 'LDAP connection timeout' }
    );
  });

  it('ldapService: erro durante a busca de grupos retorna lista vazia de forma segura', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(createMockLdapClient({ searchError: new Error('LDAP search error') }));
    });

    const groups = await ldapService.getUserGroups('usuario.teste', 'senha');
    assert.deepStrictEqual(groups, []);
  });

  it('ldapService: busca sem grupos retorna lista vazia (sem bypass para pedro.cesario ou pedro.davi)', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(createMockLdapClient({ searchEntries: [] }));
    });

    const gCesario = await ldapService.getUserGroups('pedro.cesario', 'senha');
    assert.deepStrictEqual(gCesario, []);

    const gDavi = await ldapService.getUserGroups('pedro.davi', 'senha');
    assert.deepStrictEqual(gDavi, []);

    const gComum = await ldapService.getUserGroups('maria.silva', 'senha');
    assert.deepStrictEqual(gComum, []);
  });

  it('ldapService: busca com grupos legítimos retorna os nomes CN extraídos', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(
        createMockLdapClient({
          searchEntries: [
            {
              pojo: {
                attributes: [
                  {
                    type: 'memberOf',
                    values: ['CN=API_CONECTA_ADMIN,OU=Grupos,DC=heal,DC=local']
                  }
                ]
              }
            }
          ]
        })
      );
    });

    const groups = await ldapService.getUserGroups('admin.user', 'senha');
    assert.deepStrictEqual(groups, ['API_CONECTA_ADMIN']);
  });

  // --- Demonstração no FLUXO REAL do authController.login ---
  it('Controller Flow: pedro.cesario com grupos vazios NÃO cria sessão e retorna HTTP 403', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(createMockLdapClient({ shouldBindFail: false, searchEntries: [] }));
    });

    const req = {
      body: { nm_usuario: 'pedro.cesario', senha: 'valid_password' },
      headers: {},
      session: {}
    };

    let status = null;
    let json = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; return res; }
    };

    await authController.login(req, res);

    assert.strictEqual(status, 403, 'Deveria retornar HTTP 403 (perfil não habilitado)');
    assert.strictEqual(json?.success, false);
    assert.ok(json?.message?.includes('Acesso negado: perfil profissional ainda não habilitado'));
    assert.strictEqual(req.session.usuario, undefined, 'NÃO deve criar sessão');
  });

  it('Controller Flow: pedro.davi com grupos vazios NÃO cria sessão e retorna HTTP 403', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(createMockLdapClient({ shouldBindFail: false, searchEntries: [] }));
    });

    const req = {
      body: { nm_usuario: 'pedro.davi', senha: 'valid_password' },
      headers: {},
      session: {}
    };

    let status = null;
    let json = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; return res; }
    };

    await authController.login(req, res);

    assert.strictEqual(status, 403);
    assert.strictEqual(json?.success, false);
    assert.strictEqual(req.session.usuario, undefined);
  });

  it('Controller Flow: credenciais inválidas retornam HTTP 401 e NÃO criam sessão', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.resolve(createMockLdapClient({ shouldBindFail: true }));
    });

    const req = {
      body: { nm_usuario: 'qualquer.usuario', senha: 'senha_errada' },
      headers: {},
      session: {}
    };

    let status = null;
    let json = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; return res; }
    };

    await authController.login(req, res);

    assert.strictEqual(status, 401);
    assert.strictEqual(json?.success, false);
    assert.strictEqual(req.session.usuario, undefined);
  });

  it('Controller Flow: falha de conexão LDAP retorna erro HTTP e NÃO cria sessão', async () => {
    ldapService.setCustomCreateClientForTest(() => {
      return Promise.reject(new Error('LDAP server unreachable'));
    });

    const req = {
      body: { nm_usuario: 'qualquer.usuario', senha: 'qualquer_senha' },
      headers: {},
      session: {}
    };

    let status = null;
    let json = null;
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; return res; }
    };

    await authController.login(req, res);

    assert.ok(status >= 400);
    assert.strictEqual(json?.success, false);
    assert.strictEqual(req.session.usuario, undefined);
  });
});

// ============================================================================
// 4. TESTES ISOLADOS: CICLO DA CONEXÃO ORACLE REAL (findPacientesComStatus)
// ============================================================================
describe('Etapa 02.1: Real findPacientesComStatus Connection Lifecycle & Error Preservation', () => {
  afterEach(() => {
    dashboardRepository.resetCustomGetConnectionForTest();
  });

  it('Entrada inválida: lança erro "Setor inválido" e NÃO adquire conexão', async () => {
    let connectionAcquired = false;

    dashboardRepository.setCustomGetConnectionForTest(async () => {
      connectionAcquired = true;
      return {
        execute: async () => ({ rows: [] }),
        close: async () => {}
      };
    });

    const invalidInputs = [null, undefined, 0, -1, 'abc', '', NaN];

    for (const invalid of invalidInputs) {
      connectionAcquired = false;
      await assert.rejects(
        async () => await dashboardRepository.findPacientesComStatus(invalid, 'M'),
        { message: 'Setor inválido' }
      );
      assert.strictEqual(connectionAcquired, false, `Não deveria adquirir para entrada: ${invalid}`);
    }
  });

  it('Sucesso: adquire conexão e fecha corretamente no finally', async () => {
    let connectionAcquired = false;
    let connectionClosed = false;

    dashboardRepository.setCustomGetConnectionForTest(async () => {
      connectionAcquired = true;
      return {
        execute: async () => ({ rows: [] }),
        close: async () => {
          connectionClosed = true;
        }
      };
    });

    const result = await dashboardRepository.findPacientesComStatus(10, 'M');
    assert.ok(Array.isArray(result));
    assert.strictEqual(connectionAcquired, true);
    assert.strictEqual(connectionClosed, true);
  });

  it('Erro SQL: libera conexão no finally e propaga o erro SQL original', async () => {
    let connectionAcquired = false;
    let connectionClosed = false;

    dashboardRepository.setCustomGetConnectionForTest(async () => {
      connectionAcquired = true;
      return {
        execute: async () => {
          throw new Error('ORA-00942: table or view does not exist');
        },
        close: async () => {
          connectionClosed = true;
        }
      };
    });

    await assert.rejects(
      async () => await dashboardRepository.findPacientesComStatus(10, 'M'),
      { message: 'ORA-00942: table or view does not exist' }
    );

    assert.strictEqual(connectionAcquired, true);
    assert.strictEqual(connectionClosed, true);
  });

  it('Falha de aquisição de conexão: propaga erro original sem chamar close()', async () => {
    dashboardRepository.setCustomGetConnectionForTest(async () => {
      throw new Error('NJS-500: connection request timeout');
    });

    await assert.rejects(
      async () => await dashboardRepository.findPacientesComStatus(10, 'M'),
      { message: 'NJS-500: connection request timeout' }
    );
  });

  it('Comportamento quando close() falha durante erro SQL: preserva o erro SQL principal (NÃO mascara)', async () => {
    let closeAttempted = false;

    dashboardRepository.setCustomGetConnectionForTest(async () => {
      return {
        execute: async () => {
          throw new Error('ORA-01013: user requested cancel of current operation');
        },
        close: async () => {
          closeAttempted = true;
          throw new Error('NJS-503: connection already closed or broken network');
        }
      };
    });

    // O erro capturado DEVE ser o erro SQL principal, não o erro do close()
    await assert.rejects(
      async () => await dashboardRepository.findPacientesComStatus(10, 'M'),
      { message: 'ORA-01013: user requested cancel of current operation' }
    );

    assert.strictEqual(closeAttempted, true, 'Deveria ter tentado executar close()');
  });

  it('Comportamento quando close() falha em execução com sucesso: propaga a falha de fechamento', async () => {
    dashboardRepository.setCustomGetConnectionForTest(async () => {
      return {
        execute: async () => ({ rows: [] }),
        close: async () => {
          throw new Error('NJS-503: connection release failed');
        }
      };
    });

    await assert.rejects(
      async () => await dashboardRepository.findPacientesComStatus(10, 'M'),
      { message: 'NJS-503: connection release failed' }
    );
  });
});
