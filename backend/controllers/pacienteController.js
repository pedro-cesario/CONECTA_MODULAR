const pacienteService = require('../services/pacienteService');
const { validarPerfil, validarModuloPermissao, getPerfilAtivo } = require('../utils/acesso');
const configCache = require('../config/configCache');

async function listarPacientes(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'passagem') && !validarModuloPermissao(usuario, 'dashboard')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Passagem de Plantão ou Dashboard' });
    }
    const { setores } = req.body;
    const perfilAtivo = getPerfilAtivo(usuario);
    // Only enforce sector restrictions if they are using passagem and have restrictions
    const permitidosPassagem = configCache.getSetoresPermitidos(perfilAtivo, 'passagem');
    const hasPassagemRestrictions = permitidosPassagem.length > 0;
    
    let setorNegado = undefined;
    if (hasPassagemRestrictions && !validarModuloPermissao(usuario, 'dashboard')) {
       setorNegado = (setores || []).find(setor => !configCache.perfilPodeVisualizarSetor(perfilAtivo, setor, 'passagem'));
    }
    if (setorNegado !== undefined) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
    }
    const pacientes = await pacienteService.listarPacientes(setores);
    return res.json({ success: true, data: pacientes });
  } catch (err) {
    console.error('[Pacientes] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarPacientesSetor(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    if (!validarPerfil(usuario, 'enfermagem')) {
      return res.status(403).json({ success: false, message: 'Módulo de livro disponível apenas para Enfermagem' });
    }

    const cdSetor = parseInt(req.params.cd_setor, 10);
    if (!cdSetor) {
      return res.status(400).json({ success: false, message: 'Setor inválido' });
    }

    const pacientes = await pacienteService.listarPacientesSetor(cdSetor);
    return res.json({ success: true, data: pacientes });
  } catch (err) {
    console.error('[Pacientes Setor] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarPacientesDashboard(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    if (!validarModuloPermissao(usuario, 'dashboard')) {
      return res.status(403).json({ success: false, message: 'Dashboard disponível apenas para os perfis com este módulo habilitado' });
    }

    const cdSetor = parseInt(req.params.cd_setor, 10);
    if (!cdSetor) {
      return res.status(400).json({ success: false, message: 'Setor inválido' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    if (!configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'dashboard')) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o dashboard' });
    }

    const pacientes = await pacienteService.listarPacientesComClassificacao(cdSetor);
    return res.json({ success: true, data: pacientes });
  } catch (err) {
    console.error('[Dashboard Pacientes] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

module.exports = { listarPacientes, listarPacientesSetor, listarPacientesDashboard };
