const express = require('express');
const router = express.Router();
const escalaAtivaController = require('./escalaAtivaController');

router.get('/', escalaAtivaController.loadEscalaAtiva);
router.get('/periodo', escalaAtivaController.loadEscalasAtivasPorPeriodo);
router.get('/patio-circulante-global', escalaAtivaController.buscarPatioCirculanteGlobal);
router.put('/', escalaAtivaController.saveEscalaAtiva);
router.get('/versoes', escalaAtivaController.listarVersoes);
router.get('/versao', escalaAtivaController.loadVersaoEspecifica);
router.get('/diff', escalaAtivaController.loadDiff);

module.exports = router;
