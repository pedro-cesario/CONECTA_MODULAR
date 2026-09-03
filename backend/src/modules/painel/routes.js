/**
 * Conecta HEAL 2.0 - Painel TV Routes
 */

const express = require('express');
const router = express.Router();
const painelController = require('./painelController');

// Endpoints públicos da TV / Painel (não exigem login para exibir na TV do saguão)
router.get('/:id/estado', painelController.obterEstadoPainel);
router.get('/:id/stream', painelController.streamPainel);
router.get('/detectar-maquina', painelController.detectarMinhaMaquina);

module.exports = router;
