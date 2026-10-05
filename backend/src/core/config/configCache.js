const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { verbose } = sqlite3;
const sqlite3v = verbose();

const dbDir = path.resolve(__dirname, '../../../../auth.sqlite');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'config.db');

let db;

function getConnection() {
  if (!db) {
    db = new sqlite3v.Database(dbPath);
  }
  return db;
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getConnection().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getConnection().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

let relatoriosTasyDisponivel = false;
let cache = {
  perfis: [],
  modulos: [],
  perfilModulos: [],
  perfilPermissoes: [],
  perfilModuloSetores: [],
  dashboardPA: null,
  systemConfig: {}
};

function setCacheForTest(newCache) {
  cache = { ...cache, ...newCache };
}

async function ensureAccessSchema() {
  await run(`CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS config_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);
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

  await run(`INSERT OR IGNORE INTO perfil_modulo_setores (perfil_id, modulo_id, cd_setor_atendimento)
    SELECT perfil_id, modulo_id, CAST(permissao AS INTEGER)
    FROM perfil_permissoes
    WHERE modulo_id = 'passagem' AND permissao GLOB '[0-9]*'`);
  await run(`DELETE FROM perfil_permissoes
    WHERE modulo_id = 'passagem' AND permissao GLOB '[0-9]*'`);
  await run(`DELETE FROM perfil_permissoes
    WHERE modulo_id = 'passagem' AND LOWER(TRIM(permissao)) IN ('undefined', 'null', '')`);
  const migration = await all("SELECT id FROM config_migrations WHERE id = '2026_08_passagem_access'");
  if (migration.length === 0) {
    await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao)
      SELECT perfil_id, modulo_id, 'lancar_nova_passagem'
      FROM perfil_modulos
      WHERE modulo_id = 'passagem'`);
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_passagem_access')");
  }
  const migrationCheckboxes = await all("SELECT id FROM config_migrations WHERE id = '2026_08_passagem_checkboxes'");
  if (migrationCheckboxes.length === 0) {
    const campos = ['acompanhante', 'broncoaspiracao', 'contencao', 'heteroautoagressao', 'jejum', 'lesao', 'queda', 'tae', 'riscofuga'];
    for (const campo of campos) {
      await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao)
        SELECT perfil_id, modulo_id, 'campo_${campo}'
        FROM perfil_modulos
        WHERE modulo_id = 'passagem'`);
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_passagem_checkboxes')");
  }
  const migrationAuditorias = await all("SELECT id FROM config_migrations WHERE id = '2026_08_auditorias_nisa'");
  if (migrationAuditorias.length === 0) {
    await run(`INSERT OR IGNORE INTO modulos (id, nome, descricao, icon, setorId) VALUES ('auditorias', 'Auditorias', 'Auditorias assistenciais do Núcleo de Segurança do Paciente', 'bi-clipboard2-check', NULL)`);
    await run(`INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES ('admin', 'auditorias')`);
    for (const permissao of ['lancar_higiene_maos', 'visualizar_historico_higiene_maos', 'exportar_higiene_maos']) {
      await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES ('admin', 'auditorias', ?)`, [permissao]);
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_auditorias_nisa')");
  }

  // Migration: Permissões para Auditoria de Processos
  const migrationProcessos = await all("SELECT id FROM config_migrations WHERE id = '2026_08_auditorias_processos'");
  if (migrationProcessos.length === 0) {
    for (const permissao of ['lancar_auditoria_processos', 'visualizar_historico_auditoria_processos', 'exportar_auditoria_processos']) {
      await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES ('admin', 'auditorias', ?)`, [permissao]);
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_auditorias_processos')");
  }

  // Migration: Módulo de Registros Assistenciais (Demanda Espontânea, etc.)
  const migrationRegistros = await all("SELECT id FROM config_migrations WHERE id = '2026_08_registros_modulo'");
  if (migrationRegistros.length === 0) {
    await run(`INSERT OR IGNORE INTO modulos (id, nome, descricao, icon, setorId) VALUES ('registros', 'Registros', 'Registros assistenciais e acolhimento de demandas', 'bi-journal-bookmark', NULL)`);
    await run(`INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES ('admin', 'registros')`);
    for (const permissao of ['lancar_demanda_espontanea', 'cadastrar_pessoa_fisica', 'visualizar_historico_registros']) {
      await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES ('admin', 'registros', ?)`, [permissao]);
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_registros_modulo')");
  }

  // Migration: Permissões para Módulo Recepção & Acolhimento
  const migrationRecepcao = await all("SELECT id FROM config_migrations WHERE id = '2026_09_recepcao_permissoes'");
  if (migrationRecepcao.length === 0) {
    await run(`INSERT OR IGNORE INTO modulos (id, nome, descricao, icon, setorId) VALUES ('recepcao', 'Recepção e Acolhimento', 'Guichê de senhas, cadastro de pacientes, abertura de atendimentos e emissão de documentos', 'bi-person-badge', NULL)`);
    for (const perfil of ['admin', 'recepcao', 'enfermagem']) {
      await run(`INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES (?, 'recepcao')`, [perfil]);
      for (const permissao of ['chamar_senha', 'cadastrar_pessoa_fisica', 'abrir_atendimento', 'anexar_documento_ged', 'emitir_relatorio']) {
        await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, 'recepcao', ?)`, [perfil, permissao]);
      }
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_09_recepcao_permissoes')");
  }

  // Migration: Módulo Painel de Senhas & Flag de Chamada em Guichês
  const migrationPainelSenhas = await all("SELECT id FROM config_migrations WHERE id = '2026_09_painel_senhas_e_flag_guiche'");
  if (migrationPainelSenhas.length === 0) {
    await run(`INSERT OR IGNORE INTO modulos (id, nome, descricao, icon, setorId) VALUES ('painel_senhas', 'Painel de Senhas', 'Painel de chamada de senhas no guichê e transmissão para Conecta TV', 'bi-megaphone', NULL)`);
    for (const perfil of ['admin', 'enfermagem', 'recepcao']) {
      await run(`INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES (?, 'painel_senhas')`, [perfil]);
      await run(`INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, 'painel_senhas', 'chamar_senha')`, [perfil]);
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_09_painel_senhas_e_flag_guiche')");
  }

  await run(`CREATE TABLE IF NOT EXISTS studio_pages (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT DEFAULT 'custom',
    layout_json TEXT NOT NULL,
    html_output TEXT,
    custom_css TEXT,
    thumbnail TEXT,
    is_native INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  const studioCols = await all("PRAGMA table_info(studio_pages)");
  if (!studioCols.some(c => c.name === 'custom_css')) {
    try { await run("ALTER TABLE studio_pages ADD COLUMN custom_css TEXT DEFAULT ''"); } catch (e) {}
  }

  const migrationStudio = await all("SELECT id FROM config_migrations WHERE id = '2026_08_studio_pages'");
  if (migrationStudio.length === 0) {
    const nativePages = [
      {
        id: 'passagem',
        nome: 'Passagem de Plantão',
        descricao: 'Tela padrão de passagem de plantão de enfermagem por setor ou em lote com intercorrências e turno.',
        categoria: 'assistencial',
        is_native: 1,
        layout_json: JSON.stringify({
          version: '1.0',
          title: 'Passagem de Plantão',
          type: 'native',
          components: [
            { type: 'topbar', props: { title: 'Passagem de Plantão', subtitle: 'Enfermagem', showProfile: true, showDraft: true } },
            { type: 'layout_sidebar_main', props: { sidebarWidth: '260px' }, children: [
              { type: 'sidebar_setores', props: { title: 'Setores de Atendimento' } },
              { type: 'main_content', children: [
                { type: 'kpi_row', props: { items: [
                  { label: 'Total de Leitos', value: '28', icon: 'bi-hospital', color: 'primary' },
                  { label: 'Ocupados', value: '24', icon: 'bi-person-check', color: 'green' },
                  { label: 'Pendências', value: '3', icon: 'bi-exclamation-triangle', color: 'amber' }
                ]}},
                { type: 'card_paciente', props: { nome: 'Maria Santos Oliveira', leito: 'Leito 102-A', registro: '94821', diagnostico: 'Pós-operatório imediato', risco: 'Alto Risco de Queda' } },
                { type: 'card_paciente', props: { nome: 'João Carlos Pereira', leito: 'Leito 103-B', registro: '83920', diagnostico: 'Insuficiência Cardíaca Congestiva', risco: 'Broncoaspiração' } }
              ]}
            ]},
            { type: 'footer_passagem', props: { showTurno: true, showSave: true, saveText: 'Salvar / Finalizar Passagem' } }
          ]
        })
      },
      {
        id: 'dashboard_pa',
        nome: 'Dashboard Pronto Atendimento',
        descricao: 'Painel em tempo real de pacientes em espera, triagem, atendimento e tempo médio no P.A.',
        categoria: 'gestao',
        is_native: 1,
        layout_json: JSON.stringify({
          version: '1.0',
          title: 'Dashboard P.A.',
          type: 'native',
          components: [
            { type: 'topbar', props: { title: 'Dashboard P.A.', subtitle: 'Pronto Atendimento', showProfile: true } },
            { type: 'kpi_row', props: { items: [
              { label: 'Fila de Espera', value: '14', icon: 'bi-hourglass-split', color: 'primary' },
              { label: 'Em Atendimento', value: '6', icon: 'bi-heart-pulse', color: 'green' },
              { label: 'Tempo Médio', value: '18 min', icon: 'bi-clock-history', color: 'amber' }
            ]}},
            { type: 'panel_white', props: { title: 'Fila de Atendimento em Tempo Real' }, children: [
              { type: 'tabela_conecta', props: { headers: ['Senha/Paciente', 'Chegada', 'Classificação', 'Médico', 'Tempo Espera', 'Status'] } }
            ]}
          ]
        })
      },
      {
        id: 'pacientes',
        nome: 'Dashboard de Pacientes',
        descricao: 'Visão unificada do mapa de leitos com alertas clínicos, ocorrências e status dos setores.',
        categoria: 'assistencial',
        is_native: 1,
        layout_json: JSON.stringify({
          version: '1.0',
          title: 'Dashboard de Pacientes',
          type: 'native',
          components: [
            { type: 'topbar', props: { title: 'Dashboard Pacientes', subtitle: 'Internação', showProfile: true } },
            { type: 'grid_responsive', props: { columns: 3 }, children: [
              { type: 'card_paciente', props: { nome: 'Carlos Eduardo Lima', leito: 'Leito 201', registro: '55102', diagnostico: 'Pneumonia Bacteriana', risco: 'Isolamento de Contato' } },
              { type: 'card_paciente', props: { nome: 'Ana Beatriz Souza', leito: 'Leito 202', registro: '55109', diagnostico: 'Apendicectomia', risco: 'Estável' } },
              { type: 'card_paciente', props: { nome: 'Roberto Albuquerque', leito: 'Leito 203', registro: '55115', diagnostico: 'Cetoacidose Diabética', risco: 'Alerta Glicemia' } }
            ]}
          ]
        })
      },
      {
        id: 'auditorias',
        nome: 'Auditorias NISA',
        descricao: 'Formulário e histórico de auditorias de Higiene das Mãos e Segurança do Paciente.',
        categoria: 'qualidade',
        is_native: 1,
        layout_json: JSON.stringify({
          version: '1.0',
          title: 'Auditorias NISA',
          type: 'native',
          components: [
            { type: 'topbar', props: { title: 'Auditorias Assistenciais', subtitle: 'Núcleo de Segurança do Paciente', showProfile: true } },
            { type: 'panel_white', props: { title: 'Formulário de Auditoria - Higiene das Mãos' }, children: [
              { type: 'auditoria_oportunidades', props: { title: 'Oportunidades Observadas (Álcool / Sabonete / Perdida)' } }
            ]},
            { type: 'panel_white', props: { title: 'Histórico Recente de Auditorias' }, children: [
              { type: 'auditoria_historico_item', props: { data: '2026-08-20', setor: 'Setor de Internação', turno: 'Dia', avaliador: 'Alexandre Braga', profissional: 'Ana Caroline', adesao: '80%' } }
            ]}
          ]
        })
      },
      {
        id: 'livro',
        nome: 'Livro Administrativo',
        descricao: 'Registro e acompanhamento diário de ocorrências administrativas, manutenção e gestão.',
        categoria: 'administrativo',
        is_native: 1,
        layout_json: JSON.stringify({
          version: '1.0',
          title: 'Livro Administrativo',
          type: 'native',
          components: [
            { type: 'topbar', props: { title: 'Livro Administrativo', subtitle: 'Gestão Diária', showProfile: true } },
            { type: 'panel_white', props: { title: 'Novo Registro de Ocorrência' }, children: [
              { type: 'form_input', props: { label: 'Assunto / Título da Ocorrência', placeholder: 'Ex: Manutenção no Ar Condicionado...' } },
              { type: 'form_textarea', props: { label: 'Descrição Detalhada', placeholder: 'Descreva os fatos ocorridos...' } },
              { type: 'btn_primary', props: { text: 'Publicar Registro no Livro', icon: 'bi-send-fill' } }
            ]}
          ]
        })
      },
      {
        id: 'escala',
        nome: 'Escala Médica e Enfermagem',
        descricao: 'Quadro mensal de escalas por setor, turnos, folgas e substituições.',
        categoria: 'gestao',
        is_native: 1,
        layout_json: JSON.stringify({
          version: '1.0',
          title: 'Escala Médica e Enfermagem',
          type: 'native',
          components: [
            { type: 'topbar', props: { title: 'Escala Ativa', subtitle: 'Quadro de Plantões', showProfile: true } },
            { type: 'panel_white', props: { title: 'Grade Mensal de Profissionais' }, children: [
              { type: 'tabela_conecta', props: { headers: ['Profissional', 'Cargo / Função', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] } }
            ]}
          ]
        })
      }
    ];

    for (const p of nativePages) {
      await run(
        `INSERT OR REPLACE INTO studio_pages (id, nome, descricao, categoria, layout_json, is_native, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [p.id, p.nome, p.descricao, p.categoria, p.layout_json, p.is_native]
      );
    }

    await run("INSERT INTO config_migrations (id) VALUES ('2026_08_studio_pages')");
  }

  // Migration: Tabela passagem_checkboxes
  await run(`CREATE TABLE IF NOT EXISTS passagem_checkboxes (
    id TEXT PRIMARY KEY,
    chave TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    categoria TEXT DEFAULT 'Geral',
    icone TEXT DEFAULT 'bi-check-circle',
    ordem INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  const migrationCheckboxesTable = await all("SELECT id FROM config_migrations WHERE id = '2026_08_passagem_checkboxes_real_v2'");
  if (migrationCheckboxesTable.length === 0) {
    await run("DELETE FROM passagem_checkboxes");
    const defaultCheckboxes = [
      { id: 'acompanhante', chave: 'acompanhante', label: 'Acompanhante', categoria: 'Geral', icone: 'bi-person-check', ordem: 1 },
      { id: 'broncoaspiracao', chave: 'broncoaspiracao', label: 'Broncoaspiração', categoria: 'Risco Clínico', icone: 'bi-exclamation-circle', ordem: 2 },
      { id: 'contencao', chave: 'contencao', label: 'Contenção', categoria: 'Risco Clínico', icone: 'bi-lock', ordem: 3 },
      { id: 'heteroautoagressao', chave: 'heteroautoagressao', label: 'Heteroagressão/Autoagressão', categoria: 'Comportamento', icone: 'bi-shield-slash', ordem: 4 },
      { id: 'jejum', chave: 'jejum', label: 'Jejum', categoria: 'Nutrição', icone: 'bi-slash-circle', ordem: 5 },
      { id: 'lesao', chave: 'lesao', label: 'Lesão', categoria: 'Pele & Integridade', icone: 'bi-bandaid', ordem: 6 },
      { id: 'queda', chave: 'queda', label: 'Queda', categoria: 'Segurança', icone: 'bi-exclamation-triangle', ordem: 7 },
      { id: 'tae', chave: 'tae', label: 'TAE', categoria: 'Cuidados Especiais', icone: 'bi-clipboard-pulse', ordem: 8 },
      { id: 'riscofuga', chave: 'riscofuga', label: 'Risco de Fuga', categoria: 'Segurança', icone: 'bi-door-open', ordem: 9 }
    ];

    for (const item of defaultCheckboxes) {
      await run(`INSERT OR REPLACE INTO passagem_checkboxes (id, chave, label, categoria, icone, ordem, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [item.id, item.chave, item.label, item.categoria, item.icone, item.ordem]);
    }
    await run("INSERT OR IGNORE INTO config_migrations (id) VALUES ('2026_08_passagem_checkboxes_real_v2')");
  }

  const colsPerfis = await all("PRAGMA table_info(perfis)");
  if (colsPerfis && colsPerfis.length > 0 && !colsPerfis.some(c => c.name === 'config_recepcao_json')) {
    await run("ALTER TABLE perfis ADD COLUMN config_recepcao_json TEXT DEFAULT '{}'");
  }

  // Schema: Painéis de TV Conecta e Mapeamento de Guichês por Computador
  await run(`CREATE TABLE IF NOT EXISTS paineis_tv (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    filas_json TEXT DEFAULT '[]',
    som_ativo INTEGER DEFAULT 1,
    voz_ativa INTEGER DEFAULT 1,
    voz_velocidade REAL DEFAULT 1.0,
    maquinas_autorizadas TEXT DEFAULT '',
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  const colsPaineis = await all("PRAGMA table_info(paineis_tv)");
  if (colsPaineis && colsPaineis.length > 0 && !colsPaineis.some(c => c.name === 'maquinas_autorizadas')) {
    await run("ALTER TABLE paineis_tv ADD COLUMN maquinas_autorizadas TEXT DEFAULT ''");
  }

  await run(`CREATE TABLE IF NOT EXISTS maquinas_guiches (
    id TEXT PRIMARY KEY,
    nm_maquina TEXT NOT NULL,
    ds_guiche TEXT NOT NULL,
    painel_id TEXT,
    cd_setor INTEGER,
    nm_usuario_padrao TEXT,
    permite_chamar_senha INTEGER DEFAULT 1,
    ativo INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  const colsGuiches = await all("PRAGMA table_info(maquinas_guiches)");
  if (colsGuiches && colsGuiches.length > 0 && !colsGuiches.some(c => c.name === 'permite_chamar_senha')) {
    await run("ALTER TABLE maquinas_guiches ADD COLUMN permite_chamar_senha INTEGER DEFAULT 1");
  }

  const migrationPaineis = await all("SELECT id FROM config_migrations WHERE id = '2026_09_paineis_e_guiches'");
  if (migrationPaineis.length === 0) {
    await run(`INSERT OR IGNORE INTO paineis_tv (id, nome, descricao, filas_json, som_ativo, voz_ativa, ativo) 
      VALUES ('recepcao_principal', 'Recepção Principal', 'Painel de TV da Sala de Espera da Recepção / P.A.', '[9, 10, 11, 12]', 1, 1, 1)`);
    
    await run(`INSERT OR IGNORE INTO paineis_tv (id, nome, descricao, filas_json, som_ativo, voz_ativa, ativo) 
      VALUES ('triagem_pa', 'Triagem P.A.', 'Painel da Sala de Triagem e Classificação de Risco', '[9, 12]', 1, 1, 1)`);

    await run(`INSERT OR IGNORE INTO maquinas_guiches (id, nm_maquina, ds_guiche, painel_id, ativo)
      VALUES ('NOTE-CESARIO', 'NOTE-CESARIO', 'Guichê 01', 'recepcao_principal', 1)`);

    await run(`INSERT OR IGNORE INTO maquinas_guiches (id, nm_maquina, ds_guiche, painel_id, ativo)
      VALUES ('GUICHE-01', 'GUICHE-01', 'Guichê 01', 'recepcao_principal', 1)`);

    await run(`INSERT OR IGNORE INTO maquinas_guiches (id, nm_maquina, ds_guiche, painel_id, ativo)
      VALUES ('GUICHE-02', 'GUICHE-02', 'Guichê 02', 'recepcao_principal', 1)`);

    await run("INSERT INTO config_migrations (id) VALUES ('2026_09_paineis_e_guiches')");
  }

  // Schema: Catálogo Dinâmico de Relatórios do TASY (Recepção & Atendimento)
  await run(`CREATE TABLE IF NOT EXISTS relatorios_tasy (
    id TEXT PRIMARY KEY,
    cd_relatorio INTEGER NOT NULL,
    nr_sequencia INTEGER NOT NULL,
    ds_titulo TEXT NOT NULL,
    icone TEXT DEFAULT 'bi-file-earmark-text',
    badge TEXT DEFAULT 'Geral',
    ativo INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  const migrationRelatorios = await all("SELECT id FROM config_migrations WHERE id = '2026_09_relatorios_tasy_v1'");
  if (migrationRelatorios.length === 0) {
    const defaultRelatorios = [
      { id: 'rel_718', cd_relatorio: 718, nr_sequencia: 2750455, ds_titulo: '718 — CHECKLIST PRONTUÁRIO', icone: 'bi-check2-square', badge: 'Prontuário', ordem: 1 },
      { id: 'rel_651', cd_relatorio: 651, nr_sequencia: 2750348, ds_titulo: '651 — HEAL - Autorização do responsável para contatos com o paciente', icone: 'bi-person-check', badge: 'Consentimento', ordem: 2 },
      { id: 'rel_205', cd_relatorio: 205, nr_sequencia: 2750344, ds_titulo: '205 — HEAL - Comunicado de Alta - Involuntário - HTML5', icone: 'bi-file-earmark-medical', badge: 'Internação Involuntária', ordem: 3 },
      { id: 'rel_206', cd_relatorio: 206, nr_sequencia: 2750347, ds_titulo: '206 — HEAL - Comunicado de Alta Médica Voluntária - HTML5', icone: 'bi-file-earmark-text', badge: 'Internação Voluntária', ordem: 4 },
      { id: 'rel_643', cd_relatorio: 643, nr_sequencia: 2750843, ds_titulo: '643 — HEAL - Contrato de prestação de serviços hospitalar - HTML5', icone: 'bi-file-earmark-ruled', badge: 'Contrato Jurídico', ordem: 5 },
      { id: 'rel_717', cd_relatorio: 717, nr_sequencia: 2750452, ds_titulo: '717 — TERMO DE AUTORIZAÇÃO PARA REALIZAÇÃO DE EXAMES LABORATORIAIS', icone: 'bi-eyedropper', badge: 'Exames', ordem: 6 },
      { id: 'rel_70126', cd_relatorio: 70126, nr_sequencia: 2750211, ds_titulo: '70126 — V.4.0 - TISS - Guia de Resumo de Internação', icone: 'bi-file-earmark-spreadsheet', badge: 'TISS / Faturamento', ordem: 7 },
      { id: 'rel_70125', cd_relatorio: 70125, nr_sequencia: 2750685, ds_titulo: '70125 — V.4.0 - TISS - Guia SP/SADT', icone: 'bi-file-earmark-text', badge: 'TISS / Faturamento', ordem: 8 }
    ];
    for (const r of defaultRelatorios) {
      await run(
        `INSERT OR IGNORE INTO relatorios_tasy (id, cd_relatorio, nr_sequencia, ds_titulo, icone, badge, ativo, ordem)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [r.id, r.cd_relatorio, r.nr_sequencia, r.ds_titulo, r.icone, r.badge, r.ordem]
      );
    }
    await run("INSERT INTO config_migrations (id) VALUES ('2026_09_relatorios_tasy_v1')");
  }

  // Configurações Institucionais Padrão (Sem hardcode)
  const defaultSysConfigs = [
    { chave: 'nome_instituicao', valor: 'Hospital Espírita André Luiz' },
    { chave: 'tv_historico_limite', valor: '7' },
    { chave: 'cache_setores_preaquecidos', valor: '68,28,34,59,83' }
  ];
  for (const item of defaultSysConfigs) {
    await run(`INSERT OR IGNORE INTO configuracoes_sistema (chave, valor) VALUES (?, ?)`, [item.chave, item.valor]);
  }
}

async function load() {
  try {
    await ensureAccessSchema();
    let perfisRaw = await all('SELECT * FROM perfis WHERE ativo = 1');
    const perfis = perfisRaw.map(p => ({
      ...p,
      config_recepcao: p.config_recepcao_json ? JSON.parse(p.config_recepcao_json) : { filasPermitidas: [], modoVisualizacao: 'SENHA' }
    }));
    const modulos = await all('SELECT * FROM modulos');
    const perfilModulos = await all('SELECT * FROM perfil_modulos');
    const perfilPermissoes = await all('SELECT * FROM perfil_permissoes');
    const perfilModuloSetores = await all('SELECT * FROM perfil_modulo_setores');
    const dbRows = await all("SELECT * FROM configuracoes_dashboard_pa WHERE chave = 'dest'");
    const dashboardPA = dbRows.length > 0 ? dbRows[0] : null;

    const dbSys = await all('SELECT * FROM configuracoes_sistema');
    const systemConfig = {};
    for (const row of dbSys) {
      systemConfig[row.chave] = row.valor;
    }

    const paineis = await all('SELECT * FROM paineis_tv ORDER BY nome');
    const maquinasGuiches = await all('SELECT * FROM maquinas_guiches ORDER BY ds_guiche');
    const relatoriosTasy = await all('SELECT * FROM relatorios_tasy ORDER BY ordem, cd_relatorio');

    cache = {
      perfis,
      modulos,
      perfilModulos,
      perfilPermissoes,
      perfilModuloSetores,
      dashboardPA,
      systemConfig,
      paineis: paineis || [],
      maquinasGuiches: maquinasGuiches || [],
      relatoriosTasy: relatoriosTasy || []
    };
    relatoriosTasyDisponivel = true;
    return true;
  } catch (err) {
    relatoriosTasyDisponivel = false;
    console.error('[ConfigCache] Erro ao carregar cache:', err.message);
    return false;
  }
}

function getRelatoriosTasyState() {
  if (!relatoriosTasyDisponivel || cache.relatoriosTasy === undefined) return 'UNAVAILABLE';
  if (cache.relatoriosTasy.length === 0) return 'EMPTY';
  const ativos = cache.relatoriosTasy.filter(r => r.ativo === 1);
  if (ativos.length === 0) return 'ALL_DISABLED';
  return 'AVAILABLE';
}

function getRelatoriosTasy(apenasAtivos = false) {
  if (apenasAtivos) {
    return (cache.relatoriosTasy || []).filter(r => r.ativo === 1);
  }
  return cache.relatoriosTasy || [];
}

async function saveRelatorioTasy(dados) {
  const cd = parseInt(dados.cd_relatorio, 10);
  const nrSeq = parseInt(dados.nr_sequencia, 10);
  if (!cd || !nrSeq || !dados.ds_titulo) {
    throw new Error('Código do relatório, número de sequência e título são obrigatórios');
  }
  const id = dados.id || `rel_${cd}`;
  const icone = dados.icone || 'bi-file-earmark-text';
  const badge = dados.badge || 'Geral';
  const ativo = dados.ativo === 0 ? 0 : 1;
  const ordem = parseInt(dados.ordem, 10) || 0;

  await run(
    `INSERT INTO relatorios_tasy (id, cd_relatorio, nr_sequencia, ds_titulo, icone, badge, ativo, ordem, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       cd_relatorio = excluded.cd_relatorio,
       nr_sequencia = excluded.nr_sequencia,
       ds_titulo = excluded.ds_titulo,
       icone = excluded.icone,
       badge = excluded.badge,
       ativo = excluded.ativo,
       ordem = excluded.ordem,
       updated_at = datetime('now')`,
    [id, cd, nrSeq, dados.ds_titulo, icone, badge, ativo, ordem]
  );
  const cacheReloaded = await load();
  return { id, cd_relatorio: cd, nr_sequencia: nrSeq, ds_titulo: dados.ds_titulo, icone, badge, ativo, ordem, _cacheReloaded: cacheReloaded };
}

async function deleteRelatorioTasy(id) {
  if (!id) throw new Error('ID é obrigatório');
  await run('DELETE FROM relatorios_tasy WHERE id = ?', [id]);
  const cacheReloaded = await load();
  return { success: true, id, _cacheReloaded: cacheReloaded };
}

async function toggleRelatorioTasy(id, ativo) {
  if (!id) throw new Error('ID é obrigatório');
  const val = ativo ? 1 : 0;
  await run("UPDATE relatorios_tasy SET ativo = ?, updated_at = datetime('now') WHERE id = ?", [val, id]);
  const cacheReloaded = await load();
  return { success: true, id, ativo: val, _cacheReloaded: cacheReloaded };
}

function getPaineisTv() {
  return cache.paineis || [];
}

function getPainelTvById(id) {
  if (!id) return null;
  return (cache.paineis || []).find(p => p.id === id) || null;
}

async function savePainelTv(painel) {
  const { id, nome, descricao, filas_json, som_ativo = 1, voz_ativa = 1, voz_velocidade = 1.0, maquinas_autorizadas = '', ativo = 1 } = painel;
  if (!id || !nome) throw new Error('ID e Nome do painel são obrigatórios');
  
  const existing = await all('SELECT id FROM paineis_tv WHERE id = ?', [id]);
  if (existing.length > 0) {
    await run(`UPDATE paineis_tv 
      SET nome = ?, descricao = ?, filas_json = ?, som_ativo = ?, voz_ativa = ?, voz_velocidade = ?, maquinas_autorizadas = ?, ativo = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [nome, descricao || '', typeof filas_json === 'string' ? filas_json : JSON.stringify(filas_json || []), som_ativo ? 1 : 0, voz_ativa ? 1 : 0, Number(voz_velocidade) || 1.0, String(maquinas_autorizadas || '').trim(), ativo ? 1 : 0, id]
    );
  } else {
    await run(`INSERT INTO paineis_tv (id, nome, descricao, filas_json, som_ativo, voz_ativa, voz_velocidade, maquinas_autorizadas, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nome, descricao || '', typeof filas_json === 'string' ? filas_json : JSON.stringify(filas_json || []), som_ativo ? 1 : 0, voz_ativa ? 1 : 0, Number(voz_velocidade) || 1.0, String(maquinas_autorizadas || '').trim(), ativo ? 1 : 0]
    );
  }
  await load();
  return getPainelTvById(id);
}

function getPainelParaMaquina(nmMaquina, ip = '') {
  const termo = String(nmMaquina || '').trim().toUpperCase();
  const termoIp = String(ip || '').trim().toUpperCase();

  const paineis = cache.paineis || [];
  if (termo || termoIp) {
    for (const p of paineis) {
      if (!p.maquinas_autorizadas) continue;
      const lista = p.maquinas_autorizadas.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      if (termo && lista.includes(termo)) return p;
      if (termoIp && lista.includes(termoIp)) return p;
    }
  }

  // Fallback: se a máquina tiver guichê cadastrado vinculado a um painel
  const guicheMapping = getMaquinaGuiche(nmMaquina) || (ip ? getMaquinaGuiche(ip) : null);
  if (guicheMapping && guicheMapping.painel_id) {
    const painelGuiche = getPainelTvById(guicheMapping.painel_id);
    if (painelGuiche) return painelGuiche;
  }

  return null;
}

async function deletePainelTv(id) {
  await run('DELETE FROM paineis_tv WHERE id = ?', [id]);
  await load();
  return true;
}

function getMaquinasGuiches() {
  return cache.maquinasGuiches || [];
}

function getMaquinaGuiche(nmMaquina) {
  if (!nmMaquina) return null;
  const term = String(nmMaquina).trim().toUpperCase();
  return (cache.maquinasGuiches || []).find(m => 
    String(m.nm_maquina).trim().toUpperCase() === term || 
    String(m.id).trim().toUpperCase() === term
  ) || null;
}

async function saveMaquinaGuiche(guiche) {
  const { id, nm_maquina, ds_guiche, painel_id, cd_setor, nm_usuario_padrao, permite_chamar_senha = 1, ativo = 1 } = guiche;
  const key = id || nm_maquina;
  if (!key || !ds_guiche) throw new Error('Identificador da máquina e descrição do guichê são obrigatórios');

  const permChamar = (permite_chamar_senha === false || permite_chamar_senha === 0 || permite_chamar_senha === '0') ? 0 : 1;

  const existing = await all('SELECT id FROM maquinas_guiches WHERE id = ?', [key]);
  if (existing.length > 0) {
    await run(`UPDATE maquinas_guiches
      SET nm_maquina = ?, ds_guiche = ?, painel_id = ?, cd_setor = ?, nm_usuario_padrao = ?, permite_chamar_senha = ?, ativo = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [nm_maquina || key, ds_guiche, painel_id || 'recepcao_principal', cd_setor ? Number(cd_setor) : null, nm_usuario_padrao || null, permChamar, ativo ? 1 : 0, key]
    );
  } else {
    await run(`INSERT INTO maquinas_guiches (id, nm_maquina, ds_guiche, painel_id, cd_setor, nm_usuario_padrao, permite_chamar_senha, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [key, nm_maquina || key, ds_guiche, painel_id || 'recepcao_principal', cd_setor ? Number(cd_setor) : null, nm_usuario_padrao || null, permChamar, ativo ? 1 : 0]
    );
  }
  await load();
  return getMaquinaGuiche(key);
}

async function deleteMaquinaGuiche(id) {
  await run('DELETE FROM maquinas_guiches WHERE id = ?', [id]);
  await load();
  return true;
}

function getCachedPerfis() {
  return cache.perfis;
}

function getCachedModulos() {
  return cache.modulos;
}

function getCachedPerfilModulos() {
  return cache.perfilModulos;
}

function getCachedPerfilPermissoes() {
  return cache.perfilPermissoes;
}

function getCachedPerfilModuloSetores() {
  return cache.perfilModuloSetores;
}

function perfilTemPermissao(perfilId, moduloId, permissao) {
  if (!perfilId || !moduloId || !permissao) return false;
  const pId = String(perfilId).trim().toLowerCase();
  const mId = String(moduloId).trim().toLowerCase();
  const perm = String(permissao).trim().toLowerCase();
  return cache.perfilPermissoes.some(pp => 
    String(pp.perfil_id).trim().toLowerCase() === pId && 
    String(pp.modulo_id).trim().toLowerCase() === mId && 
    String(pp.permissao).trim().toLowerCase() === perm
  );
}

function getSetoresPermitidos(perfilId, moduloId = 'passagem') {
  if (!perfilId) return [];
  const pId = String(perfilId).trim().toLowerCase();
  const mId = String(moduloId).trim().toLowerCase();
  return cache.perfilModuloSetores
    .filter(item => String(item.perfil_id).trim().toLowerCase() === pId && String(item.modulo_id).trim().toLowerCase() === mId)
    .map(item => Number(item.cd_setor_atendimento))
    .filter(Number.isInteger);
}


function perfilPodeVisualizarSetor(perfilId, cdSetor, moduloId = 'passagem') {
  const permitidos = getSetoresPermitidos(perfilId, moduloId);
  if (permitidos.length > 0) {
    return permitidos.includes(Number(cdSetor));
  }
  return perfilTemAcessoModulo(perfilId, moduloId);
}

function getPerfilById(id) {
  return cache.perfis.find(p => p.id === id) || null;
}

function getPerfilIdTasy(id) {
  const p = getPerfilById(id);
  return p ? (p.dsPerfilTasy || p.grupoLdap) : null;
}

function getModuloById(id) {
  return cache.modulos.find(m => m.id === id) || null;
}

function getModulosByPerfil(perfilId) {
  const modIds = cache.perfilModulos
    .filter(pm => pm.perfil_id === perfilId)
    .map(pm => pm.modulo_id);
  return cache.modulos.filter(m => modIds.includes(m.id));
}

function getModuloIdsByPerfil(perfilId) {
  return cache.perfilModulos
    .filter(pm => pm.perfil_id === perfilId)
    .map(pm => pm.modulo_id);
}

function perfilTemAcessoModulo(perfilId, moduloId) {
  if (!perfilId || !moduloId) return false;
  return cache.perfilModulos.some(pm => pm.perfil_id === perfilId && pm.modulo_id === moduloId);
}

function getPerfisDisponiveis(gruposAd = []) {
  const grupos = new Set(
    (gruposAd || [])
      .filter(g => typeof g === 'string')
      .map(g => g.trim().toUpperCase())
  );
  return cache.perfis
    .filter(p => grupos.has(p.grupoLdap.toUpperCase()))
    .map(p => {
      const permissoesObj = {};
      cache.perfilPermissoes.filter(pp => pp.perfil_id === p.id).forEach(pp => {
        if (!permissoesObj[pp.modulo_id]) permissoesObj[pp.modulo_id] = [];
        permissoesObj[pp.modulo_id].push(pp.permissao);
      });
      return {
        id: p.id,
        nome: p.nome,
        sessionFlag: p.sessionFlag,
        setorId: p.setorId,
        setorReferenciaFixo: Boolean(p.setorReferenciaFixo),
        dsPerfilTasy: p.dsPerfilTasy || p.grupoLdap,
        permissoes: permissoesObj
      };
    });
}

function getSessionFlags(perfis = {}) {
  const flags = {};
  cache.perfis.forEach(p => {
    flags[p.sessionFlag] = Boolean(perfis[p.id]);
  });
  return flags;
}

function getSetoresByPerfis(perfis = {}) {
  return cache.perfis
    .filter(p => perfis[p.id])
    .map(p => ({
      cd_setor_atendimento: p.setorId,
      ds_setor_atendimento: p.nome
    }));
}

function getSetorReferenciaFixo(setoresSelecionados = []) {
  const setores = new Set((setoresSelecionados || []).map(Number).filter(Number.isInteger));
  const perfil = cache.perfis.find(p => p.setorReferenciaFixo && setores.has(p.setorId));
  return perfil ? perfil.setorId : null;
}

function getEspecialidadeBySetor(cdSetor) {
  return cache.perfis.find(p => p.setorId === Number(cdSetor)) || null;
}

function getCdPerfilBySetor(cdSetor, cdPerfisMap) {
  if (!cdPerfisMap || typeof cdPerfisMap !== 'object') return null;
  const matching = cache.perfis.filter(p => p.setorId === Number(cdSetor));
  for (const perfil of matching) {
    if (cdPerfisMap[perfil.id]) return cdPerfisMap[perfil.id];
  }
  return null;
}

function getCdPerfilByModulo(cdModulo, cdPerfisMap) {
  if (!cdPerfisMap || typeof cdPerfisMap !== 'object') return null;
  const matching = cache.perfis.filter(p => p.setorId === Number(cdModulo));
  for (const perfil of matching) {
    if (cdPerfisMap[perfil.id]) return cdPerfisMap[perfil.id];
  }
  return null;
}

function buildCdPerfisMap(perfisPorEspecialidade) {
  const map = {};
  for (const [id, cdPerfil] of Object.entries(perfisPorEspecialidade)) {
    if (cdPerfil) map[id] = cdPerfil;
  }
  return map;
}

async function saveProfile(data) {
  const { id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy } = data;
  if (!id || !nome || !grupoLdap) throw new Error('id, nome e grupoLdap são obrigatórios');

  const existing = await all('SELECT id FROM perfis WHERE id = ?', [id]);

  if (existing.length > 0) {
    await run(`UPDATE perfis SET nome=?, setorId=?, grupoLdap=?, sessionFlag=?, setorReferenciaFixo=?, dsPerfilTasy=?, updated_at=datetime('now') WHERE id=?`,
      [nome, setorId, grupoLdap, sessionFlag || `acesso_${id}`, setorReferenciaFixo ? 1 : 0, dsPerfilTasy || grupoLdap, id]);
  } else {
    await run(`INSERT INTO perfis (id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy) VALUES (?,?,?,?,?,?,?)`,
      [id, nome, setorId || 0, grupoLdap, sessionFlag || `acesso_${id}`, setorReferenciaFixo ? 1 : 0, dsPerfilTasy || grupoLdap]);
  }

  await load();
  return getPerfilById(id);
}

async function deleteProfile(id) {
  await run('DELETE FROM perfil_modulo_setores WHERE perfil_id = ?', [id]);
  const deleted = await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [id]);
  await run('DELETE FROM perfis WHERE id = ?', [id]);
  await load();
  return deleted.changes > 0;
}

async function setProfileModules(perfilId, moduloIds = []) {
  await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [perfilId]);
  await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
  for (const modId of moduloIds) {
    await run('INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES (?, ?)', [perfilId, modId]);
  }
  await load();
}

async function setProfilePermissions(perfilId, permissions = {}) {
  await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
  for (const [moduloId, permissoes] of Object.entries(permissions)) {
    for (const permissao of permissoes || []) {
      await run('INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, ?, ?)', [perfilId, moduloId, permissao]);
    }
  }
  await load();
}

async function setProfileAccess(perfilId, moduloIds = [], permissions = {}, setoresPorModulo = {}, configRecepcao = null) {
  await run('BEGIN IMMEDIATE TRANSACTION');
  try {
    if (configRecepcao) {
      await run('UPDATE perfis SET config_recepcao_json = ? WHERE id = ?', [JSON.stringify(configRecepcao), perfilId]);
    }
    
    await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [perfilId]);
    await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
    await run('DELETE FROM perfil_modulo_setores WHERE perfil_id = ?', [perfilId]);

    for (const moduloId of moduloIds) {
      await run('INSERT OR IGNORE INTO perfil_modulos (perfil_id, modulo_id) VALUES (?, ?)', [perfilId, moduloId]);
    }
    for (const [moduloId, permissoes] of Object.entries(permissions || {})) {
      if (!moduloIds.includes(moduloId)) continue;
      for (const permissao of permissoes || []) {
        await run(
          'INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, ?, ?)',
          [perfilId, moduloId, String(permissao)]
        );
      }
    }
    for (const [moduloId, setores] of Object.entries(setoresPorModulo || {})) {
      if (!moduloIds.includes(moduloId)) continue;
      for (const setor of setores || []) {
        const cdSetor = Number(setor);
        if (!Number.isInteger(cdSetor)) continue;
        await run(
          'INSERT OR IGNORE INTO perfil_modulo_setores (perfil_id, modulo_id, cd_setor_atendimento) VALUES (?, ?, ?)',
          [perfilId, moduloId, cdSetor]
        );
      }
    }
    await run('COMMIT');
  } catch (err) {
    try { await run('ROLLBACK'); } catch (_) {}
    throw err;
  }
  await load();
}

async function saveModule(data) {
  const { id, nome, descricao, icon, setorId } = data;
  if (!id || !nome) throw new Error('id e nome são obrigatórios para módulo');

  const existing = await all('SELECT id FROM modulos WHERE id = ?', [id]);
  if (existing.length > 0) {
    await run('UPDATE modulos SET nome=?, descricao=?, icon=?, setorId=? WHERE id=?',
      [nome, descricao || '', icon || 'bi-gear', setorId || null, id]);
  } else {
    await run('INSERT INTO modulos (id, nome, descricao, icon, setorId) VALUES (?,?,?,?,?)',
      [id, nome, descricao || '', icon || 'bi-gear', setorId || null]);
  }

  await load();
  return getModuloById(id);
}

async function deleteModule(id) {
  await run('DELETE FROM perfil_modulo_setores WHERE modulo_id = ?', [id]);
  await run('DELETE FROM perfil_modulos WHERE modulo_id = ?', [id]);
  const deleted = await run('DELETE FROM modulos WHERE id = ?', [id]);
  await load();
  return deleted.changes > 0;
}

function getAllPerfisWithModulos() {
  return cache.perfis.map(p => {
    const moduloIds = cache.perfilModulos
      .filter(pm => pm.perfil_id === p.id)
      .map(pm => pm.modulo_id);
    return {
      ...p,
      setorReferenciaFixo: Boolean(p.setorReferenciaFixo),
      modulos: moduloIds
    };
  });
}

function getAllModulosWithPermissoes() {
  return cache.modulos.map(m => {
    const perfisComAcesso = cache.perfilModulos
      .filter(pm => pm.modulo_id === m.id)
      .map(pm => pm.perfil_id);
    return {
      ...m,
      perfisPermitidos: perfisComAcesso
    };
  });
}

async function getPerfisFromGroups(gruposAd = []) {
  const grupos = new Set(
    (gruposAd || [])
      .filter(g => typeof g === 'string')
      .map(g => g.trim().toUpperCase())
  );
  const result = {};
  cache.perfis.forEach(p => {
    result[p.id] = grupos.has(p.grupoLdap.toUpperCase());
  });
  return result;
}

function getCacheMetadata() {
  return {
    perfisCount: cache.perfis.length,
    modulosCount: cache.modulos.length,
    permissoesCount: cache.perfilModulos.length,
    perfilModulos: cache.perfilModulos,
    perfilPermissoes: cache.perfilPermissoes,
    perfilModuloSetores: cache.perfilModuloSetores,
    perfis: cache.perfis
  };
}

function getSystemConfig() {
  return cache.systemConfig || {};
}

async function saveSystemConfig(configs) {
  for (const [key, val] of Object.entries(configs)) {
    const existing = await all('SELECT 1 FROM configuracoes_sistema WHERE chave = ?', [key]);
    if (existing.length > 0) {
      await run("UPDATE configuracoes_sistema SET valor = ?, updated_at = datetime('now') WHERE chave = ?", [String(val), key]);
    } else {
      await run("INSERT INTO configuracoes_sistema (chave, valor) VALUES (?, ?)", [key, String(val)]);
    }
  }
  await load();
  return getSystemConfig();
}

function getDashboardPAConfig() {
  return cache.dashboardPA;
}

async function saveDashboardPAConfig(nr_sequencia_fila, ds_fila) {
  try {
    const existing = await all("SELECT 1 FROM configuracoes_dashboard_pa WHERE chave = 'dest'");
    if (existing.length > 0) {
      await run(
        "UPDATE configuracoes_dashboard_pa SET nr_sequencia_fila = ?, ds_fila = ?, updated_at = datetime('now') WHERE chave = 'dest'",
        [nr_sequencia_fila, ds_fila]
      );
    } else {
      await run(
        "INSERT INTO configuracoes_dashboard_pa (chave, nr_sequencia_fila, ds_fila) VALUES ('dest', ?, ?)",
        [nr_sequencia_fila, ds_fila]
      );
    }
    await load();
    return cache.dashboardPA;
  } catch (err) {
    console.error('[ConfigCache] Erro ao salvar config dashboard P.A:', err.message);
    throw err;
  }
}

async function getStudioPages() {
  return all('SELECT * FROM studio_pages ORDER BY is_native DESC, updated_at DESC');
}

async function getStudioPageById(id) {
  const rows = await all('SELECT * FROM studio_pages WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

async function saveStudioPage({ id, nome, descricao = '', categoria = 'custom', layout_json, html_output = '', custom_css = '', thumbnail = '', is_native = 0 }) {
  if (!id || !nome || !layout_json) {
    throw new Error('id, nome e layout_json são obrigatórios para salvar página no Studio');
  }

  const existing = await getStudioPageById(id);
  if (existing) {
    await run(
      `UPDATE studio_pages 
       SET nome = ?, descricao = ?, categoria = ?, layout_json = ?, html_output = ?, custom_css = ?, thumbnail = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [nome, descricao, categoria, typeof layout_json === 'string' ? layout_json : JSON.stringify(layout_json), html_output, custom_css, thumbnail, id]
    );
  } else {
    await run(
      `INSERT INTO studio_pages (id, nome, descricao, categoria, layout_json, html_output, custom_css, thumbnail, is_native, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, nome, descricao, categoria, typeof layout_json === 'string' ? layout_json : JSON.stringify(layout_json), html_output, custom_css, thumbnail, is_native ? 1 : 0]
    );
  }
  return getStudioPageById(id);
}

async function deleteStudioPage(id) {
  const page = await getStudioPageById(id);
  if (!page) {
    throw new Error('Página não encontrada');
  }
  if (page.is_native === 1) {
    throw new Error('Telas nativas do sistema não podem ser excluídas');
  }
  await run('DELETE FROM studio_pages WHERE id = ?', [id]);
  return { success: true, id };
}

async function getPassagemCheckboxes() {
  return await all('SELECT * FROM passagem_checkboxes ORDER BY ordem ASC, label ASC');
}

async function getActivePassagemCheckboxes() {
  return await all('SELECT * FROM passagem_checkboxes WHERE ativo = 1 ORDER BY ordem ASC, label ASC');
}

async function savePassagemCheckbox({ id, chave, label, categoria, icone, ordem, ativo = 1 }) {
  if (!chave || !label) {
    throw new Error('Chave e rótulo são obrigatórios');
  }
  const cleanChave = String(chave).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const targetId = id || cleanChave;
  const existing = await all('SELECT id FROM passagem_checkboxes WHERE id = ? OR chave = ?', [targetId, cleanChave]);

  if (existing.length > 0) {
    await run(`UPDATE passagem_checkboxes 
      SET chave = ?, label = ?, categoria = ?, icone = ?, ordem = ?, ativo = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [cleanChave, label.trim(), (categoria || 'Geral').trim(), (icone || 'bi-check-circle').trim(), parseInt(ordem || 0, 10), ativo ? 1 : 0, existing[0].id]);
    await load();
    return { id: existing[0].id, chave: cleanChave, label, categoria, icone, ordem, ativo };
  } else {
    await run(`INSERT INTO passagem_checkboxes (id, chave, label, categoria, icone, ordem, ativo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [targetId, cleanChave, label.trim(), (categoria || 'Geral').trim(), (icone || 'bi-check-circle').trim(), parseInt(ordem || 0, 10), ativo ? 1 : 0]);

    // Concede permissão campo_<chave> automaticamente para os perfis com acesso ao módulo passagem
    const passagemProfiles = await all("SELECT perfil_id FROM perfil_modulos WHERE modulo_id = 'passagem'");
    for (const p of passagemProfiles) {
      await run("INSERT OR IGNORE INTO perfil_permissoes (perfil_id, modulo_id, permissao) VALUES (?, 'passagem', ?)", [p.perfil_id, `campo_${cleanChave}`]);
    }
    await load();
    return { id: targetId, chave: cleanChave, label, categoria, icone, ordem, ativo };
  }
}

async function deletePassagemCheckbox(id) {
  if (!id) throw new Error('ID é obrigatório');
  const existing = await all('SELECT chave FROM passagem_checkboxes WHERE id = ?', [id]);
  const chave = existing.length > 0 ? existing[0].chave : id;
  await run('DELETE FROM passagem_checkboxes WHERE id = ?', [id]);
  await run("DELETE FROM perfil_permissoes WHERE modulo_id = 'passagem' AND permissao = ?", [`campo_${chave}`]);
  await load();
  return { success: true, id };
}

async function togglePassagemCheckbox(id, ativo) {
  if (!id) throw new Error('ID é obrigatório');
  const val = ativo ? 1 : 0;
  await run("UPDATE passagem_checkboxes SET ativo = ?, updated_at = datetime('now') WHERE id = ?", [val, id]);
  await load();
  return { success: true, id, ativo: val };
}

module.exports = {
  setCacheForTest,
  load,
  loadConfig: load,
  getSystemConfig,
  saveSystemConfig,
  getCachedPerfis,
  getCachedModulos,
  getCachedPerfilModulos,
  getPerfilById,
  getPerfilIdTasy,
  getModuloById,
  getModulosByPerfil,
  getModuloIdsByPerfil,
  perfilTemAcessoModulo,
  getPerfisDisponiveis,
  getSessionFlags,
  getSetoresByPerfis,
  getSetorReferenciaFixo,
  getEspecialidadeBySetor,
  getCdPerfilBySetor,
  getCdPerfilByModulo,
  buildCdPerfisMap,
  getPerfisFromGroups,
  saveProfile,
  deleteProfile,
  setProfileModules,
  setProfilePermissions,
  setProfileAccess,
  saveModule,
  deleteModule,
  getAllPerfisWithModulos,
  getAllModulosWithPermissoes,
  getCacheMetadata,
  getDashboardPAConfig,
  saveDashboardPAConfig,
  perfilTemPermissao,
  getCachedPerfilPermissoes,
  getCachedPerfilModuloSetores,
  getSetoresPermitidos,
  perfilPodeVisualizarSetor,
  getStudioPages,
  getStudioPageById,
  saveStudioPage,
  deleteStudioPage,
  getPassagemCheckboxes,
  getActivePassagemCheckboxes,
  savePassagemCheckbox,
  deletePassagemCheckbox,
  togglePassagemCheckbox,
  getPaineisTv,
  getPainelTvById,
  getPainelParaMaquina,
  savePainelTv,
  deletePainelTv,
  getMaquinasGuiches,
  getMaquinaGuiche,
  saveMaquinaGuiche,
  deleteMaquinaGuiche,
  getRelatoriosTasyState,
  getRelatoriosTasy,
  saveRelatorioTasy,
  deleteRelatorioTasy,
  toggleRelatorioTasy
};
