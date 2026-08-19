function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
  }
  next();
}

module.exports = { requireAuth };