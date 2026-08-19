const configCache = require('../config/configCache');
const ldapService = require('../services/ldapService');
const perfilRepository = require('../repositories/perfilRepository');
const setorService = require('../services/setorService');

async function listarPerfis(req, res) {
  try {
    const perfis = configCache.getAllPerfisWithModulos();
    res.json({ success: true, data: perfis });
  } catch (err) {
    console.error('[Admin] Erro ao listar perfis:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarPerfil(req, res) {
  try {
    const { id, nome, setorId, grupoLdap, sessionFlag, setorReferenciaFixo, dsPerfilTasy } = req.body;

    if (!id || !nome || !grupoLdap) {
      return res.status(400).json({ success: false, message: 'id, nome e grupoLdap são obrigatórios' });
    }

    const perfil = await configCache.saveProfile({
      id,
      nome,
      setorId: setorId || 0,
      grupoLdap,
      sessionFlag: sessionFlag || `acesso_${id}`,
      setorReferenciaFixo: Boolean(setorReferenciaFixo),
      dsPerfilTasy: dsPerfilTasy || grupoLdap
    });

    res.json({ success: true, data: perfil });
  } catch (err) {
    console.error('[Admin] Erro ao salvar perfil:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarPerfil(req, res) {
  try {
    const { id } = req.params;
    const deleted = await configCache.deleteProfile(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
    }

    res.json({ success: true, message: 'Perfil removido com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao deletar perfil:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarModulos(req, res) {
  try {
    const modulos = configCache.getAllModulosWithPermissoes();
    res.json({ success: true, data: modulos });
  } catch (err) {
    console.error('[Admin] Erro ao listar módulos:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarModulo(req, res) {
  try {
    const { id, nome, descricao, icon, setorId } = req.body;

    if (!id || !nome) {
      return res.status(400).json({ success: false, message: 'id e nome são obrigatórios' });
    }

    const modulo = await configCache.saveModule({ id, nome, descricao, icon, setorId });
    res.json({ success: true, data: modulo });
  } catch (err) {
    console.error('[Admin] Erro ao salvar módulo:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarModulo(req, res) {
  try {
    const { id } = req.params;
    const deleted = await configCache.deleteModule(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Módulo não encontrado' });
    }

    res.json({ success: true, message: 'Módulo removido com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao deletar módulo:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarPermissoesModulo(req, res) {
  try {
    const { perfilId, modulos, permissoes, setoresPorModulo = {} } = req.body;

    if (!perfilId || !Array.isArray(modulos)) {
      return res.status(400).json({ success: false, message: 'perfilId e modulos (array) são obrigatórios' });
    }

    const perfil = configCache.getPerfilById(perfilId);
    if (!perfil) {
      return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
    }

    if (modulos.includes('passagem')) {
      const setoresPassagem = (setoresPorModulo.passagem || []).map(Number).filter(Number.isInteger);
      if (setoresPassagem.length === 0) {
        return res.status(400).json({ success: false, message: 'Selecione ao menos um setor para a Passagem de Plantão' });
      }
    }

    await configCache.setProfileAccess(perfilId, modulos, permissoes || {}, setoresPorModulo);
    res.json({ success: true, message: 'Permissões atualizadas com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao salvar permissões:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarSetoresPassagem(req, res) {
  try {
    const setores = await setorService.listarSetoresInternacao();
    const seen = new Set();
    const uniqueSetores = [];
    for (const setor of setores) {
      const id = Number(setor.cd_setor_atendimento);
      if (!Number.isInteger(id) || seen.has(id)) continue;
      seen.add(id);
      uniqueSetores.push({
        id: id,
        nome: setor.ds_setor_atendimento
      });
    }
    return res.json({
      success: true,
      data: uniqueSetores
    });
  } catch (err) {
    console.error('[Admin] Erro ao listar setores da passagem:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar setores da passagem' });
  }
}

async function obterCacheStatus(req, res) {
  const metadata = configCache.getCacheMetadata();
  res.json({ success: true, data: metadata });
}

async function recarregarCache(req, res) {
  try {
    await configCache.load();
    const metadata = configCache.getCacheMetadata();
    res.json({ success: true, data: metadata, message: 'Cache recarregado com sucesso' });
  } catch (err) {
    console.error('[Admin] Erro ao recarregar cache:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarGruposLdap(req, res) {
  try {
    const grupos = await ldapService.getAllGroups();
    res.json({ success: true, data: grupos });
  } catch (err) {
    console.error('[Admin] Erro ao listar grupos LDAP:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarPerfisTasy(req, res) {
  try {
    const perfis = await perfilRepository.findAllTasyProfiles();
    res.json({ success: true, data: perfis });
  } catch (err) {
    console.error('[Admin] Erro ao listar perfis TASY:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarFilasEsperaTasy(req, res) {
  try {
    const db = require('../database');
    const conn = await db.getConnection();
    try {
      const result = await conn.execute(
        `SELECT nr_sequencia, ds_fila FROM FILA_ESPERA_SENHA ORDER BY ds_fila`,
        [],
        { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
      );
      res.json({ success: true, data: result.rows });
    } finally {
      if (conn) await conn.close();
    }
  } catch (err) {
    console.error('[Admin] Erro ao listar filas de espera TASY:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar filas do TASY.' });
  }
}

async function obterConfigDashboardPA(req, res) {
  try {
    const config = configCache.getDashboardPAConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('[Admin] Erro ao obter config PA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarConfigDashboardPA(req, res) {
  try {
    const { nr_sequencia_fila, ds_fila } = req.body;
    if (!nr_sequencia_fila) {
      return res.status(400).json({ success: false, message: 'Fila é obrigatória.' });
    }
    const result = await configCache.saveDashboardPAConfig(nr_sequencia_fila, ds_fila || '');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao salvar config PA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function obterConfigSistema(req, res) {
  try {
    const config = configCache.getSystemConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('[Admin] Erro ao obter config sistema:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function salvarConfigSistema(req, res) {
  try {
    const { app_version, show_test_bar, ect_cd_agenda, ect_cd_procedimento } = req.body;
    const configs = { app_version, show_test_bar, ect_cd_agenda, ect_cd_procedimento };
    const result = await configCache.saveSystemConfig(configs);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Admin] Erro ao salvar config sistema:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listarPerfis,
  salvarPerfil,
  deletarPerfil,
  listarModulos,
  salvarModulo,
  deletarModulo,
  salvarPermissoesModulo,
  listarSetoresPassagem,
  obterCacheStatus,
  recarregarCache,
  listarGruposLdap,
  listarPerfisTasy,
  listarFilasEsperaTasy,
  obterConfigDashboardPA,
  salvarConfigDashboardPA,
  obterConfigSistema,
  salvarConfigSistema,
  listarAgendasEct,
  listarProcedimentosEct
};

async function listarAgendasEct(req, res) {
  try {
    const pacienteRepository = require('../repositories/pacienteRepository');
    const filas = await pacienteRepository.obterAgendasAtivas();
    res.json({ success: true, data: filas });
  } catch (err) {
    console.error('[Admin] Erro ao listar agendas ECT:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar agendas do TASY.' });
  }
}

async function listarProcedimentosEct(req, res) {
  try {
    const pacienteRepository = require('../repositories/pacienteRepository');
    const procs = await pacienteRepository.obterProcedimentosAtivos();
    res.json({ success: true, data: procs });
  } catch (err) {
    console.error('[Admin] Erro ao listar procedimentos ECT:', err);
    res.status(500).json({ success: false, message: 'Erro ao buscar procedimentos do TASY.' });
  }
}

