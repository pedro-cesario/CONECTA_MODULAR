const configCache = require('../config/configCache');

function getPerfisDisponiveis(usuario) {
  if (!usuario) return [];
  if (Array.isArray(usuario.perfisDisponiveis) && usuario.perfisDisponiveis.length > 0) {
    return usuario.perfisDisponiveis;
  }
  if (usuario.grupos_ad) {
    return configCache.getPerfisDisponiveis(usuario.grupos_ad);
  }
  return [];
}

function getPerfilAtivo(usuario) {
  if (!usuario) return null;

  if (usuario.perfilAtivo) {
    return usuario.perfilAtivo;
  }

  const perfis = getPerfisDisponiveis(usuario);
  return perfis[0]?.id || null;
}

function validarPerfil(usuario, perfilId) {
  if (!usuario) return false;

  const perfilAtivo = getPerfilAtivo(usuario);
  if (!perfilAtivo) return false;

  const especialidade = configCache.getCachedPerfis().find(e => e.id === perfilId);
  if (!especialidade) return false;

  const temFlag = Boolean(usuario[especialidade.sessionFlag]);
  const perfilCorreto = perfilAtivo === perfilId;

  return temFlag && perfilCorreto;
}

function temPerfil(usuario, perfilId) {
  if (!usuario) return false;

  const especialidade = configCache.getCachedPerfis().find(e => e.id === perfilId);
  if (!especialidade) return false;

  return Boolean(usuario[especialidade.sessionFlag]);
}

function validarModuloPermissao(usuario, moduloId, permissao) {
  if (!usuario) return false;
  const perfilAtivo = getPerfilAtivo(usuario);
  if (!perfilAtivo) return false;
  if (!configCache.perfilTemAcessoModulo(perfilAtivo, moduloId)) return false;
  if (permissao && !configCache.perfilTemPermissao(perfilAtivo, moduloId, permissao)) return false;
  return true;
}

module.exports = {
  getPerfisDisponiveis,
  getPerfilAtivo,
  validarPerfil,
  temPerfil,
  validarModuloPermissao
};
