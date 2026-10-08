const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const routesPath = path.resolve(__dirname, '../src/modules/triagem-pa/routes.js');
const controllerPath = path.resolve(__dirname, '../src/modules/triagem-pa/TriagemPaController.js');

function criarApp(controller) {
  delete require.cache[routesPath];
  require.cache[controllerPath] = {
    id: controllerPath,
    filename: controllerPath,
    loaded: true,
    exports: controller
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { usuario: { nm_usuario: 'TESTE' } };
    next();
  });
  app.use('/api/triagem-pa', require(routesPath));
  return app;
}

async function requisitar(app, method, url, body) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /api/triagem-pa/buscar está registrado e uma busca vazia responde normalmente', async () => {
  const app = criarApp({
    buscar: async (_req, res) => res.json([]),
    cadastrarPaciente: () => {}, naoIdentificado: () => {}, semDocumento: () => {}, iniciar: () => {},
    descartarSenha: () => {}, statusSenha: () => {}, obterAlergias: () => {}, obterRascunho: () => {},
    salvarRascunho: () => {}, obterConfiguracoesClinicas: () => {}, finalizarTriagem: () => {}
  });
  const response = await requisitar(app, 'GET', '/api/triagem-pa/buscar?q=teste');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test('GET /buscar encaminha nome, CPF e data de nascimento ao controller oficial', async () => {
  const consultas = [];
  const app = criarApp({
    buscar: async (req, res) => {
      consultas.push(req.query.q);
      res.json([{ cd_pessoa_fisica: 77 }]);
    },
    cadastrarPaciente: () => {}, naoIdentificado: () => {}, semDocumento: () => {}, iniciar: () => {},
    descartarSenha: () => {}, statusSenha: () => {}, obterAlergias: () => {}, obterRascunho: () => {},
    salvarRascunho: () => {}, obterConfiguracoesClinicas: () => {}, finalizarTriagem: () => {}
  });
  for (const q of ['Maria da Silva', '123.456.789-09', '01/02/1990']) {
    const response = await requisitar(app, 'GET', `/api/triagem-pa/buscar?q=${encodeURIComponent(q)}`);
    assert.equal(response.status, 200);
  }
  assert.deepEqual(consultas, ['Maria da Silva', '123.456.789-09', '01/02/1990']);
});

test('POST /pacientes é o endpoint oficial de cadastro e devolve cd_pessoa_fisica', async () => {
  const app = criarApp({
    buscar: () => {},
    cadastrarPaciente: async (_req, res) => res.status(201).json({
      success: true,
      cd_pessoa_fisica: 4321,
      paciente: { cd_pessoa_fisica: 4321, nm_pessoa_fisica: 'Maria da Silva' }
    }),
    naoIdentificado: () => {}, semDocumento: () => {}, iniciar: () => {}, descartarSenha: () => {}, statusSenha: () => {},
    obterAlergias: () => {}, obterRascunho: () => {}, salvarRascunho: () => {}, obterConfiguracoesClinicas: () => {}, finalizarTriagem: () => {}
  });
  const response = await requisitar(app, 'POST', '/api/triagem-pa/pacientes', {
    nm_pessoa_fisica: 'Maria da Silva', dt_nascimento: '1990-02-01', nr_cpf: '12345678909'
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.cd_pessoa_fisica, 4321);
});
