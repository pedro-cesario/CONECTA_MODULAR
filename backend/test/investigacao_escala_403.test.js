const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const configCache = require('../src/core/config/configCache');
const { requireAuth } = require('../src/core/middlewares/authMiddleware');
const escalasRoutes = require('../src/modules/escalas/routes');
const ocorrenciasRoutes = require('../src/modules/ocorrencias/routes');
const escalaAtivaService = require('../src/modules/escalas/escalaAtivaService');
const ocorrenciaService = require('../src/modules/ocorrencias/ocorrenciaService');
const redisClient = require('../src/core/config/redisClient');

// Spies and Mocks
let obterEscalaAtivaCalls = [];
let salvarEscalaAtivaCalls = [];
let obterEscalaTecnicaCalls = [];
let salvarEscalaTecnicaCalls = [];
let listarVersoesCalls = [];
let compararVersoesCalls = [];

const origObterEscalaAtiva = escalaAtivaService.obterEscalaAtiva;
const origSalvarEscalaAtiva = escalaAtivaService.salvarEscalaAtiva;
const origObterEscalaTecnica = ocorrenciaService.obterEscalaTecnica;
const origSalvarEscalaTecnica = ocorrenciaService.salvarEscalaTecnica;
const origListarVersoes = escalaAtivaService.listarVersoes;
const origCompararVersoes = escalaAtivaService.compararVersoes;

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Attach session based on header
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
  apiRouter.use('/escala-ativa', requireAuth, escalasRoutes);
  apiRouter.use('/', requireAuth, ocorrenciasRoutes);

  app.use('/api', apiRouter);
  return app;
}

// Helper to make mock requests
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

// Perfis Fictícios para Teste
const USUARIO_ENFERMAGEM = {
  nm_usuario: 'ENF_MARIA',
  perfilAtivo: 'enfermagem',
  perfisDisponiveis: [{ id: 'enfermagem', nome: 'Enfermagem' }],
  cd_perfis: { enfermagem: 10 }
};

const USUARIO_PSICOLOGIA_SEM_EDIT = {
  nm_usuario: 'PSI_JOAO',
  perfilAtivo: 'psicologia',
  perfisDisponiveis: [{ id: 'psicologia', nome: 'Psicologia' }],
  cd_perfis: { psicologia: 20 }
};

const USUARIO_PSICOLOGIA_SUP_COM_EDIT = {
  nm_usuario: 'PSI_SUP_CARLOS',
  perfilAtivo: 'psicologia_sup',
  perfisDisponiveis: [{ id: 'psicologia_sup', nome: 'Psicologia Supervisão' }],
  cd_perfis: { psicologia_sup: 25 }
};

const USUARIO_DUPLO_LIVRO_E_ESCALA = {
  nm_usuario: 'COORD_LIVRO_ESCALA',
  perfilAtivo: 'admin',
  perfisDisponiveis: [{ id: 'admin', nome: 'Administrador' }],
  cd_perfis: { admin: 1 }
};

const USUARIO_HIBRIDO = {
  nm_usuario: 'ENF_E_PSI',
  perfilAtivo: 'perfil_hibrido',
  perfisDisponiveis: [{ id: 'perfil_hibrido', nome: 'Híbrido' }],
  cd_perfis: { perfil_hibrido: 50 }
};

const USUARIO_RECEPCAO = {
  nm_usuario: 'REC_ANA',
  perfilAtivo: 'recepcao',
  perfisDisponiveis: [{ id: 'recepcao', nome: 'Recepção' }],
  cd_perfis: { recepcao: 30 }
};

describe('Incidente 1 — Livro Administrativo / Escala Ativa 403 e Salvamento Parcial', () => {
  let app;

  before(async () => {
    await configCache.load();
    configCache.setCacheForTest({
      perfilModulos: [
        ...configCache.getCachedPerfilModulos(),
        { perfil_id: 'perfil_hibrido', modulo_id: 'livro' },
        { perfil_id: 'perfil_hibrido', modulo_id: 'escala' }
      ],
      perfilModuloSetores: [
        ...configCache.getCachedPerfilModuloSetores(),
        { perfil_id: 'perfil_hibrido', modulo_id: 'livro', cd_setor_atendimento: 30 },
        { perfil_id: 'perfil_hibrido', modulo_id: 'escala', cd_setor_atendimento: 4 }
      ]
    });
  });

  after(async () => {
    try {
      await redisClient.disconnect();
    } catch (e) {}
  });

  beforeEach(() => {
    obterEscalaAtivaCalls = [];
    salvarEscalaAtivaCalls = [];
    obterEscalaTecnicaCalls = [];
    salvarEscalaTecnicaCalls = [];
    listarVersoesCalls = [];
    compararVersoesCalls = [];

    escalaAtivaService.obterEscalaAtiva = async (cdSetor, dtPlantao, turno) => {
      obterEscalaAtivaCalls.push({ cdSetor, dtPlantao, turno });
      return { cd_setor: cdSetor, dt_plantao: dtPlantao, turno, tecnicos: [] };
    };

    escalaAtivaService.salvarEscalaAtiva = async (payload, nmUsuario) => {
      salvarEscalaAtivaCalls.push({ payload, nmUsuario });
      return { success: true, updated: true };
    };

    escalaAtivaService.listarVersoes = async (cdSetor, dtPlantao, turno) => {
      listarVersoesCalls.push({ cdSetor, dtPlantao, turno });
      return [{ nr_versao: 1, dt_atualizacao: '2026-10-03' }];
    };

    escalaAtivaService.compararVersoes = async (cdSetor, dtPlantao, turno, versao) => {
      compararVersoesCalls.push({ cdSetor, dtPlantao, turno, versao });
      return { alteracoes: [] };
    };

    ocorrenciaService.obterEscalaTecnica = async (data, cdSetor, turno) => {
      obterEscalaTecnicaCalls.push({ data, cdSetor, turno });
      return { data, cdSetor, turno, registros: [] };
    };

    ocorrenciaService.salvarEscalaTecnica = async (payload, usuario) => {
      salvarEscalaTecnicaCalls.push({ payload, usuario: usuario.nm_usuario });
      return { success: true };
    };

    app = createTestApp();
  });

  afterEach(() => {
    escalaAtivaService.obterEscalaAtiva = origObterEscalaAtiva;
    escalaAtivaService.salvarEscalaAtiva = origSalvarEscalaAtiva;
    ocorrenciaService.obterEscalaTecnica = origObterEscalaTecnica;
    ocorrenciaService.salvarEscalaTecnica = origSalvarEscalaTecnica;
    escalaAtivaService.listarVersoes = origListarVersoes;
    escalaAtivaService.compararVersoes = origCompararVersoes;
  });

  describe('1. Rastreamento e Delimitação Segura de Rotas (Restrição Mínima)', () => {
    it('1.1 Sessão ausente: deve retornar HTTP 401 Unauthorized', async () => {
      const res = await makeRequest(app, 'GET', '/api/escala-ativa?cd_setor=30&dt_plantao=2026-10-03&turno=M');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(obterEscalaAtivaCalls.length, 0);
    });

    it('1.2 Perfil sem livro nem escala (recepcao): bloqueio com HTTP 403 via middleware', async () => {
      const res = await makeRequest(app, 'GET', '/api/escala-ativa?cd_setor=30&dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_RECEPCAO) }
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(obterEscalaAtivaCalls.length, 0);
    });

    it('1.3 GET /api/escala-ativa/versao: deve permanecer RESTRITO ao módulo escala (enfermagem bloqueada com 403)', async () => {
      const res = await makeRequest(app, 'GET', '/api/escala-ativa/versao?cd_setor=30&dt_plantao=2026-10-03&turno=M&versao=1', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.data.message, /Acesso negado/i);
    });

    it('1.4 GET /api/escala-ativa/versoes e /diff com setor autorizado 30: sucesso 200 para enfermagem', async () => {
      const resVersoes = await makeRequest(app, 'GET', '/api/escala-ativa/versoes?cd_setor=30&dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(resVersoes.status, 200);
      assert.strictEqual(listarVersoesCalls.length, 1);

      const resDiff = await makeRequest(app, 'GET', '/api/escala-ativa/diff?cd_setor=30&dt_plantao=2026-10-03&turno=M&versao=1', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(resDiff.status, 200);
      assert.strictEqual(compararVersoesCalls.length, 1);
    });

    it('1.5 GET /api/escala-ativa/versoes e /diff com setor NÃO autorizado 99: bloqueado com HTTP 403', async () => {
      const resVersoes = await makeRequest(app, 'GET', '/api/escala-ativa/versoes?cd_setor=99&dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(resVersoes.status, 403);
      assert.strictEqual(resVersoes.data.message, 'Setor não autorizado para o perfil ativo');

      const resDiff = await makeRequest(app, 'GET', '/api/escala-ativa/diff?cd_setor=99&dt_plantao=2026-10-03&turno=M&versao=1', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(resDiff.status, 403);
      assert.strictEqual(resDiff.data.message, 'Setor não autorizado para o perfil ativo');
    });
  });

  describe('2. Preservação de Permissão editar_publicar_escala e Avaliação Conjunta de Módulo e Setor', () => {
    it('2.1 Usuário psicologia SEM permissão editar_publicar_escala: bloqueado com HTTP 403 em PUT / e POST /escala-tecnica', async () => {
      const payload = { cd_setor_atendimento: 4, data_plantao: '2026-10-03', turno: 'M' };

      const resPut = await makeRequest(app, 'PUT', '/api/escala-ativa', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_PSICOLOGIA_SEM_EDIT) },
        body: payload
      });
      assert.strictEqual(resPut.status, 403);
      assert.strictEqual(salvarEscalaAtivaCalls.length, 0);

      const resPost = await makeRequest(app, 'POST', '/api/escala-tecnica', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_PSICOLOGIA_SEM_EDIT) },
        body: payload
      });
      assert.strictEqual(resPost.status, 403);
      assert.strictEqual(salvarEscalaTecnicaCalls.length, 0);
    });

    it('2.2 Usuário psicologia COM permissão editar_publicar_escala: sucesso 200 no setor autorizado 4', async () => {
      const payload = { cd_setor_atendimento: 4, data_plantao: '2026-10-03', turno: 'M' };

      const resPut = await makeRequest(app, 'PUT', '/api/escala-ativa', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_PSICOLOGIA_SUP_COM_EDIT) },
        body: payload
      });
      assert.strictEqual(resPut.status, 200);
      assert.strictEqual(salvarEscalaAtivaCalls.length, 1);
    });

    it('2.3 Avaliação conjunta de módulo e setor: perfil com ambos os módulos (perfil_hibrido)', async () => {
      // Perfil híbrido: autorizado para setor 30 via livro, setor 4 via escala, mas recusado no 99
      const resSetor30 = await makeRequest(app, 'GET', '/api/escala-ativa?cd_setor=30&dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_HIBRIDO) }
      });
      assert.strictEqual(resSetor30.status, 200, 'Acesso permitido ao setor 30 via módulo livro');

      const resSetor4 = await makeRequest(app, 'GET', '/api/escala-ativa?cd_setor=4&dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_HIBRIDO) }
      });
      assert.strictEqual(resSetor4.status, 200, 'Acesso permitido ao setor 4 via módulo escala');

      const resSetor99 = await makeRequest(app, 'GET', '/api/escala-ativa?cd_setor=99&dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_HIBRIDO) }
      });
      assert.strictEqual(resSetor99.status, 403, 'Acesso bloqueado ao setor 99 não autorizado em nenhum dos módulos');
      assert.strictEqual(resSetor99.data.message, 'Setor não autorizado para o perfil ativo');

      // Consulta sem cd_setor: rejeição controlada com 400 Bad Request
      const resSemSetor = await makeRequest(app, 'GET', '/api/escala-ativa?dt_plantao=2026-10-03&turno=M', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_HIBRIDO) }
      });
      assert.strictEqual(resSemSetor.status, 400);
      assert.match(resSemSetor.data.message, /cd_setor.*obrigat/i);
    });
  });

  describe('3. Tratamento Granular de Salvamento Parcial no Handler do Frontend', () => {
    // Simula a lógica implementada em frontend/src/modules/livro/livro.js linhas 2413-2475
    async function simulateGranularSaveFlow(appUser, payload, options = {}) {
      const {
        failPreCheck = false,
        failPut = false,
        putUnknownTimeout = false,
        failPost = false,
        failReload = false
      } = options;

      let draftCleared = false;
      let toast = null;

      try {
        const setorId = payload.cd_setor_atendimento;
        const dtPlantao = payload.data_plantao || '2026-10-03';
        const turno = payload.turno || 'M';

        // 1. Pré-consulta
        let checkResult;
        try {
          if (failPreCheck) {
            throw { status: 403, data: { message: 'Setor não autorizado para o perfil ativo' } };
          }
          checkResult = await makeRequest(
            app,
            'GET',
            `/api/escala-ativa?cd_setor=${encodeURIComponent(String(setorId))}&dt_plantao=${encodeURIComponent(dtPlantao)}&turno=${encodeURIComponent(turno)}`,
            { headers: { 'x-test-user': JSON.stringify(appUser) } }
          );
          if (checkResult.status !== 200 || !checkResult.data?.success) {
            throw checkResult;
          }
        } catch (err) {
          const msg = err?.data?.message || err?.message || 'Falha na comunicação com o servidor';
          toast = { type: 'error', message: `Falha ao verificar escala ativa: ${msg}. Nenhuma alteração foi gravada.` };
          return { toast, draftCleared };
        }

        // 2. Persistência SQLite (Escala Ativa)
        let resultDb;
        try {
          if (putUnknownTimeout) {
            throw new Error('ETIMEDOUT');
          }
          if (failPut) {
            resultDb = { status: 500, data: { success: false, message: 'Erro no SQLite' } };
          } else {
            resultDb = await makeRequest(app, 'PUT', '/api/escala-ativa', {
              headers: { 'x-test-user': JSON.stringify(appUser) },
              body: payload
            });
          }
        } catch (err) {
          const msg = err?.data?.message || err?.message || 'Erro de comunicação ao salvar escala ativa';
          toast = { type: 'error', message: `Não foi possível confirmar a gravação da escala ativa: ${msg}. Verifique antes de tentar novamente. Rascunho preservado.` };
          return { toast, draftCleared };
        }

        if (!resultDb?.data?.success) {
          toast = { type: 'error', message: resultDb?.data?.message || 'Falha ao salvar escala ativa. Nenhuma alteração persistida.' };
          return { toast, draftCleared };
        }

        // 3. Persistência Oracle (Histórico Escala Técnica)
        let resultOc;
        try {
          if (failPost) {
            throw new Error('ORA-00001: unique constraint violated');
          }
          resultOc = await makeRequest(app, 'POST', '/api/escala-tecnica', {
            headers: { 'x-test-user': JSON.stringify(appUser) },
            body: payload
          });
        } catch (err) {
          const msg = err?.data?.message || err?.message || 'Falha ao registrar histórico';
          toast = { type: 'warning', message: `Escala ativa atualizada com sucesso, mas o histórico assistencial não foi confirmado: ${msg}. O rascunho foi mantido para conferência.` };
          return { toast, draftCleared };
        }

        if (!resultOc?.data?.success) {
          toast = { type: 'warning', message: `Escala ativa salva no DB, mas houve falha no histórico assistencial: ${resultOc?.data?.message || 'erro desconhecido'}. Rascunho mantido.` };
          return { toast, draftCleared };
        }

        // Sucesso em ambas as gravações
        draftCleared = true;

        // 4. Recarga da visualização da tela
        try {
          if (failReload) {
            throw new Error('Network error on reload');
          }
          toast = { type: 'success', message: 'Escala salva com sucesso' };
        } catch (err) {
          toast = { type: 'warning', message: 'Escala gravada com sucesso! Houve falha apenas na atualização da visualização. Recarregue a página se necessário.' };
        }
      } catch (err) {
        toast = { type: 'error', message: 'Erro inesperado durante a operação de salvamento. O rascunho foi preservado.' };
      }

      return { toast, draftCleared };
    }

    it('3.1 Falha antes de gravar: rascunho mantido, 0 gravações, aviso de não-gravação', async () => {
      const payload = { cd_setor_atendimento: 99, data_plantao: '2026-10-03', turno: 'M' };
      const { toast, draftCleared } = await simulateGranularSaveFlow(USUARIO_ENFERMAGEM, payload, { failPreCheck: true });

      assert.strictEqual(draftCleared, false, 'Rascunho NÃO deve ser limpo');
      assert.strictEqual(toast.type, 'error');
      assert.match(toast.message, /Nenhuma alteração foi gravada/);
      assert.strictEqual(salvarEscalaAtivaCalls.length, 0);
      assert.strictEqual(salvarEscalaTecnicaCalls.length, 0);
    });

    it('3.2 Resultado desconhecido no PUT (timeout): rascunho mantido, 0 chamadas no POST Oracle', async () => {
      const payload = { cd_setor_atendimento: 30, data_plantao: '2026-10-03', turno: 'M' };
      const { toast, draftCleared } = await simulateGranularSaveFlow(USUARIO_ENFERMAGEM, payload, { putUnknownTimeout: true });

      assert.strictEqual(draftCleared, false, 'Rascunho mantido diante de incerteza');
      assert.strictEqual(toast.type, 'error');
      assert.match(toast.message, /Não foi possível confirmar a gravação/);
      assert.strictEqual(salvarEscalaTecnicaCalls.length, 0, 'Zero chamadas ao Oracle');
    });

    it('3.3 PUT confirmado com histórico Oracle não confirmado: aviso claro de gravação parcial e rascunho preservado', async () => {
      const payload = { cd_setor_atendimento: 30, data_plantao: '2026-10-03', turno: 'M' };
      const { toast, draftCleared } = await simulateGranularSaveFlow(USUARIO_ENFERMAGEM, payload, { failPost: true });

      assert.strictEqual(draftCleared, false, 'Rascunho mantido para conferência assistencial');
      assert.strictEqual(toast.type, 'warning');
      assert.match(toast.message, /Escala ativa atualizada com sucesso, mas o histórico assistencial não foi confirmado/);
      assert.strictEqual(salvarEscalaAtivaCalls.length, 1, 'SQLite foi gravado');
    });

    it('3.4 Gravações concluídas com falha apenas na recarga da tela: rascunho limpo e aviso amigável', async () => {
      const payload = { cd_setor_atendimento: 30, data_plantao: '2026-10-03', turno: 'M' };
      const { toast, draftCleared } = await simulateGranularSaveFlow(USUARIO_ENFERMAGEM, payload, { failReload: true });

      assert.strictEqual(draftCleared, true, 'Rascunho limpo porque persistência no SQLite e Oracle ocorreu');
      assert.strictEqual(toast.type, 'warning');
      assert.match(toast.message, /Escala gravada com sucesso! Houve falha apenas na atualização da visualização/);
      assert.strictEqual(salvarEscalaAtivaCalls.length, 1);
      assert.strictEqual(salvarEscalaTecnicaCalls.length, 1);
    });

    it('3.5 Sucesso total: gravações persistidas, rascunho limpo e toast de sucesso', async () => {
      const payload = { cd_setor_atendimento: 30, data_plantao: '2026-10-03', turno: 'M' };
      const { toast, draftCleared } = await simulateGranularSaveFlow(USUARIO_ENFERMAGEM, payload);

      assert.strictEqual(draftCleared, true);
      assert.strictEqual(toast.type, 'success');
      assert.strictEqual(toast.message, 'Escala salva com sucesso');
      assert.strictEqual(salvarEscalaAtivaCalls.length, 1);
      assert.strictEqual(salvarEscalaTecnicaCalls.length, 1);
    });
  });
  describe('4. Validação de Acesso Agregado e Escrita Restrita', () => {
    let origListarTodas;
    let origPatioCirculante;
    let origObterEscalaTecnicaLocal;

    before(() => {
      origListarTodas = ocorrenciaService.listarTodasEscalasLiberadas;
      origPatioCirculante = escalaAtivaService.buscarPatioCirculanteGlobal;
      origObterEscalaTecnicaLocal = ocorrenciaService.obterEscalaTecnica;
      
      ocorrenciaService.listarTodasEscalasLiberadas = async () => [
        { cd_setor_atendimento: 30, nome: 'Escala 30' },
        { cd_setor_atendimento: 50, nome: 'Escala 50' }
      ];
      
      escalaAtivaService.buscarPatioCirculanteGlobal = async () => ({
        patio: [
          { cd_pessoa_fisica: 1, nome: 'Ana', cd_setor_atendimento: 30 },
          { cd_pessoa_fisica: 2, nome: 'Beto', cd_setor_atendimento: 50 }
        ],
        circulante: []
      });
      
      ocorrenciaService.obterEscalaTecnica = async (data, cdSetor, turno) => {
        if (cdSetor === null) {
          return { cd_setor_atendimento: 50, nome: 'Escala 50' };
        }
        return { cd_setor_atendimento: cdSetor, nome: 'Escala ' + cdSetor };
      };
    });

    after(() => {
      ocorrenciaService.listarTodasEscalasLiberadas = origListarTodas;
      escalaAtivaService.buscarPatioCirculanteGlobal = origPatioCirculante;
      ocorrenciaService.obterEscalaTecnica = origObterEscalaTecnicaLocal;
    });

    it('4.1 /escala-tecnica/todas filtra setores proibidos para perfil Livro', async () => {
      const res = await makeRequest(app, 'GET', '/api/escala-tecnica/todas?data=2026-10-03', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.length, 1);
      assert.strictEqual(res.data.data[0].cd_setor_atendimento, 30);
    });

    it('4.2 /escala-tecnica sem cd_setor filtra setores proibidos', async () => {
      const res = await makeRequest(app, 'GET', '/api/escala-tecnica?data=2026-10-03', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data, null);
    });

    it('4.3 /escala-ativa/patio-circulante-global filtra setores proibidos', async () => {
      const res = await makeRequest(app, 'GET', '/api/escala-ativa/patio-circulante-global?dt_plantao=2026-10-03', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.patio.length, 1);
      assert.strictEqual(res.data.data.patio[0].nome, 'Ana');
    });

    it('4.4 Escrita restrita combina módulo e setor corretamente', async () => {
      const res = await makeRequest(app, 'PUT', '/api/escala-ativa', {
        headers: { 'x-test-user': JSON.stringify(USUARIO_ENFERMAGEM) },
        body: { cd_setor_atendimento: 50, data_plantao: '2026-10-03', turno: 'M' }
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Setor não autorizado para o perfil ativo/);
    });
  });
});
