const { ValidationError } = require('../../core/errors/AppError');
const dashboardService = require('.//dashboardService');
const { perfilTemAcessoModulo } = require('../../core/config/modulos');

function validarAcessoDashboard(req, res) {
  const usuario = req.session?.usuario;
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Sessão expirada' });
    return false;
  }

  if (!perfilTemAcessoModulo(usuario.perfilAtivo, 'dashboard')) {
    res.status(403).json({
      success: false,
      message: 'Dashboard de pacientes disponível apenas para Enfermagem e Técnicos de Enfermagem'
    });
    return false;
  }

  return true;
}

function validarAcessoDashboardPA(req, res) {
  const usuario = req.session?.usuario;
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Sessão expirada' });
    return false;
  }

  if (!perfilTemAcessoModulo(usuario.perfilAtivo, 'dashboard_pa')) {
    res.status(403).json({
      success: false,
      message: 'Dashboard P.A. disponível apenas para Enfermagem'
    });
    return false;
  }

  return true;
}

async function listarSetores(req, res) {
  try {
    if (!validarAcessoDashboard(req, res)) return;

    const setores = await dashboardService.listarSetores();
    return res.json({ success: true, data: setores });
  } catch (err) {
    console.error('[Dashboard Setores] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarPacientes(req, res) {
  try {
    if (!validarAcessoDashboard(req, res)) return;

    const resultado = await dashboardService.listarPacientes(req.query.cd_setor);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Dashboard Pacientes] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function listarDashboardPA(req, res) {
  try {
    if (!validarAcessoDashboardPA(req, res)) return;

    const resultado = await dashboardService.listarDashboardPA();
    return res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('[Dashboard P.A.] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function obterDetalhesInternacao(req, res, next) {
  try {
    if (!validarAcessoDashboardPA(req, res)) return;

    const { nrAtendimento } = req.params;
    const nrStr = String(nrAtendimento || '');
    if (!/^\d+$/.test(nrStr)) {
      return next(new ValidationError('Número de atendimento inválido'));
    }
    const nrNum = Number(nrStr);
    if (!Number.isSafeInteger(nrNum) || nrNum <= 0) {
      return next(new ValidationError('Número de atendimento inválido ou fora dos limites'));
    }

    const resultado = await dashboardService.listarDetalhesInternacao(nrStr);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    next(err);
  }
}

async function executarAcaoInternacao(req, res) {
  try {
    if (!validarAcessoDashboardPA(req, res)) return;

    const { nr_atendimento, acao, motivo, cd_setor_desejado, cd_convenio } = req.body;
    if (!nr_atendimento || !acao) {
      return res.status(400).json({ success: false, message: 'nr_atendimento e acao são obrigatórios' });
    }

    const nmUsuario = req.session?.usuario?.nm_usuario || 'Sistema';
    const cdPessoaFisica = req.session?.usuario?.cd_pessoa_fisica;
    const result = await dashboardService.acaoInternacao(nr_atendimento, acao, nmUsuario, motivo, cdPessoaFisica, cd_setor_desejado, cd_convenio);
    return res.json({ 
      success: true, 
      message: acao === 'aceitar' ? 'Internação aceita' : 'Internação recusada',
      warnings: result && result.warnings ? result.warnings : undefined
    });
  } catch (err) {
    console.error('[Dashboard P.A. Ação] Erro:', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listarSetores,
  listarPacientes,
  listarDashboardPA,
  obterDetalhesInternacao,
  executarAcaoInternacao
};