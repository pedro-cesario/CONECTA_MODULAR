const configCache = require('../../core/config/configCache');
const ldapService = require('../auth/ldapService');
const perfilRepository = require('../auth/perfilRepository');
const setorService = require('../setores/setorService');

async function listarPerfis(req, res) {
  try {
    const perfis = configCache.getAllPerfisWithModulos();
    res.json({ success: true, data: perfis });
  } catch (err) {
    console.error('[Admin] Erro ao listar perfis:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarPerfil(req, res) {
  try {
    const { id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy } = req.body;

    if (!id || !nome || !grupoLdap) {
      return res.status(400).json({ success: false, message: 'id, nome e grupoLdap são obrigatórios' });
    }

    const perfil = await configCache.saveProfile({
      id,
      nome,
      setorId: setorId || 0,
      grupoLdap,
      sessionFlag: sessionFlag || `acesso_${id}`,
      setorReferenciaFixo: Boolean(setorReferenciaFixo),
      dsPerfilTasy: dsPerfilTasy || grupoLdap
    });

    res.json({ success: true, data: perfil });
  } catch (err) {
    console.error('[Admin] Erro ao salvar perfil:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarPerfil(req, res) {
  try {
    const { id } = req.params;
    const deleted = await configCache.deleteProfile(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
    }

    res.json({ success: true, message: 'Perfil removido com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao deletar perfil:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarModulos(req, res) {
  try {
    const modulos = configCache.getAllModulosWithPermissoes();
    res.json({ success: true, data: modulos });
  } catch (err) {
    console.error('[Admin] Erro ao listar módulos:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarModulo(req, res) {
  try {
    const { id, nome, descricao, icon, setorId } = req.body;

    if (!id || !nome) {
      return res.status(400).json({ success: false, message: 'id e nome são obrigatórios' });
    }

    const modulo = await configCache.saveModule({ id, nome, descricao, icon, setorId });
    res.json({ success: true, data: modulo });
  } catch (err) {
    console.error('[Admin] Erro ao salvar módulo:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarModulo(req, res) {
  try {
    const { id } = req.params;
    const deleted = await configCache.deleteModule(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Módulo não encontrado' });
    }

    res.json({ success: true, message: 'Módulo removido com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao deletar módulo:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarPermissoesModulo(req, res) {
  try {
    const { perfilId, modulos, permissoes, setoresPorModulo = {} } = req.body;

    if (!perfilId || !Array.isArray(modulos)) {
      return res.status(400).json({ success: false, message: 'perfilId e modulos (array) são obrigatórios' });
    }

    const perfil = configCache.getPerfilById(perfilId);
    if (!perfil) {
      return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
    }

    if (modulos.includes('passagem')) {
      const setoresPassagem = (setoresPorModulo.passagem || []).map(Number).filter(Number.isInteger);
      if (setoresPassagem.length === 0) {
        return res.status(400).json({ success: false, message: 'Selecione ao menos um setor para a Passagem de Plantão' });
      }
    }

    await configCache.setProfileAccess(perfilId, modulos, permissoes || {}, setoresPorModulo);
    res.json({ success: true, message: 'Permissões atualizadas com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao salvar permissões:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarSetoresPassagem(req, res) {
  try {
    const setores = await setorService.listarSetoresInternacao();
    const seen = new Set();
    const uniqueSetores = [];
    for (const setor of setores) {
      const id = Number(setor.cd_setor_atendimento);
      if (!Number.isInteger(id) || seen.has(id)) continue;
      seen.add(id);
      uniqueSetores.push({
        id: id,
        nome: setor.ds_setor_atendimento
      });
    }
    return res.json({
      success: true,
      data: uniqueSetores
    });
  } catch (err) {
    console.error('[Admin] Erro ao listar setores da passagem:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar setores da passagem' });
  }
}

async function obterCacheStatus(req, res) {
  const metadata = configCache.getCacheMetadata();
  res.json({ success: true, data: metadata });
}

async function recarregarCache(req, res) {
  try {
    await configCache.load();
    const metadata = configCache.getCacheMetadata();
    res.json({ success: true, data: metadata, message: 'Cache recarregado com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao recarregar cache:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarGruposLdap(req, res) {
  try {
    const grupos = await ldapService.getAllGroups();
    res.json({ success: true, data: grupos });
  } catch (err) {
    console.error('[Admin] Erro ao listar grupos LDAP:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarPerfisTasy(req, res) {
  try {
    const perfis = await perfilRepository.findAllTasyProfiles();
    res.json({ success: true, data: perfis });
  } catch (err) {
    console.error('[Admin] Erro ao listar perfis TASY:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarFilasEsperaTasy(req, res) {
  try {
    const db = require('../../core/database');
    const conn = await db.getConnection();
    try {
      const result = await conn.execute(
        `SELECT nr_sequencia, ds_fila FROM FILA_ESPERA_SENHA ORDER BY ds_fila`,
        [],
        { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
      );
      res.json({ success: true, data: result.rows });
    } finally {
      if (conn) await conn.close();
    }
  } catch (err) {
    console.error('[Admin] Erro ao listar filas de espera TASY:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar filas do TASY.' });
  }
}

async function obterConfigDashboardPA(req, res) {
  try {
    const config = configCache.getDashboardPAConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('[Admin] Erro ao obter config PA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarConfigDashboardPA(req, res) {
  try {
    const { nr_sequencia_fila, ds_fila } = req.body;
    if (!nr_sequencia_fila) {
      return res.status(400).json({ success: false, message: 'Fila é obrigatória.' });
    }
    const result = await configCache.saveDashboardPAConfig(nr_sequencia_fila, ds_fila || '');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao salvar config PA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function obterConfigSistema(req, res) {
  try {
    const config = configCache.getSystemConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('[Admin] Erro ao obter config sistema:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarConfigSistema(req, res) {
  try {
    const configs = req.body || {};
    const result = await configCache.saveSystemConfig(configs);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao salvar config sistema:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}


async function listarAgendasEct(req, res) {
  try {
    const pacienteRepository = require('../pacientes/pacienteRepository');
    const filas = await pacienteRepository.obterAgendasAtivas();
    res.json({ success: true, data: filas });
  } catch (err) {
    console.error('[Admin] Erro ao listar agendas ECT:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar agendas do TASY.' });
  }
}

async function listarProcedimentosEct(req, res) {
  try {
    const pacienteRepository = require('../pacientes/pacienteRepository');
    const procs = await pacienteRepository.obterProcedimentosAtivos();
    res.json({ success: true, data: procs });
  } catch (err) {
    console.error('[Admin] Erro ao listar procedimentos ECT:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar procedimentos do TASY.' });
  }
}


async function listarSessoes(req, res) {
  try {
    const redisClient = require('../../core/config/redisClient');
    if (!redisClient.isReady) {
      return res.json({ success: true, data: [] });
    }

    const keys = [];
    let cursor = '0';
    do {
      const scanRes = await redisClient.scan(cursor, { MATCH: 'sess:*', COUNT: 100 });
      cursor = typeof scanRes === 'string' ? scanRes : (scanRes.cursor || '0');
      const foundKeys = Array.isArray(scanRes) ? scanRes : (scanRes.keys || []);
      keys.push(...foundKeys);
      if (keys.length >= 500) break;
    } while (cursor !== '0' && cursor !== 0);

    if (!keys || keys.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const sessionDatas = await redisClient.mGet(keys);
    const sessions = [];
    for (let i = 0; i < keys.length; i++) {
      const data = sessionDatas[i];
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.usuario) {
            sessions.push({
              id: keys[i].replace('sess:', ''),
              nm_usuario: parsed.usuario.nm_usuario,
              nome: parsed.usuario.nome,
              perfis: parsed.usuario.perfisDisponiveis ? parsed.usuario.perfisDisponiveis.map(p => p.nome).join(', ') : '',
              perfilAtivo: parsed.usuario.perfilAtivo,
              authenticated_at: parsed.auth?.authenticated_at || null,
              auth_source: parsed.auth?.source || parsed.usuario.auth_source || 'unknown',
              is_ldap: parsed.usuario.is_ldap,
              ip: parsed.usuario.ip || parsed.auth?.client?.ip || parsed.clientIp || '-'
            });
          }
        } catch (err) { }
      }
    }
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[Admin] Erro ao listar sessões:', error);
    res.status(500).json({ success: false, message: 'Erro ao listar sessões', error: error.message });
  }
}

async function encerrarSessao(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID da sessão é obrigatório.' });
    }
    const redisClient = require('../../core/config/redisClient');
    if (redisClient.isReady) {
      await redisClient.del(`sess:${id}`);
    }
    res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  } catch (error) {
    console.error('[Admin] Erro ao encerrar sessão:', error);
    res.status(500).json({ success: false, message: 'Erro ao encerrar sessão' });
  }
}

async function listarAuditTrail(req, res) {
  try {
    const { queryAuditLogs } = require('../../core/database/auditDatabase');
    const { usuario, action, startDate, endDate, limit, offset } = req.query;
    const logs = await queryAuditLogs({
      usuario,
      action,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[Admin] Erro ao consultar audit trail:', err);
    res.status(500).json({ success: false, message: 'Erro ao consultar trilha de auditoria: ' + err.message });
  }
}

async function listarStudioPages(req, res) {
  try {
    const pages = await configCache.getStudioPages();
    res.json({ success: true, data: pages });
  } catch (err) {
    console.error('[Admin] Erro ao listar páginas do Studio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function obterStudioPage(req, res) {
  try {
    const { id } = req.params;
    const page = await configCache.getStudioPageById(id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Página não encontrada' });
    }
    res.json({ success: true, data: page });
  } catch (err) {
    console.error('[Admin] Erro ao obter página do Studio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarStudioPage(req, res) {
  try {
    const { id, nome, descricao, categoria, layout_json, html_output, custom_css, thumbnail, is_native } = req.body;
    if (!id || !nome || !layout_json) {
      return res.status(400).json({ success: false, message: 'id, nome e layout_json são obrigatórios' });
    }
    const page = await configCache.saveStudioPage({
      id,
      nome,
      descricao,
      categoria,
      layout_json,
      html_output,
      custom_css,
      thumbnail,
      is_native
    });
    res.json({ success: true, data: page });
  } catch (err) {
    console.error('[Admin] Erro ao salvar página no Studio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarStudioPage(req, res) {
  try {
    const { id } = req.params;
    const result = await configCache.deleteStudioPage(id);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao deletar página do Studio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarPassagemCheckboxes(req, res) {
  try {
    const items = await configCache.getPassagemCheckboxes();
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[Admin] Erro ao listar checkboxes:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarCheckboxesAtivos(req, res) {
  try {
    const items = await configCache.getActivePassagemCheckboxes();
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[Admin] Erro ao listar checkboxes ativos:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarPassagemCheckbox(req, res) {
  try {
    const { id, chave, label, categoria, icone, ordem, ativo } = req.body;
    if (!chave || !label) {
      return res.status(400).json({ success: false, message: 'Chave e rótulo são obrigatórios' });
    }
    const item = await configCache.savePassagemCheckbox({ id, chave, label, categoria, icone, ordem, ativo });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[Admin] Erro ao salvar checkbox:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarPassagemCheckbox(req, res) {
  try {
    const { id } = req.params;
    const result = await configCache.deletePassagemCheckbox(id);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao deletar checkbox:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function togglePassagemCheckbox(req, res) {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    const result = await configCache.togglePassagemCheckbox(id, ativo);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao alterar status do checkbox:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function testarConexaoOracle(req, res) {
  const start = Date.now();
  let conn;
  try {
    const { getConnection, getPoolStats, getOracleConfig, thickMode } = require('../../core/database');
    const oracleConfig = getOracleConfig() || {};
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS SERVER_TIME,
              USER AS DB_USER,
              SYS_CONTEXT('USERENV', 'SESSION_USER') AS SESSION_USER,
              SYS_CONTEXT('USERENV', 'DB_NAME') AS DB_NAME,
              SYS_CONTEXT('USERENV', 'HOST') AS HOST_NAME
       FROM DUAL`
    );
    const latencyMs = Date.now() - start;
    const row = result.rows && result.rows[0] ? result.rows[0] : {};
    const poolStats = getPoolStats() || {};
    
    res.json({
      success: true,
      data: {
        status: 'UP',
        latencyMs,
        serverTime: row.SERVER_TIME || new Date().toISOString(),
        dbUser: oracleConfig.user || row.DB_USER || process.env.DB_USER,
        sessionUser: row.SESSION_USER || oracleConfig.user || process.env.DB_USER,
        dbName: oracleConfig.service || row.DB_NAME || process.env.DB_SERVICE,
        hostName: oracleConfig.host || row.HOST_NAME || process.env.DB_HOST,
        connectString: oracleConfig.connectString || `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
        mode: thickMode ? 'Thick (Instant Client 19c)' : 'Thin Mode',
        pool: poolStats
      }
    });
  } catch (err) {
    const { getOracleConfig } = require('../../core/database');
    const oracleConfig = getOracleConfig() || {};
    const latencyMs = Date.now() - start;
    console.error('[Admin] Erro ao testar conexão Oracle:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      data: {
        status: 'DOWN',
        latencyMs,
        error: err.message,
        connectString: oracleConfig.connectString || `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`
      }
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) {}
    }
  }
}

async function diagnosticarUsuarioLdap(req, res) {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, message: 'Informe o login do usuário' });
  }

  const cleanUser = username.trim().toLowerCase();
  const report = {
    username: cleanUser,
    timestamp: new Date().toISOString(),
    tasy: { found: false, nm_usuario: null, nome: null, ie_situacao: null, situacaoTexto: 'Não encontrado' },
    ldap: { found: false, groups: [], error: null },
    perfisMapeados: [],
    status: 'UNKNOWN',
    veredicto: '',
    acoesRecomendadas: []
  };

  // 1. Consulta no TASY
  let conn;
  try {
    const { getConnection } = require('../../core/database');
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT nm_usuario, ds_usuario, ie_situacao, cd_pessoa_fisica, ie_profissional,
              obter_nome_usuario(nm_usuario) AS nome
       FROM usuario
       WHERE LOWER(nm_usuario) = LOWER(:u) OR LOWER(ds_login) = LOWER(:u)`,
      { u: cleanUser }
    );
    if (result.rows && result.rows.length > 0) {
      const u = result.rows[0];
      report.tasy.found = true;
      report.tasy.nm_usuario = u.NM_USUARIO;
      report.tasy.nome = u.NOME || u.DS_USUARIO || u.NM_USUARIO;
      report.tasy.ie_situacao = u.IE_SITUACAO;
      report.tasy.situacaoTexto = u.IE_SITUACAO === 'A' ? 'Ativo (A)' : `Inativo (${u.IE_SITUACAO})`;
      report.tasy.cd_pessoa_fisica = u.CD_PESSOA_FISICA;
    }
  } catch (err) {
    report.tasy.error = err.message;
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) {}
    }
  }

  // 2. Consulta no LDAP
  try {
    const ldapService = require('../auth/ldapService');
    const groups = await ldapService.getUserGroupsAsAdmin(cleanUser);
    report.ldap.found = true;
    report.ldap.groups = groups || [];
  } catch (err) {
    report.ldap.error = err.message;
  }

  // 3. Mapeamento de Perfis no Conecta
  const cachedPerfis = configCache.getCachedPerfis();
  const perfisAtivos = cachedPerfis.filter(p => {
    return (report.ldap.groups || []).some(g => (g || '').toUpperCase() === (p.grupoLdap || '').toUpperCase());
  });
  report.perfisMapeados = perfisAtivos.map(p => ({ id: p.id, nome: p.nome, grupoLdap: p.grupoLdap }));

  // 4. Veredito e Ações Recomendadas
  if (!report.tasy.found) {
    report.status = 'ERROR';
    report.veredicto = 'Usuário não encontrado na tabela USUARIO do TASY.';
    report.acoesRecomendadas.push(`Cadastrar o usuário "${cleanUser}" na Manutenção de Usuários do TASY.`);
  } else if (report.tasy.ie_situacao !== 'A') {
    report.status = 'ERROR';
    report.veredicto = `Usuário está INATIVO no TASY (IE_SITUACAO = '${report.tasy.ie_situacao}').`;
    report.acoesRecomendadas.push('Ativar o usuário na Manutenção de Usuários do TASY.');
  } else if (report.ldap.found && report.perfisMapeados.length === 0) {
    report.status = 'WARNING';
    report.veredicto = 'Usuário autentica no AD, mas não pertence a nenhum grupo mapeado no Conecta.';
    report.acoesRecomendadas.push(`Adicionar o usuário a um dos grupos do Conecta no AD (ex: API_CONECTA_ASSISTENCIAL_ENF, API_CONECTA_ADMIN).`);
  } else if (report.tasy.found && report.tasy.ie_situacao === 'A') {
    report.status = 'OK';
    report.veredicto = 'Usuário regular e apto para acessar o Conecta!';
    if (report.perfisMapeados.length > 0) {
      report.acoesRecomendadas.push(`Perfis disponíveis: ${report.perfisMapeados.map(p => p.nome).join(', ')}.`);
    }
  } else {
    report.status = 'WARNING';
    report.veredicto = 'Cadastro verificado com observações.';
  }

  res.json({ success: true, data: report });
}

async function obterConfigOracle(req, res) {
  try {
    const { getOracleConfig } = require('../../core/database');
    res.json({ success: true, data: getOracleConfig() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarConfigOracle(req, res) {
  try {
    const { host, port, service, user, password, poolMin, poolMax } = req.body;
    if (!host || !service || !user) {
      return res.status(400).json({ success: false, message: 'Host, Serviço e Usuário são obrigatórios' });
    }

    const { reconnectPool } = require('../../core/database');
    const updateParams = {
      host: host.trim(),
      port: (port || '1521').trim(),
      service: service.trim(),
      user: user.trim(),
      poolMin: parseInt(poolMin || '3', 10),
      poolMax: parseInt(poolMax || '15', 10)
    };
    if (password && String(password).trim()) {
      updateParams.password = String(password).trim();
    }

    const result = await reconnectPool(updateParams);

    // Persiste no SQLite
    await configCache.saveSystemConfig({
      db_host: updateParams.host,
      db_port: updateParams.port,
      db_service: updateParams.service,
      db_user: updateParams.user,
      db_pool_min: updateParams.poolMin,
      db_pool_max: updateParams.poolMax
    });

    res.json({ success: true, message: 'Configurações do Oracle salvas e pool reconectado com sucesso!', data: result });
  } catch (err) {
    console.error('[Admin] Erro ao salvar configurações do Oracle:', err);
    res.status(500).json({ success: false, message: 'Erro ao reconectar no Oracle: ' + err.message });
  }
}

async function obterConfigLdap(req, res) {
  try {
    const { getLdapPublicConfig } = require('../../core/config/ldap');
    res.json({ success: true, data: getLdapPublicConfig() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarConfigLdap(req, res) {
  try {
    const { enabled, url, baseDn, userDomain, adminUser, adminPassword } = req.body;
    const { updateLdapConfig } = require('../../core/config/ldap');

    const updateParams = {
      enabled: Boolean(enabled),
      url: (url || '').trim(),
      baseDn: (baseDn || '').trim(),
      userDomain: (userDomain || '').trim(),
      adminUser: (adminUser || '').trim()
    };
    if (adminPassword && String(adminPassword).trim()) {
      updateParams.adminPassword = String(adminPassword).trim();
    }

    const updated = updateLdapConfig(updateParams);

    // Persiste no SQLite
    await configCache.saveSystemConfig({
      ldap_enabled: updateParams.enabled ? 'true' : 'false',
      ldap_url: updateParams.url,
      ldap_base_dn: updateParams.baseDn,
      ldap_user_domain: updateParams.userDomain,
      ldap_admin_user: updateParams.adminUser
    });

    res.json({ success: true, message: 'Configurações do LDAP salvas com sucesso!', data: updated });
  } catch (err) {
    console.error('[Admin] Erro ao salvar configurações do LDAP:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listarPerfis,
  salvarPerfil,
  deletarPerfil,
  listarModulos,
  salvarModulo,
  deletarModulo,
  salvarPermissoesModulo,
  listarSetoresPassagem,
  obterCacheStatus,
  recarregarCache,
  listarGruposLdap,
  listarPerfisTasy,
  listarFilasEsperaTasy,
  obterConfigDashboardPA,
  salvarConfigDashboardPA,
  obterConfigSistema,
  salvarConfigSistema,
  listarAgendasEct,
  listarProcedimentosEct,
  listarSessoes,
  encerrarSessao,
  listarAuditTrail,
  listarStudioPages,
  obterStudioPage,
  salvarStudioPage,
  deletarStudioPage,
  listarPassagemCheckboxes,
  listarCheckboxesAtivos,
  salvarPassagemCheckbox,
  deletarPassagemCheckbox,
  togglePassagemCheckbox,
  testarConexaoOracle,
  diagnosticarUsuarioLdap,
  obterConfigOracle,
  salvarConfigOracle,
  obterConfigLdap,
  salvarConfigLdap
};

