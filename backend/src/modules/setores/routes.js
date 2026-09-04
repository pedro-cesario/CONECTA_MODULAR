const express = require('express');
const router = express.Router();
const setorController = require('./setorController');
const { requirePermission } = require('../../core/middlewares/authMiddleware');

router.get('/', requirePermission(['dashboard', 'passagem', 'livro', 'escala']), setorController.listarSetores);
router.get('/internacao', requirePermission(['dashboard', 'passagem', 'livro']), setorController.listarSetoresInternacao);
router.post('/internacao', requirePermission(['dashboard', 'passagem', 'livro']), setorController.listarSetoresInternacao);
router.get('/livro', requirePermission('livro'), setorController.listarSetoresLivro);

module.exports = router;
