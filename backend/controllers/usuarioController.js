const usuarioService = require('../services/usuarioService');
const { validarPerfil, validarModuloPermissao } = require('../utils/acesso');

async function listarTecnicos(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    if (!validarPerfil(usuario, 'enfermagem')) {
      return res.status(403).json({ success: false, message: 'Módulo de livro disponível apenas para Enfermagem' });
    }

    const tecnicos = await usuarioService.listarTecnicos();
    return res.json({ success: true, data: tecnicos });
  } catch (err) {
    console.error('[Técnicos] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarEnfermeiros(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    if (!validarPerfil(usuario, 'enfermagem')) {
      return res.status(403).json({ success: false, message: 'Módulo de livro disponível apenas para Enfermagem' });
    }

    const enfermeiros = await usuarioService.listarEnfermeiros();
    return res.json({ success: true, data: enfermeiros });
  } catch (err) {
    console.error('[Enfermeiros] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarProfissionaisSetor4(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    if (!validarModuloPermissao(usuario, 'escala')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });
    }

    const dataReferencia = req.query.data_referencia || null;
    if (dataReferencia && !/^\d{4}-\d{2}-\d{2}$/.test(String(dataReferencia))) {
      return res.status(400).json({ success: false, message: 'Data de referência inválida' });
    }
    const profissionais = await usuarioService.listarProfissionaisSetor4(dataReferencia);
    return res.json({ success: true, data: profissionais });
  } catch (err) {
    console.error('[Profissionais Setor 4] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

module.exports = { listarTecnicos, listarEnfermeiros, listarProfissionaisSetor4 };
