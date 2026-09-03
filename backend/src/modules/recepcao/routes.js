const express = require('express');
const router = express.Router();
const recepcaoController = require('./recepcaoController');
const { validarModuloPermissao } = require('../../core/utils/acesso');

// Middleware de Autorização Granular do Módulo de Recepção (C-02)
function requireRecepcaoPermission(permissao = null) {
  return (req, res, next) => {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
    }
    if (validarModuloPermissao(usuario, 'recepcao', permissao)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Acesso negado: seu perfil não possui autorização para esta operação na Recepção & Acolhimento.'
    });
  };
}

// PILAR 1: Senhas e Guichê
router.get('/filas', requireRecepcaoPermission(), recepcaoController.listarFilasSenhas);
router.get('/senhas', requireRecepcaoPermission(), recepcaoController.listarSenhasEspera);
router.post('/senhas/chamar', requireRecepcaoPermission('chamar_senha'), recepcaoController.chamarProximaSenha);
router.post('/senhas/rechamar', requireRecepcaoPermission('chamar_senha'), recepcaoController.rechamarSenha);

// PILAR 2 & 3: Pessoas e Endereço
router.get('/pessoas/buscar', requireRecepcaoPermission(), recepcaoController.buscarPessoas);
router.get('/pessoas/:id', requireRecepcaoPermission(), recepcaoController.obterPessoaCompleta);
router.get('/pessoas/:id/ultimo-convenio', requireRecepcaoPermission(), recepcaoController.obterUltimoConvenioPaciente);
router.post('/pessoas', requireRecepcaoPermission('cadastrar_pessoa_fisica'), recepcaoController.salvarPessoa);

// Convênios e Planos (ATEND_CATEGORIA_CONVENIO)
router.get('/convenios', requireRecepcaoPermission(), recepcaoController.listarConvenios);
router.get('/convenios/:cdConvenio/categorias', requireRecepcaoPermission(), recepcaoController.listarCategoriasConvenio);

// Setores Assistenciais & Classificações
router.get('/setores', requireRecepcaoPermission(), recepcaoController.listarSetoresAtendimento);
router.get('/classificacoes', requireRecepcaoPermission(), recepcaoController.listarClassificacoesAtendimento);

// PILAR 4: Abertura do Atendimento Âncora & Histórico do Dia
router.get('/atendimentos/hoje', requireRecepcaoPermission(), recepcaoController.listarAtendimentosHoje);
router.post('/atendimentos', requireRecepcaoPermission('abrir_atendimento'), recepcaoController.abrirAtendimento);

// PILAR 5: Relatórios TASY e GED
router.get('/relatorios', requireRecepcaoPermission(), recepcaoController.listarRelatoriosAtendimento);
router.get('/relatorios/:id/gerar', requireRecepcaoPermission('emitir_relatorio'), recepcaoController.gerarRelatorioAtendimento);
router.get('/ged', requireRecepcaoPermission(), recepcaoController.listarDocumentosGED);
router.post('/ged', requireRecepcaoPermission('anexar_documento_ged'), recepcaoController.anexarDocumentoGED);

module.exports = router;
