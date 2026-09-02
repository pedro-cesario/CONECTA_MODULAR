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
router.get('/pessoas/:id/ultimo-convenio', recepcaoController.obterUltimoConvenioPaciente);
router.post('/pessoas', recepcaoController.salvarPessoa);

// Convênios e Planos (ATEND_CATEGORIA_CONVENIO)
router.get('/convenios', recepcaoController.listarConvenios);
router.get('/convenios/:cdConvenio/categorias', recepcaoController.listarCategoriasConvenio);

// Setores Assistenciais & Classificações
router.get('/setores', recepcaoController.listarSetoresAtendimento);
router.get('/classificacoes', recepcaoController.listarClassificacoesAtendimento);

// PILAR 4: Abertura do Atendimento Âncora
router.post('/atendimentos', recepcaoController.abrirAtendimento);

// PILAR 5: Relatórios TASY e GED
router.get('/relatorios', recepcaoController.listarRelatoriosAtendimento);
router.get('/ged', recepcaoController.listarDocumentosGED);
router.post('/ged', recepcaoController.anexarDocumentoGED);

module.exports = router;
