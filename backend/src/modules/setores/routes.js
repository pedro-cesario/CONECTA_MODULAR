const express = require('express');
const router = express.Router();
const setorController = require('./setorController');

router.get('/', setorController.listarSetores);
router.get('/internacao', setorController.listarSetoresInternacao);
router.post('/internacao', setorController.listarSetoresInternacao);
router.get('/livro', setorController.listarSetoresLivro);

module.exports = router;
