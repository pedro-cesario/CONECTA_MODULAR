const nativeSsoService = require('../services/nativeSsoService');
const ldapService = require('../services/ldapService');
const authController = require('./authController');

async function login(req, res) {
  try {
    const identity = await nativeSsoService.validateTasyToken(req.body?.tasy_token);
    const gruposAd = await ldapService.getUserGroupsAsAdmin(identity.username);
    const usuario = await authController.createAuthenticatedSession(
      req,
      identity.username,
      gruposAd,
      { source: 'native_sso', client: req.body?.client || {} }
    );
    return res.json({ success: true, data: usuario });
  } catch (err) {
    console.error('[Native SSO] Falha:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.status && err.status < 500 ? err.message : 'Não foi possível autenticar pelo Native.'
    });
  }
}

module.exports = { login };
