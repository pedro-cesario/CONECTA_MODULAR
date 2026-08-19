const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbDir = path.resolve(__dirname, '../auth.sqlite');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'config.db');
const sqlite3 = require('sqlite3');
const { verbose } = sqlite3;
const sqlite3v = verbose();

const db = new sqlite3v.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function init() {
  console.log('[ConfigDB] Inicializando banco de configurações...');

  await run(`CREATE TABLE IF NOT EXISTS perfis (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    setorId INTEGER NOT NULL,
    grupoLdap TEXT NOT NULL,
    sessionFlag TEXT NOT NULL,
    setorReferenciaFixo INTEGER DEFAULT 0,
    dsPerfilTasy TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  await run(`CREATE TABLE IF NOT EXISTS modulos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    icon TEXT DEFAULT 'bi-gear',
    setorId INTEGER
  )`);

  await run(`CREATE TABLE IF NOT EXISTS perfil_modulos (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS perfil_permissoes (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    permissao TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id, permissao),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS perfil_modulo_setores (
    perfil_id TEXT NOT NULL,
    modulo_id TEXT NOT NULL,
    cd_setor_atendimento INTEGER NOT NULL,
    PRIMARY KEY (perfil_id, modulo_id, cd_setor_atendimento),
    FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS configuracoes_dashboard_pa (
    chave TEXT PRIMARY KEY,
    nr_sequencia_fila INTEGER,
    ds_fila TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  const existingCount = await get('SELECT COUNT(*) as count FROM perfis');
  if (existingCount.count === 0) {
    console.log('[ConfigDB] Populando dados iniciais...');

    await run(`INSERT INTO perfis (id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy) VALUES
      ('enfermagem', 'Enfermagem', 1, 'API_CONECTA_ASSISTENCIAL_ENF', 'acesso_enfermagem', 0, 'API_CONECTA_ASSISTENCIAL_ENF'),
      ('psicologia', 'Psicologia', 4, 'API_CONECTA_ASSISTENCIAL_PSI', 'acesso_psicologia', 1, 'API_CONECTA_ASSISTENCIAL_PSI'),
      ('tecnico_enfermagem', 'Técnico de Enfermagem', 1, 'API_CONECTA_ASSISTENCIAL_TEC_ENF', 'acesso_tecnico_enfermagem', 0, 'API_CONECTA_ASSISTENCIAL_TEC_ENF'),
      ('admin', 'Administrador', 1, 'API_CONECTA_ADMIN', 'acesso_admin', 0, 'API_CONECTA_ASSISTENCIAL'),
      ('psicologia_sup', 'Psicologia Supervisão', 4, 'API_CONECTA_ASSISTENCIAL_PSI_SUP', 'acesso_psicologia_sup', 1, 'API_CONECTA_ASSISTENCIAL_PSI')`);

    await run(`INSERT INTO modulos (id, nome, descricao, icon) VALUES
      ('passagem', 'Passagem de Plantão', 'Registro de intercorrências durante a passagem de plantão', 'bi-journal-medical'),
      ('dashboard', 'Dashboard de Pacientes', 'Visualização de pacientes internados com indicadores', 'bi-layout-text-window-reverse'),
      ('livro', 'Livro Administrativo', 'Registro de ocorrências administrativas do livro', 'bi-clipboard2-data'),
      ('dashboard_pa', 'Dashboard P.A.', 'Gestão de internações no Pronto Atendimento', 'bi-hospital'),
      ('escala', 'Escala', 'Consulta e organização das escalas assistenciais por data, turno e setor', 'bi-calendar-week')`);

    await run(`INSERT INTO perfil_modulos (perfil_id, modulo_id) VALUES
      ('enfermagem', 'passagem'),
      ('enfermagem', 'dashboard'),
      ('enfermagem', 'livro'),
      ('enfermagem', 'dashboard_pa'),
      ('enfermagem', 'escala'),
      ('psicologia', 'passagem'),
      ('psicologia', 'escala'),
      ('tecnico_enfermagem', 'dashboard'),
      ('admin', 'passagem'),
      ('admin', 'dashboard'),
      ('admin', 'livro'),
      ('admin', 'dashboard_pa'),
      ('admin', 'escala'),
      ('psicologia_sup', 'passagem'),
      ('psicologia_sup', 'dashboard'),
      ('psicologia_sup', 'livro'),
      ('psicologia_sup', 'escala')`);

    await run(`INSERT INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES
      ('enfermagem', 'escala', 'editar_publicar_escala'),
      ('psicologia', 'escala', 'editar_publicar_escala'),
      ('enfermagem', 'passagem', 'lancar_nova_passagem'),
      ('psicologia', 'passagem', 'lancar_nova_passagem'),
      ('admin', 'escala', 'editar_publicar_escala'),
      ('admin', 'passagem', 'lancar_nova_passagem'),
      ('psicologia_sup', 'escala', 'editar_publicar_escala'),
      ('psicologia_sup', 'passagem', 'lancar_nova_passagem')`);

    console.log('[ConfigDB] Dados iniciais inseridos com sucesso.');
  } else {
    console.log('[ConfigDB] Configurações já existem. Pulando seed.');
  }

  db.close();
  console.log('[ConfigDB] Banco de configurações pronto.');
}

init().catch(err => {
  console.error('[ConfigDB] Erro na inicialização:', err);
  process.exit(1);
});
