const escalaAtivaService = require('./escalaAtivaService');
const { validarPerfil, validarModuloPermissao, getPerfilAtivo } = require('../../core/utils/acesso');
const configCache = require('../../core/config/configCache');

async function loadEscalaAtiva(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });

    const cdSetor = Number(req.query.cd_setor);
    const dtPlantao = req.query.dt_plantao;
    const turno = req.query.turno || 'M';

    if (!Number.isInteger(cdSetor) || !dtPlantao) {
      return res.status(400).json({ success: false, message: 'Parâmetros cd_setor e dt_plantao são obrigatórios' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    const podeLivro = validarModuloPermissao(usuario, 'livro') && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'livro');
    const podeEscala = validarModuloPermissao(usuario, 'escala') && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'escala');
    if (!podeLivro && !podeEscala) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
    }

    const data = await escalaAtivaService.obterEscalaAtiva(cdSetor, dtPlantao, turno);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[EscalaAtiva] load:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao carregar escala ativa' });
  }
}

async function loadEscalasAtivasPorPeriodo(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });

    const cdSetor = Number(req.query.cd_setor);
    const dataInicio = req.query.data_inicio;
    const dataFim = req.query.data_fim;
    if (!Number.isInteger(cdSetor) || !dataInicio || !dataFim) {
      return res.status(400).json({ success: false, message: 'Parâmetros cd_setor, data_inicio e data_fim são obrigatórios' });
    }
    if (cdSetor !== 4) return res.status(400).json({ success: false, message: 'Consulta em lote disponível apenas para Psicologia' });

    const data = await escalaAtivaService.obterEscalasAtivasPorPeriodo(cdSetor, dataInicio, dataFim);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[EscalaAtiva] período:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao carregar escalas do período' });
  }
}

async function saveEscalaAtiva(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    
    const temEscalaEdit = validarModuloPermissao(usuario, 'escala', 'editar_publicar_escala');
    const temLivro = validarModuloPermissao(usuario, 'livro');
    if (!temEscalaEdit && !temLivro) {
      return res.status(403).json({ success: false, message: 'Sem permissão para editar/publicar escala' });
    }

    const { cd_setor_atendimento, data_plantao, turno } = req.body;
    const cdSetor = Number(cd_setor_atendimento);
    if (!Number.isInteger(cdSetor) || !data_plantao || !turno) {
      return res.status(400).json({ success: false, message: 'Dados incompletos' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    const podeLivro = temLivro && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'livro');
    const podeEscala = temEscalaEdit && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'escala');
    if (!podeLivro && !podeEscala) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
    }

    const result = await escalaAtivaService.salvarEscalaAtiva(req.body, usuario.nm_usuario);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[EscalaAtiva] save:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Erro ao salvar escala ativa' });
  }
}

async function listarVersoes(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });

    const cdSetor = Number(req.query.cd_setor);
    const dtPlantao = req.query.dt_plantao;
    const turno = req.query.turno || 'M';

    if (!Number.isInteger(cdSetor) || !dtPlantao) {
      return res.status(400).json({ success: false, message: 'Parâmetros obrigatórios' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    const podeLivro = validarModuloPermissao(usuario, 'livro') && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'livro');
    const podeEscala = validarModuloPermissao(usuario, 'escala') && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'escala');
    if (!podeLivro && !podeEscala) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
    }

    const versoes = await escalaAtivaService.listarVersoes(cdSetor, dtPlantao, turno);
    return res.json({ success: true, data: versoes });
  } catch (err) {
    console.error('[EscalaAtiva] versoes:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar versões' });
  }
}

async function loadVersaoEspecifica(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });

    const cdSetor = Number(req.query.cd_setor);
    const dtPlantao = req.query.dt_plantao;
    const turno = req.query.turno || 'M';
    const versao = Number(req.query.versao);

    if (!Number.isInteger(cdSetor) || !dtPlantao || !Number.isInteger(versao)) {
      return res.status(400).json({ success: false, message: 'Parâmetros obrigatórios' });
    }

    const data = await escalaAtivaService.obterVersao(cdSetor, dtPlantao, turno, versao);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[EscalaAtiva] versao:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao carregar versão' });
  }
}

async function loadDiff(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });

    const cdSetor = Number(req.query.cd_setor);
    const dtPlantao = req.query.dt_plantao;
    const turno = req.query.turno || 'M';
    const versao = Number(req.query.versao);

    if (!Number.isInteger(cdSetor) || !dtPlantao || !Number.isInteger(versao)) {
      return res.status(400).json({ success: false, message: 'Parâmetros obrigatórios' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    const podeLivro = validarModuloPermissao(usuario, 'livro') && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'livro');
    const podeEscala = validarModuloPermissao(usuario, 'escala') && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'escala');
    if (!podeLivro && !podeEscala) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
    }

    const diff = await escalaAtivaService.compararVersoes(cdSetor, dtPlantao, turno, versao);
    return res.json({ success: true, data: diff });
  } catch (err) {
    console.error('[EscalaAtiva] diff:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao comparar versões' });
  }
}

async function buscarPatioCirculanteGlobal(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Não autenticado' });
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito' });
    }

    const dtPlantao = req.query.dt_plantao;
    const turno = req.query.turno || 'M';

    if (!dtPlantao) {
      return res.status(400).json({ success: false, message: 'Parâmetro dt_plantao é obrigatório' });
    }

    let data = await escalaAtivaService.buscarPatioCirculanteGlobal(dtPlantao, turno);
    
    const { getPerfilAtivo } = require('../../core/utils/acesso');
    const perfilAtivo = getPerfilAtivo(usuario);
    if (perfilAtivo) {
      const configCache = require('../../core/config/configCache');
      const setoresPermitidos = new Set([
        ...(validarModuloPermissao(usuario, 'livro') ? configCache.getSetoresPermitidos(perfilAtivo, 'livro') : []),
        ...(validarModuloPermissao(usuario, 'escala') ? configCache.getSetoresPermitidos(perfilAtivo, 'escala') : [])
      ]);
      const adminGranted = configCache.perfilTemPermissao(perfilAtivo, 'livro', 'admin') || configCache.perfilTemPermissao(perfilAtivo, 'escala', 'admin');
      
      if (!adminGranted) {
        data.patio = data.patio.filter(p => setoresPermitidos.has(p.cd_setor_atendimento));
        data.circulante = data.circulante.filter(c => setoresPermitidos.has(c.cd_setor_atendimento));
      }
    }

    // Deduplicate by cd_pessoa_fisica after filtering
    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter(item => {
        if (seen.has(item.cd_pessoa_fisica)) return false;
        seen.add(item.cd_pessoa_fisica);
        return true;
      }).map(({ cd_setor_atendimento, ...rest }) => rest);
    };

    data.patio = dedup(data.patio);
    data.circulante = dedup(data.circulante);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[EscalaAtiva] patio-circulante-global:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao verificar pátio/circulante global' });
  }
}

module.exports = { loadEscalaAtiva, loadEscalasAtivasPorPeriodo, saveEscalaAtiva, listarVersoes, loadVersaoEspecifica, loadDiff, buscarPatioCirculanteGlobal };
