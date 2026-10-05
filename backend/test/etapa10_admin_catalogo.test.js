const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3');

const origAll = sqlite3.Database.prototype.all;
const origRun = sqlite3.Database.prototype.run;

let dbRows = [];
let forceDbError = false;
let tasyCallCount = 0;

function applyMocks() {
  sqlite3.Database.prototype.all = function(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    if (forceDbError) return cb(new Error('Simulated SQLite Error'), null);
    
    if (sql.includes('config_migrations')) return cb(null, [{ id: 'mocked' }]); 
    if (sql.includes('SELECT * FROM relatorios_tasy')) return cb(null, dbRows);
    
    return cb(null, []);
  };

  sqlite3.Database.prototype.run = function(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    if (forceDbError && sql.includes('INSERT')) return cb(new Error('Insert Failed'));
    if (forceDbError && sql.includes('UPDATE')) return cb(new Error('Update Failed'));
    if (forceDbError && sql.includes('DELETE')) return cb(new Error('Delete Failed'));
    
    if (sql.includes('INSERT INTO relatorios_tasy')) {
      const id = params[0];
      const cd = params[1];
      const ativo = params[6];
      const row = dbRows.find(r => r.id === id);
      if (row) row.ativo = ativo;
      else dbRows.push({ id, cd_relatorio: cd, ativo, ordem: 1 });
      return cb.call({ lastID: 1, changes: 1 }, null);
    }
    if (sql.includes('UPDATE relatorios_tasy SET ativo')) {
      const novoAtivo = params[0];
      const id = params[1];
      const row = dbRows.find(r => r.id === id);
      if (row) row.ativo = novoAtivo;
      return cb.call({ lastID: 1, changes: 1 }, null);
    }
    if (sql.includes('DELETE FROM relatorios_tasy WHERE id = ?')) {
      const id = params[0];
      dbRows = dbRows.filter(r => r.id !== id);
      return cb.call({ lastID: 1, changes: 1 }, null);
    }
    return cb.call({ lastID: 1, changes: 1 }, null);
  };
}

const configCache = require('../src/core/config/configCache');
const adminController = require('../src/modules/admin/adminController');
const recepcaoController = require('../src/modules/recepcao/recepcaoController');
const errorHandler = require('../src/core/middlewares/errorHandler');
const tasyReportsClient = require('../src/modules/recepcao/tasyReportsClient');

const runAdmin = (handler, body, params = {}) => new Promise(resolve => {
  const req = { body, params, session: { usuario: { perfilAtivo: 'admin' } } };
  const res = { _status: 200, status(code){ this._status=code; return this; }, json(data){ resolve({status: this._status, body: data}); } };
  const next = err => errorHandler(err, req, res, () => resolve({status: res._status||500, body: res._body}));
  handler(req, res, next);
});

const runRecepcao = (id) => new Promise(resolve => {
  const req = { query:{nr_atendimento:'123'}, params: { id, nrAtendimento: '123' }, session: { usuario: { perfilAtivo: 'admin' } } };
  const res = { _status: 200, headers:{}, status(code){ this._status=code; return this; }, setHeader(){ return this; }, send(){ resolve({status: this._status}); }, json(data){ resolve({status: this._status}); } };
  const next = err => errorHandler(err, req, res, () => resolve({status: res._status||500}));
  recepcaoController.gerarRelatorioAtendimento(req, res, next);
});

describe('Etapa 10.1 - Ciclo Real de Recarga e Contrato Administrativo', () => {
  beforeEach(async () => {
    applyMocks();
    dbRows = []; 
    forceDbError = false;
    tasyCallCount = 0;
    tasyReportsClient.gerarRelatorioPdf = async () => {
      tasyCallCount++;
      return Buffer.from('PDF');
    };
  });

  afterEach(() => {
    sqlite3.Database.prototype.all = origAll;
    sqlite3.Database.prototype.run = origRun;
  });

  it('1. Carga com ID 101 ativo', async () => {
    dbRows = [{ id: 'rel_101', cd_relatorio: 101, ativo: 1, ordem: 1 }];
    const loaded = await configCache.load();
    assert.strictEqual(loaded, true);
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'AVAILABLE');
    const res = await runRecepcao('101');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(tasyCallCount, 1);
  });

  it('2. Falha de recarga causa UNAVAILABLE e listagem/emissão em 503', async () => {
    forceDbError = true;
    const loaded = await configCache.load();
    assert.strictEqual(loaded, false);
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'UNAVAILABLE');
    const res = await runRecepcao('101');
    assert.strictEqual(res.status, 503);
    assert.strictEqual(tasyCallCount, 0, 'Zero chamadas Tasy quando indisponível');
  });

  it('3. Recuperação com somente ID 202 ativo: ID 101 bloqueado em 403 (zero chamadas Tasy) e ID 202 em 200 (1 chamada Tasy)', async () => {
    forceDbError = false;
    dbRows = [{ id: 'rel_202', cd_relatorio: 202, ativo: 1, ordem: 1 }];
    await configCache.load();
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'AVAILABLE');

    // ID 101 deve ser bloqueado em 403
    tasyCallCount = 0;
    const res101 = await runRecepcao('101');
    assert.strictEqual(res101.status, 403);
    assert.strictEqual(tasyCallCount, 0, 'Zero chamadas Tasy para relatório revogado');

    // ID 202 deve ser emitido com 200
    const res202 = await runRecepcao('202');
    assert.strictEqual(res202.status, 200);
    assert.strictEqual(tasyCallCount, 1, 'Exatamente uma chamada Tasy para relatório autorizado');
  });

  it('4. Contrato Administrativo: Salvar/Criar Relatório (Sucesso, Falha de Persistência, Falha de Recarga)', async () => {
    dbRows = [];
    
    // 4a. Sucesso completo
    const resSucesso = await runAdmin(adminController.salvarRelatorioTasy, { cd_relatorio: 301, nr_sequencia: 1, ds_titulo: 'Relatório 301' });
    assert.strictEqual(resSucesso.status, 200);
    assert.strictEqual(resSucesso.body.success, true);
    assert.strictEqual(resSucesso.body.partialSuccess, undefined);
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'AVAILABLE');

    // 4b. Falha de persistência (INSERT falha)
    forceDbError = true;
    const resErro = await runAdmin(adminController.salvarRelatorioTasy, { cd_relatorio: 302, nr_sequencia: 1, ds_titulo: 'Relatório 302' });
    assert.strictEqual(resErro.status, 500);
    assert.strictEqual(resErro.body.success, false);

    // 4c. Falha de recarga (INSERT funciona, load() falha)
    forceDbError = false;
    const backupAll = sqlite3.Database.prototype.all;
    sqlite3.Database.prototype.all = function(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      if (sql.includes('SELECT * FROM relatorios_tasy')) return cb(new Error('Load Error'), null);
      if (sql.includes('config_migrations')) return cb(null, [{ id: 'mocked' }]); 
      return cb(null, []);
    };

    const resParcial = await runAdmin(adminController.salvarRelatorioTasy, { cd_relatorio: 303, nr_sequencia: 1, ds_titulo: 'Relatório 303' });
    assert.strictEqual(resParcial.status, 200);
    assert.strictEqual(resParcial.body.success, true);
    assert.strictEqual(resParcial.body.partialSuccess, true);
    assert.strictEqual(resParcial.body.cacheReloaded, false);
    assert.strictEqual(resParcial.body.message, 'Alteração salva, mas os relatórios estão temporariamente indisponíveis.');
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'UNAVAILABLE', 'Catálogo fica indisponível após falha de recarga');

    sqlite3.Database.prototype.all = backupAll;
  });

  it('5. Contrato Administrativo: Ativar/Desativar Relatório (Sucesso, Falha de Persistência, Falha de Recarga)', async () => {
    dbRows = [{ id: 'rel_401', cd_relatorio: 401, ativo: 1, ordem: 1 }];
    await configCache.load();

    // 5a. Sucesso completo
    const resSucesso = await runAdmin(adminController.toggleRelatorioTasy, { ativo: false }, { id: 'rel_401' });
    assert.strictEqual(resSucesso.status, 200);
    assert.strictEqual(resSucesso.body.success, true);
    assert.strictEqual(resSucesso.body.partialSuccess, undefined);

    // 5b. Falha de persistência (UPDATE falha)
    forceDbError = true;
    const resErro = await runAdmin(adminController.toggleRelatorioTasy, { ativo: true }, { id: 'rel_401' });
    assert.strictEqual(resErro.status, 500);
    assert.strictEqual(resErro.body.success, false);

    // 5c. Falha de recarga (UPDATE funciona, load() falha)
    forceDbError = false;
    const backupAll = sqlite3.Database.prototype.all;
    sqlite3.Database.prototype.all = function(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      if (sql.includes('SELECT * FROM relatorios_tasy')) return cb(new Error('Load Error'), null);
      if (sql.includes('config_migrations')) return cb(null, [{ id: 'mocked' }]); 
      return cb(null, []);
    };

    const resParcial = await runAdmin(adminController.toggleRelatorioTasy, { ativo: true }, { id: 'rel_401' });
    assert.strictEqual(resParcial.status, 200);
    assert.strictEqual(resParcial.body.success, true);
    assert.strictEqual(resParcial.body.partialSuccess, true);
    assert.strictEqual(resParcial.body.cacheReloaded, false);
    assert.strictEqual(resParcial.body.message, 'Status alterado, mas os relatórios estão temporariamente indisponíveis.');
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'UNAVAILABLE');

    sqlite3.Database.prototype.all = backupAll;
  });

  it('6. Contrato Administrativo: Excluir Relatório (Sucesso, Falha de Persistência, Falha de Recarga)', async () => {
    dbRows = [{ id: 'rel_501', cd_relatorio: 501, ativo: 1, ordem: 1 }];
    await configCache.load();

    // 6a. Sucesso completo
    const resSucesso = await runAdmin(adminController.deletarRelatorioTasy, {}, { id: 'rel_501' });
    assert.strictEqual(resSucesso.status, 200);
    assert.strictEqual(resSucesso.body.success, true);
    assert.strictEqual(resSucesso.body.partialSuccess, undefined);

    // 6b. Falha de persistência (DELETE falha)
    forceDbError = true;
    const resErro = await runAdmin(adminController.deletarRelatorioTasy, {}, { id: 'rel_502' });
    assert.strictEqual(resErro.status, 500);
    assert.strictEqual(resErro.body.success, false);

    // 6c. Falha de recarga (DELETE funciona, load() falha)
    forceDbError = false;
    dbRows = [{ id: 'rel_503', cd_relatorio: 503, ativo: 1, ordem: 1 }];
    const backupAll = sqlite3.Database.prototype.all;
    sqlite3.Database.prototype.all = function(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      if (sql.includes('SELECT * FROM relatorios_tasy')) return cb(new Error('Load Error'), null);
      if (sql.includes('config_migrations')) return cb(null, [{ id: 'mocked' }]); 
      return cb(null, []);
    };

    const resParcial = await runAdmin(adminController.deletarRelatorioTasy, {}, { id: 'rel_503' });
    assert.strictEqual(resParcial.status, 200);
    assert.strictEqual(resParcial.body.success, true);
    assert.strictEqual(resParcial.body.partialSuccess, true);
    assert.strictEqual(resParcial.body.cacheReloaded, false);
    assert.strictEqual(resParcial.body.message, 'Relatório excluído, mas os relatórios estão temporariamente indisponíveis.');
    assert.strictEqual(configCache.getRelatoriosTasyState(), 'UNAVAILABLE');

    sqlite3.Database.prototype.all = backupAll;
  });
});
