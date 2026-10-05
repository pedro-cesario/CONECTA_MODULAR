const express = require('express');
const router = express.Router();
const registroController = require('./registroController');
const { requirePermission } = require('../../core/middlewares/authMiddleware');

router.use(requirePermission('registros'));

router.get('/tipos', registroController.listarTipos);
router.get('/pessoas', registroController.buscarPessoas);
router.get('/pessoas/:cdPessoaFisica', registroController.obterPessoa);
router.post('/pessoas', registroController.cadastrarPessoa);
router.put('/pessoas/:cdPessoaFisica', registroController.atualizarPessoa);
router.post('/', registroController.salvarRegistro);
router.get('/historico', registroController.listarHistorico);

module.exports = router;
