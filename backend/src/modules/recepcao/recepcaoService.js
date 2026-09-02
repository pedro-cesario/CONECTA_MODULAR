const recepcaoRepository = require('./recepcaoRepository');
const tasyReportsClient = require('./tasyReportsClient');
const logger = require('../../core/utils/logger');

/**
 * Módulo de Recepção & Acolhimento — Camada de Serviço
 */

async function listarFilasSenhas() {
  return recepcaoRepository.listarFilasSenhas();
}

async function listarSenhasEspera(nrSeqFila) {
  return recepcaoRepository.listarSenhasEspera(nrSeqFila);
}

async function chamarProximaSenha(nrSeqFila, dsMaquina, nmUsuario) {
  if (!nrSeqFila) {
    const err = new Error('Identificação da fila é obrigatória');
    err.status = 400;
    throw err;
  }
  const result = await recepcaoRepository.chamarProximaSenha(nrSeqFila, dsMaquina, nmUsuario);
  if (!result) {
    return { proxima: false, message: 'Nenhuma senha aguardando nesta fila.' };
  }
  return { proxima: true, data: result };
}

async function rechamarSenha(nrSeqSenha, dsMaquina, nmUsuario) {
  if (!nrSeqSenha) {
    const err = new Error('Sequência da senha é obrigatória');
    err.status = 400;
    throw err;
  }
  return recepcaoRepository.rechamarSenha(nrSeqSenha, dsMaquina, nmUsuario);
}

async function buscarPessoas(termo) {
  if (!termo || String(termo).trim().length < 2) {
    return [];
  }
  return recepcaoRepository.buscarPessoas(termo);
}

async function obterPessoaCompleta(cdPessoaFisica) {
  if (!cdPessoaFisica) {
    const err = new Error('Código de pessoa física é obrigatório');
    err.status = 400;
    throw err;
  }
  const pessoa = await recepcaoRepository.obterPessoaCompleta(cdPessoaFisica);
  if (!pessoa) {
    const err = new Error('Pessoa física não encontrada');
    err.status = 404;
    throw err;
  }
  return pessoa;
}

async function salvarPessoa(dados, nmUsuario) {
  if (!dados.nm_pessoa_fisica || !String(dados.nm_pessoa_fisica).trim()) {
    const err = new Error('Nome completo da pessoa é obrigatório');
    err.status = 400;
    throw err;
  }
  if (!dados.dt_nascimento) {
    const err = new Error('Data de nascimento é obrigatória');
    err.status = 400;
    throw err;
  }
  return recepcaoRepository.salvarPessoaFisica(dados, nmUsuario);
}

async function listarConvenios() {
  return recepcaoRepository.listarConvenios();
}

async function listarCategoriasConvenio(cdConvenio) {
  if (!cdConvenio) return [];
  return recepcaoRepository.listarCategoriasConvenio(cdConvenio);
}

async function obterUltimoConvenioPaciente(cdPessoaFisica) {
  if (!cdPessoaFisica) return null;
  return recepcaoRepository.obterUltimoConvenioPaciente(cdPessoaFisica);
}

async function listarSetoresAtendimento() {
  return recepcaoRepository.listarSetoresAtendimento();
}

async function listarClassificacoesAtendimento() {
  return recepcaoRepository.listarClassificacoesAtendimento();
}

async function abrirAtendimento(dados, nmUsuario) {
  if (!dados.cd_pessoa_fisica) {
    const err = new Error('Pessoa física é obrigatória para abrir atendimento');
    err.status = 400;
    throw err;
  }
  return recepcaoRepository.abrirAtendimento(dados, nmUsuario);
}

async function listarRelatoriosAtendimento() {
  return recepcaoRepository.listarRelatoriosAtendimento();
}

async function gerarRelatorioAtendimento(cdRelatorio, nrAtendimento, customParams = {}, userAuth = null) {
  if (!nrAtendimento) {
    const err = new Error('Número do atendimento é obrigatório para emitir o relatório');
    err.status = 400;
    throw err;
  }
  return tasyReportsClient.gerarRelatorioPdf(cdRelatorio, nrAtendimento, customParams, userAuth);
}

async function listarDocumentosGED(nrAtendimento, cdPessoaFisica) {
  return recepcaoRepository.listarDocumentosGED(nrAtendimento, cdPessoaFisica);
}

async function anexarDocumentoGED(dados, nmUsuario, userAuth = null) {
  if (!dados.cd_pessoa_fisica) {
    const err = new Error('Código de pessoa física é obrigatório');
    err.status = 400;
    throw err;
  }
  if (!dados.ds_arquivo && !dados.conteudo_base64) {
    const err = new Error('Arquivo é obrigatório para anexar no GED');
    err.status = 400;
    throw err;
  }

  // Se o conteúdo binário em base64 foi enviado, faz upload direto no Storage oficial do TASY
  if (dados.conteudo_base64) {
    try {
      let base64Clean = dados.conteudo_base64;
      if (base64Clean.includes('base64,')) {
        base64Clean = base64Clean.split('base64,')[1];
      }
      const buffer = Buffer.from(base64Clean, 'base64');
      const fileName = dados.ds_titulo || dados.ds_arquivo || 'documento.pdf';
      const mimeType = dados.mime_type || 'application/pdf';

      console.log(`[GED] Enviando arquivo "${fileName}" (${buffer.length} bytes) para o TASY Storage...`);
      const storageUri = await tasyReportsClient.uploadArquivoTasyStorage(buffer, fileName, mimeType, userAuth);
      console.log(`[GED] Arquivo enviado com sucesso! Storage URI: ${storageUri}`);
      dados.ds_arquivo = storageUri;
    } catch (errUpload) {
      console.error('[GED] Erro ao enviar para o TASY Storage:', errUpload);
      throw new Error(`Falha ao armazenar arquivo no Storage do TASY: ${errUpload.message}`);
    }
  }

  return recepcaoRepository.anexarDocumentoGED(dados, nmUsuario);
}

module.exports = {
  listarFilasSenhas,
  listarSenhasEspera,
  chamarProximaSenha,
  rechamarSenha,
  buscarPessoas,
  obterPessoaCompleta,
  salvarPessoa,
  listarConvenios,
  listarCategoriasConvenio,
  obterUltimoConvenioPaciente,
  listarSetoresAtendimento,
  listarClassificacoesAtendimento,
  abrirAtendimento,
  listarRelatoriosAtendimento,
  gerarRelatorioAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED
};
