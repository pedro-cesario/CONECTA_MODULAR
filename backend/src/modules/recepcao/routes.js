const express = require('express');
const router = express.Router();
const recepcaoController = require('./recepcaoController');

// PILAR 1: Senhas e Guichê
router.get('/filas', recepcaoController.listarFilasSenhas);
router.get('/senhas', recepcaoController.listarSenhasEspera);
router.post('/senhas/chamar', recepcaoController.chamarProximaSenha);
router.post('/senhas/rechamar', recepcaoController.rechamarSenha);

// PILAR 2 & 3: Pessoas e Endereço
router.get('/pessoas/buscar', recepcaoController.buscarPessoas);
router.get('/pessoas/:id', recepcaoController.obterPessoaCompleta);
router.post('/pessoas', recepcaoController.salvarPessoa);

// PILAR 4: Abertura do Atendimento Âncora
router.post('/atendimentos', recepcaoController.abrirAtendimento);

// PILAR 5: Relatórios TASY e GED
router.get('/relatorios', recepcaoController.listarRelatoriosAtendimento);
router.get('/ged', recepcaoController.listarDocumentosGED);
router.post('/ged', recepcaoController.anexarDocumentoGED);

module.exports = router;
