const recepcaoRepository = require('./recepcaoRepository');
const tasyReportsClient = require('./tasyReportsClient');
const configCache = require('../../core/config/configCache');
const painelEventsService = require('../painel/painelEventsService');
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
  const mapping = configCache.getMaquinaGuiche(dsMaquina);
  const guicheFinal = mapping?.ds_guiche || dsMaquina || 'Guichê 01';
  const painelId = mapping?.painel_id || 'recepcao_principal';

  const result = await recepcaoRepository.chamarProximaSenha(nrSeqFila, guicheFinal, nmUsuario);
  if (!result) {
    return { proxima: false, message: 'Nenhuma senha aguardando nesta fila.' };
  }

  let prefixo = 'N';
  if (result.nr_prioridade === 1) prefixo = 'E';
  else if (result.nr_prioridade === 2) prefixo = 'P';

  const itemFormatado = {
    nr_sequencia: result.nr_sequencia,
    cd_senha_gerada: result.cd_senha_gerada,
    cd_senha_completa: `${prefixo}${result.cd_senha_gerada}`,
    ds_guiche: guicheFinal,
    ds_prioridade: result.ds_prioridade || 'Normal',
    nr_prioridade: result.nr_prioridade || 3,
    hr_chamada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    tipo_acao: 'CHAMADA'
  };

  painelEventsService.broadcastChamada(painelId, itemFormatado);

  return { proxima: true, data: { ...result, ds_guiche: guicheFinal, painel_id: painelId } };
}

async function rechamarSenha(nrSeqSenha, dsMaquina, nmUsuario) {
  if (!nrSeqSenha) {
    const err = new Error('Sequência da senha é obrigatória');
    err.status = 400;
    throw err;
  }
  const mapping = configCache.getMaquinaGuiche(dsMaquina);
  const guicheFinal = mapping?.ds_guiche || dsMaquina || 'Guichê 01';
  const painelId = mapping?.painel_id || 'recepcao_principal';

  const result = await recepcaoRepository.rechamarSenha(nrSeqSenha, guicheFinal, nmUsuario);

  let prefixo = 'N';
  if (result.nr_prioridade === 1) prefixo = 'E';
  else if (result.nr_prioridade === 2) prefixo = 'P';

  const itemFormatado = {
    nr_sequencia: nrSeqSenha,
    cd_senha_gerada: result.cd_senha_gerada,
    cd_senha_completa: `${prefixo}${result.cd_senha_gerada}`,
    ds_guiche: guicheFinal,
    ds_prioridade: result.ds_prioridade || 'Normal',
    nr_prioridade: result.nr_prioridade || 3,
    hr_chamada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    tipo_acao: 'RECHAMADA'
  };

  painelEventsService.broadcastChamada(painelId, itemFormatado);

  return { success: true, data: { ...result, ds_guiche: guicheFinal, painel_id: painelId } };
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

function validateMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;
  if (ext === 'pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (ext === 'png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (ext === 'docx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05);
  }
  if (ext === 'doc') {
    return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  }
  return true;
}

async function anexarDocumentoGED(dados, nmUsuario, userAuth = null) {
  if (!dados.cd_pessoa_fisica && !dados.nr_atendimento) {
    const err = new Error('Código de pessoa física ou número do atendimento é obrigatório para anexar no GED');
    err.status = 400;
    throw err;
  }
  if (!dados.ds_arquivo && !dados.conteudo_base64) {
    const err = new Error('Arquivo ou conteúdo é obrigatório para anexar no GED');
    err.status = 400;
    throw err;
  }

  const fileName = dados.ds_titulo || dados.ds_arquivo || 'documento.pdf';
  const ext = (fileName.split('.').pop() || 'pdf').toLowerCase();
  const ALLOWED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

  if (!ALLOWED_EXTS.includes(ext)) {
    const err = new Error(`Formato de arquivo ".${ext}" não permitido. Extensões aceitas: ${ALLOWED_EXTS.join(', ')}`);
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
      const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

      if (buffer.length > MAX_SIZE_BYTES) {
        const err = new Error(`O arquivo excede o tamanho máximo permitido de 15MB (Tamanho enviado: ${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
        err.status = 400;
        throw err;
      }

      if (!validateMagicBytes(buffer, ext)) {
        const err = new Error(`O conteúdo binário do arquivo não corresponde à assinatura do formato declarado (.${ext}). Envio cancelado por segurança.`);
        err.status = 400;
        throw err;
      }

      const mimeType = dados.mime_type || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`);

      console.log(`[GED] Enviando arquivo "${fileName}" (${buffer.length} bytes) para o TASY Storage...`);
      const storageUri = await tasyReportsClient.uploadArquivoTasyStorage(buffer, fileName, mimeType, userAuth);
      console.log(`[GED] Arquivo enviado com sucesso! Storage URI: ${storageUri}`);
      dados.ds_arquivo = storageUri;
      dados.ds_extensao_arquivo = ext;
    } catch (errUpload) {
      if (errUpload.status === 400) throw errUpload;
      console.error('[GED] Erro ao enviar para o TASY Storage:', errUpload);
      throw new Error(`Falha ao armazenar arquivo no Storage do TASY: ${errUpload.message}`);
    }
  }

  return recepcaoRepository.anexarDocumentoGED(dados, nmUsuario);
}

async function listarAtendimentosHoje() {
  return recepcaoRepository.listarAtendimentosHoje();
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
  listarAtendimentosHoje,
  listarRelatoriosAtendimento,
  gerarRelatorioAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED
};
