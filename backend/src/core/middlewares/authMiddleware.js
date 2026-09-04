const { validarModuloPermissao } = require("../utils/acesso");
const ADMIN_GROUP = process.env.ADMIN_AD_GROUP || 'API_CONECTA_ADMIN';

function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
  }

  const gruposAd = req.session.usuario.grupos_ad || [];
  const temAcessoAdmin = (gruposAd || []).some(g => {
    const grupo = String(g || '').trim().toUpperCase();
    return grupo === ADMIN_GROUP.toUpperCase();
  });

  if (!temAcessoAdmin) {
    console.log(`[Admin] Acesso negado para ${req.session.usuario.nm_usuario} - grupo ${ADMIN_GROUP} não encontrado em grupos AD`);
    return res.status(403).json({ success: false, message: 'Acesso restrito a administradores.' });
  }

  next();
}


function requirePermission(modulos, permissao = null) {
  return (req, res, next) => {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: "Sessão expirada. Faça login novamente." });
    }
    
    const modulosArray = Array.isArray(modulos) ? modulos : [modulos];
    const temAcesso = modulosArray.some(moduloId => validarModuloPermissao(usuario, moduloId, permissao));

    if (temAcesso) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: `Acesso negado: seu perfil não possui autorização para a operação exigida.`
    });
  };
}

module.exports = { requireAuth, requireAdmin, requirePermission };
