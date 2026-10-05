const express = require('express');
const router = express.Router();
const authController = require('./authController');
const nativeSsoController = require('./nativeSsoController');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.me);
router.post('/native-sso/login', nativeSsoController.login);
router.post('/perfil/alterar', require('../../core/middlewares/authMiddleware').requireAuth, authController.alterarPerfil);

module.exports = router;
