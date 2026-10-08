const TriagemPaService = require('./TriagemPaService');
const PacienteService = require('../core/paciente/PacienteService');
const { AppError } = require('../../core/errors/AppError');

function usuarioDaSessao(req) {
  return req.session?.usuario?.nm_usuario || req.session?.usuario?.username || 'SISTEMA';
}

async function buscar(req, res, next) {
  try {
    const { q } = req.query;
    const pacientes = await TriagemPaService.buscarPacientes(q);
    res.json(pacientes);
  } catch (error) {
    next(error);
  }
}

async function cadastrarPaciente(req, res, next) {
  try {
    const dados = {
      nm_pessoa_fisica: String(req.body?.nm_pessoa_fisica || '').trim(),
      dt_nascimento: req.body?.dt_nascimento,
      nr_cpf: String(req.body?.nr_cpf || '').replace(/\D/g, '')
    };
    if (!dados.nm_pessoa_fisica || !dados.dt_nascimento || !dados.nr_cpf) {
      throw new AppError('Nome completo, data de nascimento e CPF são obrigatórios.', 400);
    }
    if (!/^\d{11}$/.test(dados.nr_cpf)) {
      throw new AppError('CPF deve conter 11 dígitos.', 400);
    }
    const nmUsuario = usuarioDaSessao(req);
    const cdPessoaFisica = await PacienteService.salvarPessoa(dados, nmUsuario);
    res.status(201).json({
      success: true,
      cd_pessoa_fisica: cdPessoaFisica,
      paciente: { cd_pessoa_fisica: cdPessoaFisica, ...dados }
    });
  } catch (error) {
    next(error);
  }
}

async function naoIdentificado(req, res, next) {
  try {
    const nmUsuario = usuarioDaSessao(req);
    const result = await TriagemPaService.registrarPacienteNaoIdentificado(nmUsuario);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function semDocumento(req, res, next) {
  try {
    const { cdPessoaFisica } = req.params;
    const nmUsuario = usuarioDaSessao(req);
    const result = await TriagemPaService.registrarPacienteSemDocumento(cdPessoaFisica, nmUsuario);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function iniciar(req, res, next) {
  try {
    const dados = req.body;
    const nmUsuario = usuarioDaSessao(req);
    const result = await TriagemPaService.iniciarAtendimentoTriagem(dados, nmUsuario);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function descartarSenha(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const nmUsuario = usuarioDaSessao(req);
    const result = await TriagemPaService.descartarSenha(id, motivo, nmUsuario);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function statusSenha(req, res, next) {
  try {
    const { id } = req.params;
    const result = await TriagemPaService.obterStatusSenha(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}


async function obterAlergias(req, res, next) {
  try {
    const result = await TriagemPaService.carregarAlergiasPaciente(req.params.cdPessoaFisica);
    res.json(result);
  } catch (error) { next(error); }
}

async function buscarPrincipiosAtivos(req, res, next) {
  try {
    const result = await TriagemPaService.buscarPrincipiosAtivos(req.query.q);
    res.json(result);
  } catch (error) { next(error); }
}

async function obterRascunho(req, res, next) {
  try {
    const result = await TriagemPaService.getRascunho(req.params.nrAtendimento);
    res.json(result);
  } catch (error) { next(error); }
}

async function salvarRascunho(req, res, next) {
  try {
    const nmUsuario = usuarioDaSessao(req);
    const result = await TriagemPaService.saveRascunho(req.params.nrAtendimento, req.body, nmUsuario);
    res.json(result);
  } catch (error) { next(error); }
}

async function obterConfiguracoesClinicas(req, res, next) {
  try {
    const result = await TriagemPaService.getConfiguracoesClinicas();
    res.json(result);
  } catch (error) { next(error); }
}

module.exports = {
  obterAlergias,
  buscarPrincipiosAtivos,
  obterRascunho,
  salvarRascunho,
  obterConfiguracoesClinicas,
  buscar,
  cadastrarPaciente,
  naoIdentificado,
  semDocumento,
  iniciar,
  descartarSenha,
  statusSenha
};

async function finalizarTriagem(req, res, next) {
  try {
    const { nrAtendimento } = req.params;
    const nmUsuario = usuarioDaSessao(req);
    const TriagemPaFinalizacaoService = require('./TriagemPaFinalizacaoService');
    const result = await TriagemPaFinalizacaoService.finalizarTriagem(nrAtendimento, req.body, nmUsuario);
    res.json(result);
  } catch(error) {
    next(error);
  }
}

module.exports.finalizarTriagem = finalizarTriagem;
