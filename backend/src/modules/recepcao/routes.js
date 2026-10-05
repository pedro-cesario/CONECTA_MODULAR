const express = require('express');
const router = express.Router();
const recepcaoController = require('./recepcaoController');
const { requirePermission } = require('../../core/middlewares/authMiddleware');

// Função helper para reduzir o boilerplate de rotas da recepção
const reqRec = (perm = null) => requirePermission(['recepcao', 'dashboard_pa'], perm);

// PILAR 1: Senhas e Guichê (Acessível por Painel de Senhas e Recepção)
router.get('/filas', requirePermission(['painel_senhas', 'recepcao', 'dashboard_pa']), recepcaoController.listarFilasSenhas);
router.get('/senhas', requirePermission(['painel_senhas', 'recepcao', 'dashboard_pa']), recepcaoController.listarSenhasEspera);
router.post('/senhas/chamar', requirePermission(['painel_senhas', 'recepcao', 'dashboard_pa'], 'chamar_senha'), recepcaoController.chamarProximaSenha);
router.post('/senhas/rechamar', requirePermission(['painel_senhas', 'recepcao', 'dashboard_pa'], 'chamar_senha'), recepcaoController.rechamarSenha);

router.get('/senhas/motivos-inutilizacao', reqRec(), recepcaoController.listarMotivosInutilizacao);
router.post('/senhas/:id/inutilizar', reqRec('chamar_senha'), recepcaoController.inutilizarSenha);
// PILAR 2 & 3: Pessoas e Endereço
router.get('/pessoas/buscar', reqRec(), recepcaoController.buscarPessoas);
router.get('/pessoas/verificar-duplicidade', reqRec(), recepcaoController.verificarDuplicidadePaciente);
router.get('/pessoas/:id', reqRec(), recepcaoController.obterPessoaCompleta);
router.get('/pessoas/:id/ultimo-convenio', reqRec(), recepcaoController.obterUltimoConvenioPaciente);
router.post('/pessoas', reqRec('cadastrar_pessoa_fisica'), recepcaoController.salvarPessoa);

// Convênios e Planos (ATEND_CATEGORIA_CONVENIO)
router.get('/convenios', reqRec(), recepcaoController.listarConvenios);
router.get('/convenios/:cdConvenio/categorias', reqRec(), recepcaoController.listarCategoriasConvenio);

// Setores Assistenciais & Classificações
router.get('/setores', reqRec(), recepcaoController.listarSetoresAtendimento);
router.get('/classificacoes', reqRec(), recepcaoController.listarClassificacoesAtendimento);

// PILAR 4: Abertura do Atendimento Âncora & Histórico do Dia
router.get('/atendimentos/hoje', reqRec(), recepcaoController.listarAtendimentosHoje);
router.post('/atendimentos', reqRec('abrir_atendimento'), recepcaoController.abrirAtendimento);
router.put('/atendimentos/:nr_atendimento', reqRec('abrir_atendimento'), recepcaoController.atualizarAtendimento);

// PILAR 5: Relatórios TASY e GED
router.get('/relatorios', reqRec(), recepcaoController.listarRelatoriosAtendimento);
router.get('/relatorios/:id/gerar', reqRec('emitir_relatorio'), recepcaoController.gerarRelatorioAtendimento);
router.get('/ged', reqRec(), recepcaoController.listarDocumentosGED);
router.post('/ged', reqRec('anexar_documento_ged'), recepcaoController.anexarDocumentoGED);

router.get('/ged/:id/download', reqRec(), recepcaoController.downloadDocumentoGED);
router.post('/ged/:id/inativar', reqRec('anexar_documento_ged'), recepcaoController.excluirDocumentoGED);
router.post("/atendimentos/:nr_atendimento/cancelar", reqRec("abrir_atendimento"), recepcaoController.cancelarAtendimento);
module.exports = router;
