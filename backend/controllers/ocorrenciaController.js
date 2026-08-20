const ocorrenciaService = require('../services/ocorrenciaService');
const { validarPerfil, validarModuloPermissao, getPerfilAtivo } = require('../utils/acesso');
const configCache = require('../config/configCache');
const redisClient = require('../config/redisClient');

const LOTE_PREFIX = 'passagem_lote:';

async function salvarLoteDraft(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    
    if (!validarModuloPermissao(usuario, 'passagem', 'lancar_passagem_lote')) {
      return res.status(403).json({ success: false, message: 'Sem permissão para passagem em lote' });
    }

    const key = LOTE_PREFIX + usuario.nm_usuario;
    const { setoresSelecionados = [], intercorrencias = {}, setorIntercorrencias = {} } = req.body;

    let draft = { setoresSelecionados: [], intercorrencias: {}, setorIntercorrencias: {} };
    
    const existing = await redisClient.get(key);
    if (existing) {
      try { draft = JSON.parse(existing); } catch(e){}
    }

    // Merge
    const newSetores = new Set([...draft.setoresSelecionados, ...setoresSelecionados]);
    draft.setoresSelecionados = Array.from(newSetores);
    draft.intercorrencias = { ...draft.intercorrencias, ...intercorrencias };
    draft.setorIntercorrencias = { ...draft.setorIntercorrencias, ...setorIntercorrencias };

    // Expira em 12 horas (43200 segundos)
    await redisClient.setEx(key, 43200, JSON.stringify(draft));
    
    return res.json({ success: true, message: 'Setor adicionado ao lote', data: draft });
  } catch(err) {
    console.error('[Lote Draft] Erro salvar:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function obterLoteDraft(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    
    const key = LOTE_PREFIX + usuario.nm_usuario;
    const existing = await redisClient.get(key);
    if (existing) {
      return res.json({ success: true, data: JSON.parse(existing) });
    }
    return res.json({ success: true, data: { setoresSelecionados: [], intercorrencias: {}, setorIntercorrencias: {} } });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function limparLoteDraft(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    
    const key = LOTE_PREFIX + usuario.nm_usuario;
    await redisClient.del(key);
    return res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvar(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada' });
    }

    if (!validarModuloPermissao(usuario, 'passagem', 'lancar_nova_passagem')) {
      return res.status(403).json({ success: false, message: 'Sem permissão para lançar nova passagem' });
    }

    const perfilAtivo = getPerfilAtivo(usuario);
    const perfil = configCache.getPerfilById(perfilAtivo);
    const setores = Array.isArray(req.body?.setoresSelecionados) ? req.body.setoresSelecionados : [];
    const setorNegado = setores.find(setor => !configCache.perfilPodeVisualizarSetor(perfilAtivo, setor, 'passagem'));
    if (setorNegado !== undefined) {
      return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
    }

    const isLote = validarModuloPermissao(usuario, 'passagem', 'lancar_passagem_lote');
    let finalPayload = { ...req.body };

    if (isLote) {
       const key = LOTE_PREFIX + usuario.nm_usuario;
       const existing = await redisClient.get(key);
       if (existing) {
         let draft = {};
         try { draft = JSON.parse(existing); } catch(e){}
         const newSetores = new Set([...(draft.setoresSelecionados || []), ...(req.body.setoresSelecionados || [])]);
         finalPayload.setoresSelecionados = Array.from(newSetores);
         finalPayload.intercorrencias = { ...(draft.intercorrencias || {}), ...(req.body.intercorrencias || {}) };
         finalPayload.setorIntercorrencias = { ...(draft.setorIntercorrencias || {}), ...(req.body.setorIntercorrencias || {}) };
         
         // Limpar o lote após salvar
         await redisClient.del(key);
       }
    }

    const resultado = await ocorrenciaService.salvarPassagem({ ...finalPayload, cd_modulo: perfil?.setorId }, usuario);
    res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Ocorrência] Erro:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarPassagensAnteriores(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'passagem')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito à Passagem de Plantão' });
    }
    const perfilAtivo = getPerfilAtivo(usuario);
    const cdPerfil = Number(usuario.cd_perfis?.[perfilAtivo]);
    if (!Number.isInteger(cdPerfil)) {
      return res.status(400).json({ success: false, message: 'Perfil TASY não encontrado' });
    }
    const setoresPermitidos = configCache.getSetoresPermitidos(perfilAtivo, 'passagem');
    const { setor, dtInicio, dtFim } = req.query || {};
    const resultado = await ocorrenciaService.listarPassagensAnteriores(cdPerfil, setoresPermitidos, { setor, dtInicio, dtFim });
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Passagens anteriores] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function salvarLivroAdministrativo(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada' });
    }
    if (!validarModuloPermissao(usuario, 'livro')) {
      return res.status(403).json({ success: false, message: 'Módulo de livro disponível apenas para Enfermagem' });
    }

    const resultado = await ocorrenciaService.salvarLivroAdministrativo(req.body, usuario);
    res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Livro Administrativo] Erro ao salvar:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function obterLivroAdministrativo(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada' });
    }
    if (!validarModuloPermissao(usuario, 'livro')) {
      return res.status(403).json({ success: false, message: 'Módulo de livro disponível apenas para Enfermagem' });
    }

    const data = req.query.data || null;
    const resultado = await ocorrenciaService.obterLivroAdministrativo(data);
    res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Livro Administrativo] Erro ao consultar:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function salvarEscalaPsicologia(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'escala', 'editar_publicar_escala')) {
      return res.status(403).json({ success: false, message: 'Sem permissão para editar/publicar escala' });
    }
    const resultado = await ocorrenciaService.salvarEscalaPsicologia(req.body, usuario);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Gestão de Escalas] Erro ao publicar:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function salvarEscalaTecnica(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada' });
    }
    const temEscalaEdit = validarModuloPermissao(usuario, 'escala', 'editar_publicar_escala');
    const temLivro = validarModuloPermissao(usuario, 'livro');
    if (!temEscalaEdit && !temLivro) {
      return res.status(403).json({ success: false, message: 'Sem permissão para editar/publicar escala' });
    }

    const resultado = await ocorrenciaService.salvarEscalaTecnica(req.body, usuario);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Escala Técnica] Erro ao salvar:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function obterEscalaTecnica(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada' });
    }
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });
    }

    const data = req.query.data || null;
    const cdSetor = req.query.cd_setor || null;
    const turno = req.query.turno || null;
    const resultado = await ocorrenciaService.obterEscalaTecnica(data, cdSetor, turno);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Escala Técnica] Erro ao consultar:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarTodasEscalasLiberadas(req, res) {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sessão expirada' });
    }
    if (!validarModuloPermissao(usuario, 'escala') && !validarModuloPermissao(usuario, 'livro')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });
    }

    const data = req.query.data || null;
    const turno = req.query.turno || null;
    let resultado = await ocorrenciaService.listarTodasEscalasLiberadas(data, turno);

    const { getPerfilAtivo } = require('../utils/acesso');
    const perfilAtivo = getPerfilAtivo(usuario);

    if (perfilAtivo) {
      const configCache = require('../config/configCache');
      const setoresLivro = configCache.getSetoresPermitidos(perfilAtivo, 'livro');
      
      const adminGranted = configCache.perfilTemPermissao(perfilAtivo, 'livro', 'admin');
      
      if (!adminGranted && setoresLivro.length > 0) {
         resultado = resultado.filter(escala => setoresLivro.includes(Number(escala.cd_setor_atendimento)));
      } else if (!adminGranted && setoresLivro.length === 0) {
         resultado = [];
      }
    }

    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Escala Técnica] Erro ao listar todas:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarEscalasPsicologiaLiberadas(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    if (!validarModuloPermissao(usuario, 'escala')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito ao módulo Escala' });
    }
    const mes = req.query.mes || null;
    if (mes && !/^\d{4}-\d{2}$/.test(String(mes))) {
      return res.status(400).json({ success: false, message: 'Mês inválido' });
    }
    const resultado = await ocorrenciaService.listarEscalasPsicologiaLiberadas(mes);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Escala Psicologia] Erro ao listar liberadas:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarSetoresHistorico(req, res) {
  try {
    const usuario = req.session?.usuario;
    if (!usuario) return res.status(401).json({ success: false, message: 'Sessão expirada' });
    const perfilAtivo = getPerfilAtivo(usuario);
    const cdPerfil = Number(usuario.cd_perfis?.[perfilAtivo]);
    if (!Number.isInteger(cdPerfil)) {
      return res.status(400).json({ success: false, message: 'Perfil TASY não encontrado' });
    }
    const setoresPermitidos = configCache.getSetoresPermitidos(perfilAtivo, 'passagem');
    const resultado = await ocorrenciaService.listarSetoresHistorico(cdPerfil);
    
    // Filtra para garantir que o usuário só veja os setores do histórico que ele ainda tem permissão
    const setoresFinais = resultado.filter(s => configCache.perfilPodeVisualizarSetor(perfilAtivo, s.cd_setor_atendimento, 'passagem'));
    
    return res.json({ success: true, data: setoresFinais });
  } catch (err) {
    console.error('[Setores Historico] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

module.exports = {
  salvar,
  salvarLoteDraft,
  obterLoteDraft,
  limparLoteDraft,
  listarPassagensAnteriores,
  listarSetoresHistorico,
  salvarLivroAdministrativo,
  obterLivroAdministrativo,
  salvarEscalaPsicologia,
  salvarEscalaTecnica,
  obterEscalaTecnica,
  listarTodasEscalasLiberadas,
  listarEscalasPsicologiaLiberadas
};
