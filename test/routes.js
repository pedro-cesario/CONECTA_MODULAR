const express = require('express');
const router = express.Router();

const ldapService = require('./ldapService');
const { requireAuth } = require('./middleware/authMiddleware');
const controller = require('./controller');

router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: 'Usuário e senha são obrigatórios' });
  }

  try {
    const usuario = await ldapService.authenticate(username, password);

    if (!usuario) {
      return res.json({ success: false, message: 'Usuário ou senha inválidos' });
    }

    req.session.usuario = usuario;
    req.session.save((err) => {
      if (err) {
        return res.json({ success: false, message: 'Erro ao criar sessão' });
      }
      res.json({
        success: true,
        user: {
          nm_usuario: usuario.nome,
          username: usuario.username
        }
      });
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, message: 'Erro ao encerrar sessão' });
    }
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.usuario) {
    return res.json({ success: false, message: 'Não autenticado' });
  }

  res.json({
    success: true,
    user: {
      nm_usuario: req.session.usuario.nome,
      username: req.session.usuario.username
    }
  });
});

router.get('/test/status', controller.status);
router.post('/test/run', requireAuth, controller.run);
router.get('/test/history', requireAuth, controller.history);
router.delete('/test/clear-data', requireAuth, controller.clearData);

module.exports = router;