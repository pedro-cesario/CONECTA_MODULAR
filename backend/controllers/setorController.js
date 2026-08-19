const { getPerfisFromGroups, getSetoresByPerfis } = require('../config/especialidades');
const { validarPerfil, validarModuloPermissao, getPerfilAtivo } = require('../utils/acesso');
const setorService = require('../services/setorService');
const configCache = require('../config/configCache');

async function listarSetores(req, res) {
  try {
    const usuario = req.session?.usuario;
    
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const perfis = getPerfisFromGroups(usuario.grupos_ad || []);
    const setores = getSetoresByPerfis(perfis);

    return res.json({ success: true, data: setores });
  } catch (err) {
    console.error('[Setores] Erro:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listarSetoresInternacao(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'passagem') && !validarModuloPermissao(usuario, 'dashboard')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Passagem de Plantão ou Dashboard' });
    }
    const perfilAtivo = getPerfilAtivo(usuario);
    const moduloContext = req.query.modulo === 'dashboard' ? 'dashboard' : 'passagem';
    const permitidos = configCache.getSetoresPermitidos(perfilAtivo, moduloContext);
    
    const adminGranted = perfilAtivo === 'admin' || configCache.perfilTemPermissao(perfilAtivo, moduloContext, 'admin');

    const setores = await setorService.listarSetoresInternacao();
    let filtrados = setores;
    
    if (!adminGranted && permitidos.length > 0) {
      filtrados = setores.filter(setor => permitidos.includes(Number(setor.cd_setor_atendimento)));
    }
    
    return res.json({ success: true, data: filtrados });
  } catch (err) {
    console.error('[Setores Internação] Erro:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listarSetoresLivro(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    if (!validarModuloPermissao(usuario, 'livro')) {
      return res.status(403).json({ success: false, message: 'Módulo de livro não autorizado para este perfil' });
    }

    const dataPlantao = req.query.data || null;
    const turno = req.query.turno || null;
    let setores = await setorService.listarSetoresLivro(usuario, dataPlantao, turno);

    if (perfilAtivo) {
      const setoresLivro = configCache.getSetoresPermitidos(perfilAtivo, 'livro');
      const adminGranted = perfilAtivo === 'admin' || configCache.perfilTemPermissao(perfilAtivo, 'livro', 'admin');
      
      if (!adminGranted && setoresLivro.length > 0) {
         setores = setores.filter(setor => setoresLivro.includes(Number(setor.cd_setor_atendimento)));
      }
    }

    return res.json({ success: true, data: setores });
  } catch (err) {
    console.error('[Setores Livro] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

module.exports = { listarSetores, listarSetoresInternacao, listarSetoresLivro };
