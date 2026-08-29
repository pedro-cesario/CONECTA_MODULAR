const express = require('express');
const router = express.Router();
const usuarioController = require('./usuarioController');

router.get('/tecnicos', usuarioController.listarTecnicos);
router.get('/enfermeiros', usuarioController.listarEnfermeiros);
router.get('/profissionais-psicologia', usuarioController.listarProfissionaisSetor4);

module.exports = router;
