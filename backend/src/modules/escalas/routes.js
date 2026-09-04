const express = require('express');
const router = express.Router();
const escalaAtivaController = require('./escalaAtivaController');
const { requirePermission } = require('../../core/middlewares/authMiddleware');

router.get('/', requirePermission('escala'), escalaAtivaController.loadEscalaAtiva);
router.get('/periodo', requirePermission('escala'), escalaAtivaController.loadEscalasAtivasPorPeriodo);
router.get('/patio-circulante-global', requirePermission('escala'), escalaAtivaController.buscarPatioCirculanteGlobal);
router.put('/', requirePermission('escala', 'editar_publicar_escala'), escalaAtivaController.saveEscalaAtiva);
router.get('/versoes', requirePermission('escala'), escalaAtivaController.listarVersoes);
router.get('/versao', requirePermission('escala'), escalaAtivaController.loadVersaoEspecifica);
router.get('/diff', requirePermission('escala'), escalaAtivaController.loadDiff);

module.exports = router;
