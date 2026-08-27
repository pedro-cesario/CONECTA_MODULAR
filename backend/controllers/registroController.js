const registroService = require('../services/registroService');
const { validarModuloPermissao } = require('../utils/acesso');

async function listarTipos(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo de Registros' });
    }

    const tipos = registroService.listarTiposRegistros();
    return res.json({ success: true, data: tipos });
  } catch (err) {
    console.error('[Registros] Erro ao listar tipos:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function buscarPessoas(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo de Registros' });
    }

    const { termo, valor, tipo, q } = req.query || {};
    const busca = termo || valor || q || tipo;
    const pessoas = await registroService.buscarPessoas(tipo, busca);
    return res.json({ success: true, data: pessoas });
  } catch (err) {
    console.error('[Registros] Erro ao buscar pessoas:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function obterPessoa(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo de Registros' });
    }

    const { cdPessoaFisica } = req.params;
    const pessoa = await registroService.obterPessoa(cdPessoaFisica);
    return res.json({ success: true, data: pessoa });
  } catch (err) {
    console.error('[Registros] Erro ao obter pessoa:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function cadastrarPessoa(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros', 'cadastrar_pessoa_fisica') && !validarModuloPermissao(usuario, 'registros', 'lancar_demanda_espontanea')) {
      return res.status(403).json({ success: false, message: 'Sem permissão para cadastrar pessoa física' });
    }

    const pessoa = await registroService.cadastrarPessoa(req.body, usuario.nm_usuario);
    return res.json({ success: true, data: pessoa, message: 'Pessoa física cadastrada com sucesso!' });
  } catch (err) {
    console.error('[Registros] Erro ao cadastrar pessoa física:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function atualizarPessoa(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo de Registros' });
    }

    const { cdPessoaFisica } = req.params;
    const nmUsuario = usuario.nome || usuario.usuario || usuario.nm_usuario || 'conecta';
    const pessoa = await registroService.atualizarPessoa(cdPessoaFisica, req.body, nmUsuario);
    return res.json({ success: true, data: pessoa, message: 'Dados cadastrais atualizados com sucesso.' });
  } catch (err) {
    console.error('[Registros] Erro ao atualizar pessoa:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function salvarRegistro(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros', 'lancar_demanda_espontanea')) {
      return res.status(403).json({ success: false, message: 'Sem permissão para lançar registro de demanda espontânea' });
    }

    const resultado = await registroService.salvarRegistro(req.body, usuario.nm_usuario);
    return res.json({ success: true, data: resultado, message: 'Registro gravado com sucesso!' });
  } catch (err) {
    console.error('[Registros] Erro ao salvar registro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarHistorico(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'registros', 'visualizar_historico_registros') && !validarModuloPermissao(usuario, 'registros')) {
      return res.status(403).json({ success: false, message: 'Sem permissão para visualizar histórico de registros' });
    }

    const { cdPessoaFisica } = req.query;
    const historico = await registroService.listarHistorico(cdPessoaFisica);
    return res.json({ success: true, data: historico });
  } catch (err) {
    console.error('[Registros] Erro ao listar histórico:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listarTipos,
  buscarPessoas,
  obterPessoa,
  cadastrarPessoa,
  atualizarPessoa,
  salvarRegistro,
  listarHistorico
};
