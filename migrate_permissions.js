const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'auth.sqlite/config.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS perfil_permissoes (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    permissao TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id, permissao),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);
  
  db.run(`INSERT OR IGNORE INTO modulos (id, nome, descricao, icon) VALUES
    ('escala', 'Escala', 'Consulta e organização das escalas assistenciais por data, turno e setor', 'bi-calendar-week')`);
    
  db.run(`INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES
    ('psicologia', 'escala'),
    ('enfermagem', 'escala')`);

  db.run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES
    ('enfermagem', 'escala', 'editar_publicar_escala'),
    ('psicologia', 'escala', 'editar_publicar_escala')`);
    
  console.log("Migração de tabela concluída.");
});
db.close();
