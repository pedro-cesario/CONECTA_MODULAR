const recepcaoService = require('./recepcaoService');

/**
 * Módulo de Recepção & Acolhimento — Controller HTTP
 */

async function listarFilasSenhas(req, res, next) {
  try {
    const data = await recepcaoService.listarFilasSenhas();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarSenhasEspera(req, res, next) {
  try {
    const { fila } = req.query;
    const data = await recepcaoService.listarSenhasEspera(fila);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function chamarProximaSenha(req, res, next) {
  try {
    const { nr_seq_fila_senha, ds_maquina } = req.body;
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.chamarProximaSenha(nr_seq_fila_senha, ds_maquina, usuario);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function rechamarSenha(req, res, next) {
  try {
    const { nr_sequencia, ds_maquina } = req.body;
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.rechamarSenha(nr_sequencia, ds_maquina, usuario);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function buscarPessoas(req, res, next) {
  try {
    const { q } = req.query;
    const data = await recepcaoService.buscarPessoas(q);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function obterPessoaCompleta(req, res, next) {
  try {
    const { id } = req.params;
    const data = await recepcaoService.obterPessoaCompleta(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function salvarPessoa(req, res, next) {
  try {
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.salvarPessoa(req.body, usuario);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function abrirAtendimento(req, res, next) {
  try {
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.abrirAtendimento(req.body, usuario);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listarRelatoriosAtendimento(req, res, next) {
  try {
    const data = await recepcaoService.listarRelatoriosAtendimento();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarDocumentosGED(req, res, next) {
  try {
    const { nr_atendimento, cd_pessoa_fisica } = req.query;
    const data = await recepcaoService.listarDocumentosGED(nr_atendimento, cd_pessoa_fisica);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function anexarDocumentoGED(req, res, next) {
  try {
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.anexarDocumentoGED(req.body, usuario);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarFilasSenhas,
  listarSenhasEspera,
  chamarProximaSenha,
  rechamarSenha,
  buscarPessoas,
  obterPessoaCompleta,
  salvarPessoa,
  abrirAtendimento,
  listarRelatoriosAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED
};
