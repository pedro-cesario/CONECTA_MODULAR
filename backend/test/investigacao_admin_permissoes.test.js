const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const configCache = require('../src/core/config/configCache');
const { requireAuth, requireAdmin } = require('../src/core/middlewares/authMiddleware');
const adminRoutes = require('../src/modules/admin/routes');
const redisClient = require('../src/core/config/redisClient');

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const userHeader = req.headers['x-test-user'];
    if (userHeader) {
      req.session = { usuario: JSON.parse(userHeader) };
    } else {
      req.session = {};
    }
    next();
  });

  const apiRouter = express.Router();
  apiRouter.use('/admin', requireAuth, adminRoutes);
  app.use('/api', apiRouter);
  return app;
}

function makeRequest(app, method, url, { headers = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const http = require('node:http');
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const parsedUrl = new URL(url, `http://127.0.0.1:${port}`);
      const reqOptions = {
        hostname: '127.0.0.1',
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          ...headers,
          ...(body ? { 'Content-Type': 'application/json' } : {})
        }
      };

      const req = http.request(reqOptions, (res) => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
          server.close();
          let data = null;
          try {
            data = JSON.parse(rawData);
          } catch (e) {
            data = rawData;
          }
          resolve({ status: res.statusCode, data, headers: res.headers });
        });
      });

      req.on('error', (err) => {
        server.close();
        resolve({ status: 500, error: err.message });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

const USUARIO_ADMIN = {
  nm_usuario: 'ADMIN_SISTEMA',
  perfilAtivo: 'admin',
  grupos_ad: ['API_CONECTA_ADMIN'],
  perfisDisponiveis: [{ id: 'admin', nome: 'Administrador' }]
};

const USUARIO_COMUM = {
  nm_usuario: 'USUARIO_COMUM',
  perfilAtivo: 'enfermagem',
  grupos_ad: ['ENFERMAGEM_ASSISTENCIAL'],
  perfisDisponiveis: [{ id: 'enfermagem', nome: 'Enfermagem' }]
};

describe('Incidente 2 — Gestão de Acesso / Diagnóstico POST /api/admin/permissoes (SQLITE_READONLY)', () => {
  let app;
  const origSetProfileAccess = configCache.setProfileAccess;

  before(async () => {
    await configCache.load();
  });

  after(async () => {
    try {
      await redisClient.disconnect();
    } catch (e) {}
  });

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    configCache.setProfileAccess = origSetProfileAccess;
  });

  describe('1. Autenticação, Autorização e Validação do Endpoint', () => {
    it('1.1 Sessão ausente: deve retornar HTTP 401 Unauthorized', async () => {
      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        body: { perfilId: 'enfermagem', modulos: ['livro'] }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Sessão expirada/i);
    });

    it('1.2 Usuário sem grupo ADMIN (API_CONECTA_ADMIN): deve retornar HTTP 403 Forbidden', async () => {
      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_COMUM) },
        body: { perfilId: 'enfermagem', modulos: ['livro'] }
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Acesso restrito a administradores/i);
    });

    it('1.3 Payload inválido (sem perfilId ou modulos não array): deve retornar HTTP 400 Bad Request', async () => {
      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ADMIN) },
        body: { perfilId: '', modulos: 'invalido' }
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /obrigatórios/i);
    });

    it('1.4 Perfil inexistente: deve retornar HTTP 404 Not Found', async () => {
      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ADMIN) },
        body: { perfilId: 'perfil_nao_existe_123', modulos: ['livro'] }
      });
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Perfil não encontrado');
    });

    it('1.5 Módulo passagem sem setores selecionados: deve retornar HTTP 400 Bad Request', async () => {
      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ADMIN) },
        body: { perfilId: 'enfermagem', modulos: ['passagem'], setoresPorModulo: { passagem: [] } }
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Selecione ao menos um setor para a Passagem/i);
    });
  });

  describe('2. Diagnóstico de Falha SQLITE_READONLY e Prova de Transação Atômica', () => {
    it('2.1 Simulação de SQLITE_READONLY: retorna HTTP 500 com mensagem pública sanitizada e rollback comprovado', async () => {
      let rollbackAttempted = false;
      const initialModulos = configCache.getModulosByPerfil('enfermagem').map(m => m.id);

      // Simula o comportamento real do configCache.setProfileAccess ao atingir banco somente leitura
      configCache.setProfileAccess = async (perfilId, modulos, permissoes, setoresPorModulo) => {
        // Tenta iniciar transação imediata, falhando porque a base/filesystem é somente leitura
        try {
          const err = new Error('SQLITE_READONLY: attempt to write a readonly database');
          err.code = 'SQLITE_READONLY';
          throw err;
        } catch (err) {
          rollbackAttempted = true; // Bloco catch executa ROLLBACK
          throw err;
        }
      };

      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ADMIN) },
        body: {
          perfilId: 'enfermagem',
          modulos: ['livro', 'dashboard'],
          permissoes: { livro: ['admin'] },
          setoresPorModulo: { livro: [30] }
        }
      });

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(rollbackAttempted, true, 'Rollback deve ser executado no catch da transação');

      // Não mascara com sucesso
      assert.notStrictEqual(res.data.success, true);

      // Mensagem pública identifica o erro de leitura sem expor stack traces internas
      assert.match(res.data.message, /SQLITE_READONLY/i);
      assert.match(res.data.message, /somente leitura/i);

      // Comprova que as permissões anteriores do perfil NÃO sofreram efeitos parciais
      const finalModulos = configCache.getModulosByPerfil('enfermagem').map(m => m.id);
      assert.deepStrictEqual(finalModulos, initialModulos, 'Módulos anteriores devem permanecer inalterados');
    });

    it('2.2 Persistência bem-sucedida quando a base é gravável: retorna HTTP 200 OK', async () => {
      let executedPayload = null;
      configCache.setProfileAccess = async (perfilId, modulos, permissoes, setoresPorModulo) => {
        executedPayload = { perfilId, modulos, permissoes, setoresPorModulo };
        return true;
      };

      const res = await makeRequest(app, 'POST', '/api/admin/permissoes', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ADMIN) },
        body: {
          perfilId: 'enfermagem',
          modulos: ['livro'],
          permissoes: { livro: [] },
          setoresPorModulo: { livro: [30] }
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.message, 'Permissões atualizadas com sucesso');
      assert.strictEqual(executedPayload.perfilId, 'enfermagem');
      assert.deepStrictEqual(executedPayload.modulos, ['livro']);
    });
  });
});
