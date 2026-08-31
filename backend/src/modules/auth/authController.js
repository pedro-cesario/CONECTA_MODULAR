const ldapConfig = require('../../core/config/ldap');
const usuarioRepository = require('../usuarios/usuarioRepository');
const perfilRepository = require('.//perfilRepository');
const configCache = require('../../core/config/configCache');
const { getSessionFlags, buildCdPerfisMap } = require('../../core/config/especialidades');
const { getPerfisDisponiveis } = require('../../core/utils/acesso');
const ldapService = require('.//ldapService');
const dashboardService = require('../dashboard/dashboardService');
const policyClientService = require('.//policyClientService');

function atualizarContextoPerfilAtivo(usuario) {
  if (!usuario) return usuario;
  const perfilAtivo = usuario.perfilAtivo || null;
  const perfil = (usuario.perfisDisponiveis || []).find(item => item.id === perfilAtivo);
  usuario.permissoesAtivas = perfil?.permissoes || {};
  usuario.setoresPassagemPermitidos = perfilAtivo
    ? configCache.getSetoresPermitidos(perfilAtivo, 'passagem')
    : [];
  return usuario;
}

function isLdapCredentialError(ldapErr) {
  const message = (ldapErr?.message || '').toLowerCase();
  const code = String(ldapErr?.code || '');

  return (
    ldapErr?.status === 401 ||
    code === '49' ||
    message.includes('credenciais') ||
    message.includes('invalid credentials') ||
    message.includes('usuário não encontrado no ad') ||
    message.includes('usuário não encontrado no ad') ||
    message.includes('no such object')
  );
}

async function verificarAcesso(gruposAd) {
  const perfis = await configCache.getPerfisFromGroups(gruposAd);

  const temAlgumPerfil = Object.values(perfis).some(v => v);

  if (!temAlgumPerfil) {
    return { autorizado: false, motivo: 'perfil' };
  }

  const sessionFlags = getSessionFlags(perfis);

  const perfisAtivos = Object.entries(perfis).filter(([_, v]) => v).map(([k]) => k);
  const acessoTodosSetores = perfisAtivos.length > 1;

  return {
    autorizado: true,
    acessoTodosSetores,
    perfis,
    sessionFlags
  };
}

async function carregarUsuarioTasy(nmUsuario, gruposAd) {
  const usuario = await usuarioRepository.findByUsername(nmUsuario);
  if (!usuario) {
    const error = new Error('Usuário não encontrado ou inativo no TASY.');
    error.status = 401;
    throw error;
  }

  const acesso = await verificarAcesso(gruposAd);

  if (!acesso.autorizado) {
    const error = new Error('Acesso negado: perfil profissional ainda não habilitado para a passagem de plantão.');
    error.status = 403;
    throw error;
  }

  const cdPerfisMap = await buscarCdPerfisTasy(acesso.sessionFlags);
  if (!cdPerfisMap || Object.keys(cdPerfisMap).length === 0) {
    const error = new Error('Acesso negado: perfil da API não encontrado no TASY.');
    error.status = 403;
    throw error;
  }

  return {
    ...usuario,
    acesso_todos_setores: acesso.acessoTodosSetores,
    ...acesso.sessionFlags,
    cd_perfis: cdPerfisMap
  };
}

async function buscarCdPerfisTasy(sessionFlags) {
  const perfis = configCache.getCachedPerfis();
  const perfisPorEspecialidade = {};

  for (const especialidade of perfis) {
    const flagName = especialidade.sessionFlag;
    if (sessionFlags[flagName]) {
      const cdPerfil = await perfilRepository.findByDsPerfil(especialidade.dsPerfilTasy || especialidade.grupoLdap);
      if (cdPerfil) {
        perfisPorEspecialidade[especialidade.id] = cdPerfil;
        console.log(`[Perfil] ${especialidade.nome}: ${especialidade.dsPerfilTasy || especialidade.grupoLdap} = ${cdPerfil}`);
      } else {
        console.warn(`[Perfil] Não encontrado no TASY: ${especialidade.dsPerfilTasy || especialidade.grupoLdap} (${especialidade.nome})`);
      }
    }
  }

  return buildCdPerfisMap(perfisPorEspecialidade);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function createAuthenticatedSession(req, username, gruposAd, metadata = {}) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const accessDecision = await policyClientService.requireAccess('conecta', {
    username: normalizedUsername,
    groups: gruposAd,
    client: metadata.client || {}
  });
  const usuarioTasy = await carregarUsuarioTasy(normalizedUsername, gruposAd);

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '';
  const sessionFlags = {
    nm_usuario: usuarioTasy.NM_USUARIO || normalizedUsername,
    nome: usuarioTasy.NOME || normalizedUsername,
    cd_pessoa_fisica: usuarioTasy.CD_PESSOA_FISICA,
    ie_profissional: usuarioTasy.IE_PROFISSIONAL,
    acesso_todos_setores: usuarioTasy.acesso_todos_setores,
    grupos_ad: gruposAd,
    cd_perfis: usuarioTasy.cd_perfis,
    is_ldap: true,
    auth_source: metadata.source || 'password',
    ip: clientIp
  };

  perfisCache.forEach(p => {
    sessionFlags[p.sessionFlag] = Boolean(usuarioTasy[p.sessionFlag]);
  });

  await regenerateSession(req);
  req.session.usuario = sessionFlags;
  req.session.auth = {
    source: metadata.source || 'password',
    authenticated_at: new Date().toISOString(),
    access: { conecta: accessDecision },
    client: metadata.client || {}
  };
  req.session.usuario.perfisDisponiveis = getPerfisDisponiveis(sessionFlags);
  req.session.usuario.grupos_ad = gruposAd || [];

  if (req.session.usuario.perfisDisponiveis.length === 1) {
    req.session.usuario.perfilAtivo = req.session.usuario.perfisDisponiveis[0].id;
  } else if (req.session.usuario.perfisDisponiveis.length > 1) {
    const ordem = perfisCache.map(e => e.id);
    const perfisOrdenados = [...req.session.usuario.perfisDisponiveis]
      .sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
    req.session.usuario.perfilAtivo = perfisOrdenados[0].id;
  } else {
    req.session.usuario.perfilAtivo = null;
  }
  atualizarContextoPerfilAtivo(req.session.usuario);
  await saveSession(req);
  return req.session.usuario;
}

async function login(req, res) {
  try {
    const { nm_usuario, senha } = req.body;

    if (!nm_usuario || nm_usuario.trim() === '') {
      return res.status(400).json({ success: false, message: 'Informe o nome de usuário' });
    }
    if (!senha || senha.trim() === '') {
      return res.status(400).json({ success: false, message: 'Informe a senha' });
    }

    const username = nm_usuario.trim().toLowerCase();

    if (ldapConfig.enabled) {
      try {
        await ldapService.authenticate(username, senha);

        let gruposAd = [];
        try {
          gruposAd = await ldapService.getUserGroups(username, senha);
          console.log(`[Auth] Usuário "${username}" autenticado no LDAP. Grupos retornados:`, gruposAd);
        } catch (groupErr) {
          console.log('[LDAP] Erro ao buscar grupos:', groupErr.message);
        }

        const usuario = await createAuthenticatedSession(req, username, gruposAd, {
          source: 'password',
          client: req.body?.client || {}
        });
        return res.json({ success: true, data: usuario });
      } catch (ldapErr) {
        console.log('[LDAP] Erro:', ldapErr.message);
        if (isLdapCredentialError(ldapErr)) {
          return res.status(401).json({
            success: false,
            message: 'Login ou senha incorretos.'
          });
        }

        return res.status(ldapErr.status || 401).json({
          success: false,
          message: ldapErr.message || 'Não foi possível autenticar no momento. Tente novamente.'
        });
      }
    }

    return res.status(401).json({ success: false, message: 'LDAP não configurado' });
  } catch (err) {
    console.error('[Auth] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
}

async function logout(req, res) {
  dashboardService.clearCache();
  if (!req.session) return res.json({ success: true });
  req.session.destroy(() => {
    res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax', secure: false });
    res.json({ success: true });
  });
}

async function me(req, res) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }

  const perfis = getPerfisDisponiveis(req.session.usuario);
  req.session.usuario.perfisDisponiveis = perfis;
  atualizarContextoPerfilAtivo(req.session.usuario);

  res.json({ success: true, data: req.session.usuario });
}

async function alterarPerfil(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const { perfil } = req.body;
    if (!perfil) {
      return res.status(400).json({ success: false, message: 'Informe o perfil desejado' });
    }

    const perfis = getPerfisDisponiveis(usuario);
    const perfilValido = perfis.find(p => p.id === perfil);

    if (!perfilValido) {
      return res.status(403).json({ success: false, message: 'Perfil não autorizado para este usuário' });
    }

    req.session.usuario.perfilAtivo = perfil;
    req.session.usuario.perfisDisponiveis = perfis;
    atualizarContextoPerfilAtivo(req.session.usuario);
    await saveSession(req);

    return res.json({ success: true, data: req.session.usuario });
  } catch (err) {
    console.error('[Perfil] Erro:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  login,
  logout,
  me,
  alterarPerfil,
  createAuthenticatedSession,
  carregarUsuarioTasy
};
