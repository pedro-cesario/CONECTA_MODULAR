const express = require('express');
const router = express.Router();
const pacienteController = require('./pacienteController');
const { requirePermission } = require('../../core/middlewares/authMiddleware');

router.post('/', requirePermission(['dashboard', 'passagem']), pacienteController.listarPacientes);
router.get('/setor/:cd_setor', requirePermission(['dashboard', 'passagem']), pacienteController.listarPacientesSetor);
// the dashboard post is actually pointing to pacienteController.listarPacientesDashboard
router.post('/dashboard/setor/:cd_setor', requirePermission('dashboard'), pacienteController.listarPacientesDashboard);

module.exports = router;
