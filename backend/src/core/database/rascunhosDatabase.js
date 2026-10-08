const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

const dbDir = path.resolve(__dirname, '../../../../auth.sqlite');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Operational DB instead of config.db
const dbPath = path.join(dbDir, 'operacional.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS triagem_rascunhos (
    nr_atendimento NUMBER PRIMARY KEY,
    rascunho_json TEXT,
    nm_usuario TEXT,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function saveRascunho(nrAtendimento, rascunhoJson, nmUsuario, clientVersion = null) {
  return new Promise((resolve, reject) => {
    db.get('SELECT version FROM triagem_rascunhos WHERE nr_atendimento = ?', [nrAtendimento], (err, row) => {
      if (err) return reject(err);
      if (row) {
        if (clientVersion && clientVersion < row.version) {
          return reject(new Error('Rascunho modificado por outro usuário ou sessão (Conflito de Versão)'));
        }
        const nextVersion = row.version + 1;
        db.run(
          "UPDATE triagem_rascunhos SET rascunho_json = ?, nm_usuario = ?, version = ?, updated_at = datetime('now') WHERE nr_atendimento = ?",
          [rascunhoJson, nmUsuario, nextVersion, nrAtendimento],
          (err) => err ? reject(err) : resolve({ version: nextVersion })
        );
      } else {
        db.run(
          "INSERT INTO triagem_rascunhos (nr_atendimento, rascunho_json, nm_usuario, version) VALUES (?, ?, ?, 1)",
          [nrAtendimento, rascunhoJson, nmUsuario],
          (err) => err ? reject(err) : resolve({ version: 1 })
        );
      }
    });
  });
}

function getRascunho(nrAtendimento) {
  return new Promise((resolve, reject) => {
    db.get('SELECT rascunho_json, version, updated_at FROM triagem_rascunhos WHERE nr_atendimento = ?', [nrAtendimento], (err, row) => {
      if (err) return reject(err);
      if (row) {
        const data = JSON.parse(row.rascunho_json);
        data._version = row.version;
        resolve(data);
      } else {
        resolve(null);
      }
    });
  });
}

function removeRascunho(nrAtendimento) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM triagem_rascunhos WHERE nr_atendimento = ?', [nrAtendimento], (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

module.exports = {
  db,
  saveRascunho,
  getRascunho,
  removeRascunho
};

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS triagem_finalizacoes (
    nr_atendimento NUMBER PRIMARY KEY,
    nr_seq_senha NUMBER,
    status TEXT,
    etapa_atual TEXT,
    tentativas INTEGER DEFAULT 0,
    ultimo_erro TEXT,
    dt_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    dt_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    nm_usuario TEXT
  )`);
});

function getFinalizacao(nrAtendimento) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM triagem_finalizacoes WHERE nr_atendimento = ?', [nrAtendimento], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function upsertFinalizacao(data) {
  return new Promise((resolve, reject) => {
    db.get('SELECT nr_atendimento FROM triagem_finalizacoes WHERE nr_atendimento = ?', [data.nr_atendimento], (err, row) => {
      if (err) return reject(err);
      if (row) {
        db.run(
          `UPDATE triagem_finalizacoes SET 
           nr_seq_senha = COALESCE(?, nr_seq_senha),
           status = COALESCE(?, status), 
           etapa_atual = COALESCE(?, etapa_atual), 
           tentativas = tentativas + 1, 
           ultimo_erro = ?, 
           dt_atualizacao = datetime('now'), 
           nm_usuario = COALESCE(?, nm_usuario) 
           WHERE nr_atendimento = ?`,
          [data.nr_seq_senha, data.status, data.etapa_atual, data.ultimo_erro, data.nm_usuario, data.nr_atendimento],
          (err) => err ? reject(err) : resolve(true)
        );
      } else {
        db.run(
          `INSERT INTO triagem_finalizacoes (nr_atendimento, nr_seq_senha, status, etapa_atual, tentativas, ultimo_erro, nm_usuario) 
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [data.nr_atendimento, data.nr_seq_senha, data.status, data.etapa_atual, data.ultimo_erro, data.nm_usuario],
          (err) => err ? reject(err) : resolve(true)
        );
      }
    });
  });
}

module.exports.getFinalizacao = getFinalizacao;
module.exports.upsertFinalizacao = upsertFinalizacao;
