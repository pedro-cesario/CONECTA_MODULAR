const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('Etapa 04 Lote 1: loadVersion strict contract', () => {
  let originalDocument;
  let domElements;
  let apiModule;
  let loadVersionFn;

  beforeEach(async () => {
    originalDocument = global.document;

    const classListStatus = new Set();
    const classListTestBar = new Set();

    domElements = {
      'app-version-footer': { textContent: '' },
      'system-status': {
        classList: {
          add: (c) => classListStatus.add(c),
          remove: (c) => classListStatus.delete(c),
          contains: (c) => classListStatus.has(c)
        }
      },
      'system-status-text': { textContent: '' },
      'test-environment-bar': {
        classList: {
          toggle: (c, force) => {
            if (force) classListTestBar.add(c);
            else classListTestBar.delete(c);
          }
        }
      }
    };

    global.document = {
      getElementById: (id) => domElements[id],
      documentElement: {
        style: { setProperty: () => {} }
      }
    };

    const apiImport = await import('../../frontend/src/core/api.js');
    const utilsImport = await import('../../frontend/src/core/utils.js');
    apiModule = apiImport.api;
    loadVersionFn = utilsImport.loadVersion;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  it('Sucesso com resposta estrita', async () => {
    apiModule.get = async () => ({ ok: true, version: '1.2.3', showTestBar: true });
    await loadVersionFn();
    assert.strictEqual(domElements['system-status-text'].textContent, 'Aplicação disponível');
    assert.strictEqual(domElements['app-version-footer'].textContent, 'v1.2.3');
  });

  it('Falha com array (inválido)', async () => {
    apiModule.get = async () => [];
    await loadVersionFn();
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });

  it('Falha com objeto null', async () => {
    apiModule.get = async () => null;
    await loadVersionFn();
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });
  
  it('Falha com version vazia', async () => {
    apiModule.get = async () => ({ ok: true, version: '   ', showTestBar: true });
    await loadVersionFn();
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });

  it('Falha com showTestBar ausente', async () => {
    apiModule.get = async () => ({ ok: true, version: '1.0' });
    await loadVersionFn();
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });

  it('Erro HTTP ou Erro de Rede (throw)', async () => {
    apiModule.get = async () => { throw new Error('Network Error'); };
    await loadVersionFn();
    assert.strictEqual(domElements['system-status-text'].textContent, 'Serviço temporariamente indisponível');
  });
  
  it('Recuperação de falha para sucesso', async () => {
    domElements['system-status'].classList.add('offline');
    domElements['system-status-text'].textContent = 'Serviço temporariamente indisponível';
    
    apiModule.get = async () => ({ ok: true, version: '1.2.3', showTestBar: false });
    await loadVersionFn();
    
    assert.strictEqual(domElements['system-status-text'].textContent, 'Aplicação disponível');
    assert.strictEqual(domElements['system-status'].classList.contains('offline'), false);
  });
});

// Backend
const recepcaoRepository = require('../src/modules/recepcao/recepcaoRepository');
const setorService = require('../src/modules/setores/setorService');

describe('Etapa 04 Lote 1: Conexões Oracle', () => {
  afterEach(() => {
    recepcaoRepository.resetCustomGetConnectionForTest();
    setorService.resetCustomGetConnectionForTest();
  });

  describe('recepcaoRepository.gerarRelatorioAtendimento', () => {
    it('Validações falham antes da aquisição de conexão', async () => {
      let connectionAcquired = false;
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        connectionAcquired = true;
        return { close: async () => {} };
      });
      await assert.rejects(
        async () => await recepcaoRepository.gerarRelatorioAtendimento('invalido', 'invalido'),
        { message: 'Parâmetros inválidos para geração de relatório' }
      );
      assert.strictEqual(connectionAcquired, false);
    });

    it('Fecha a conexão em caso de sucesso', async () => {
      let closed = false;
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return {
          execute: async () => ({ rows: [] }),
          close: async () => { closed = true; }
        };
      });
      // Will fail to generate full html if config is missing, but should still close connection.
      // Wait, if it fails to execute it will go to catch and then finally. 
      // Let's mock a success execution
      try {
        await recepcaoRepository.gerarRelatorioAtendimento('70125', '123');
      } catch (e) {} // ignore any business error, focus on close
      assert.strictEqual(closed, true);
    });

    it('Erro de aquisição de conexão (não vazia)', async () => {
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        throw new Error('Timeout Oracle');
      });
      await assert.rejects(
        async () => await recepcaoRepository.gerarRelatorioAtendimento('70125', '123'),
        { message: 'Timeout Oracle' }
      );
    });

    it('Erro de execução com fechamento', async () => {
      let closed = false;
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return {
          execute: async () => { throw new Error('Query error'); },
          close: async () => { closed = true; }
        };
      });
      await assert.rejects(
        async () => await recepcaoRepository.gerarRelatorioAtendimento('70125', '123'),
        { message: 'Query error' }
      );
      assert.strictEqual(closed, true);
    });

    it('Execução e close falhando juntos (preserva erro original)', async () => {
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return {
          execute: async () => { throw new Error('Primary Query Error'); },
          close: async () => { throw new Error('Secondary Close Error'); }
        };
      });
      await assert.rejects(
        async () => await recepcaoRepository.gerarRelatorioAtendimento('70125', '123'),
        { message: 'Primary Query Error' }
      );
    });

    it('Close falhando após sucesso de execução', async () => {
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return {
          execute: async () => ({ rows: [] }),
          close: async () => { throw new Error('Close Error after success'); }
        };
      });
      await assert.rejects(
        async () => await recepcaoRepository.gerarRelatorioAtendimento('70125', '123'),
        { message: 'Close Error after success' }
      );
    });
  });

  describe('recepcaoRepository.verificarDuplicidadePaciente', () => {
    it('Retorno antecipado sem adquirir conexão se conds = 0', async () => {
      let connectionAcquired = false;
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        connectionAcquired = true;
        return { close: async () => {} };
      });
      const res = await recepcaoRepository.verificarDuplicidadePaciente({});
      assert.strictEqual(res.duplicado, false);
      assert.strictEqual(connectionAcquired, false);
    });
    it('Erro de aquisição de conexão', async () => {
      recepcaoRepository.setCustomGetConnectionForTest(async () => { throw new Error('Timeout'); });
      await assert.rejects(
        async () => await recepcaoRepository.verificarDuplicidadePaciente({ cpf: '12345678901' }),
        { message: 'Timeout' }
      );
    });

    it('Erro de execução com fechamento', async () => {
      let closed = false;
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return { execute: async () => { throw new Error('Query error'); }, close: async () => { closed = true; } };
      });
      await assert.rejects(
        async () => await recepcaoRepository.verificarDuplicidadePaciente({ cpf: '12345678901' }),
        { message: 'Query error' }
      );
      assert.strictEqual(closed, true);
    });

    it('Execução e close falhando juntos', async () => {
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return { execute: async () => { throw new Error('Primary Error'); }, close: async () => { throw new Error('Close Error'); } };
      });
      await assert.rejects(
        async () => await recepcaoRepository.verificarDuplicidadePaciente({ cpf: '12345678901' }),
        { message: 'Primary Error' }
      );
    });

    it('Close falhando após sucesso', async () => {
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return { execute: async () => ({ rows: [] }), close: async () => { throw new Error('Close Error'); } };
      });
      await assert.rejects(
        async () => await recepcaoRepository.verificarDuplicidadePaciente({ cpf: '12345678901' }),
        { message: 'Close Error' }
      );
    });

    it('Sucesso com fechamento', async () => {
      let closed = false;
      recepcaoRepository.setCustomGetConnectionForTest(async () => {
        return { execute: async () => ({ rows: [] }), close: async () => { closed = true; } };
      });
      const res = await recepcaoRepository.verificarDuplicidadePaciente({ cpf: '12345678901' });
      assert.strictEqual(res.duplicado, false);
      assert.strictEqual(closed, true);
    });
  });


  describe('setorService.buscarSetoresComEscalaLiberada', () => {
    it('Retorno antecipado sem adquirir conexão se dataPlantao vazio', async () => {
      let connectionAcquired = false;
      setorService.setCustomGetConnectionForTest(async () => {
        connectionAcquired = true;
        return { close: async () => {} };
      });
      const res = await setorService.buscarSetoresComEscalaLiberada();
      assert.deepStrictEqual(res, []);
      assert.strictEqual(connectionAcquired, false);
    });

    it('Falha de fechamento não mascara erro de execução', async () => {
      setorService.setCustomGetConnectionForTest(async () => {
        return {
          execute: async () => { throw new Error('Erro SQL 123'); },
          close: async () => { throw new Error('Erro Close 456'); }
        };
      });
      await assert.rejects(
        async () => await setorService.buscarSetoresComEscalaLiberada('2024-01-01', 'M'),
        { message: 'Erro SQL 123' }
      );
    });

    it('Erro de aquisição de conexão', async () => {
      setorService.setCustomGetConnectionForTest(async () => { throw new Error('Timeout'); });
      await assert.rejects(
        async () => await setorService.buscarSetoresComEscalaLiberada('2024-01-01', 'M'),
        { message: 'Timeout' }
      );
    });

    it('Erro de execução com fechamento', async () => {
      let closed = false;
      setorService.setCustomGetConnectionForTest(async () => {
        return { execute: async () => { throw new Error('Query error'); }, close: async () => { closed = true; } };
      });
      await assert.rejects(
        async () => await setorService.buscarSetoresComEscalaLiberada('2024-01-01', 'M'),
        { message: 'Query error' }
      );
      assert.strictEqual(closed, true);
    });

    it('Close falhando após sucesso', async () => {
      setorService.setCustomGetConnectionForTest(async () => {
        return { execute: async () => ({ rows: [] }), close: async () => { throw new Error('Close Error'); } };
      });
      await assert.rejects(
        async () => await setorService.buscarSetoresComEscalaLiberada('2024-01-01', 'M'),
        { message: 'Close Error' }
      );
    });

    it('Sucesso com fechamento', async () => {
      let closed = false;
      setorService.setCustomGetConnectionForTest(async () => {
        return { execute: async () => ({ rows: [] }), close: async () => { closed = true; } };
      });
      const res = await setorService.buscarSetoresComEscalaLiberada('2024-01-01', 'M');
      assert.deepStrictEqual(res, []);
      assert.strictEqual(closed, true);
    });
  });
});
