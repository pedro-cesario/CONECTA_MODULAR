const express = require('express');
const router = express.Router();
const pacienteController = require('./pacienteController');

router.post('/', pacienteController.listarPacientes);
router.get('/setor/:cd_setor', pacienteController.listarPacientesSetor);
// the dashboard post is actually pointing to pacienteController.listarPacientesDashboard
router.post('/dashboard/setor/:cd_setor', pacienteController.listarPacientesDashboard);

module.exports = router;
