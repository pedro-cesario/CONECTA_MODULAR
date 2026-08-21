const auditoriaService = require('../services/auditoriaService');
const exportService = require('../services/auditoriaExportService');
const { validarModuloPermissao } = require('../utils/acesso');

function temPermissao(req, permissao) {
  return validarModuloPermissao(req.session?.usuario, 'auditorias', permissao);
}
function negar(res) { return res.status(403).json({ success: false, message: 'Sem permissão para acessar Auditorias.' }); }

async function listarOpcoes(req, res) {
  try { if (!temPermissao(req, 'lancar_higiene_maos')) return negar(res); return res.json({ success: true, data: await auditoriaService.listarOpcoes() }); }
  catch (err) { console.error('[Auditorias] opções:', err.message); return res.status(500).json({ success: false, message: 'Erro ao carregar opções da auditoria.' }); }
}
async function salvarHigieneMaos(req, res) {
  try {
    if (!temPermissao(req, 'lancar_higiene_maos')) return negar(res);
    const data = await auditoriaService.salvarHigieneMaos(req.body, req.session.usuario.nm_usuario);
    return res.status(201).json({ success: true, data, message: 'Auditoria salva com sucesso.' });
  } catch (err) { console.error('[Auditorias] salvar:', err.message); return res.status(400).json({ success: false, message: err.message || 'Erro ao salvar auditoria.' }); }
}
async function listarHistorico(req, res) {
  try { if (!temPermissao(req, 'visualizar_historico_higiene_maos')) return negar(res); return res.json({ success: true, data: await auditoriaService.listarHistorico() }); }
  catch (err) { console.error('[Auditorias] histórico:', err.message); return res.status(500).json({ success: false, message: 'Erro ao carregar histórico.' }); }
}
async function listarHistoricoConsolidado(req, res) {
  try { if (!temPermissao(req, 'visualizar_historico_higiene_maos')) return negar(res); return res.json({ success: true, data: await auditoriaService.listarHistoricoConsolidado() }); }
  catch (err) { console.error('[Auditorias] histórico consolidado:', err.message); return res.status(500).json({ success: false, message: 'Erro ao carregar histórico consolidado.' }); }
}
async function obterAuditoria(req, res) {
  try {
    if (!temPermissao(req, 'visualizar_historico_higiene_maos')) return negar(res);
    const auditoria = await auditoriaService.obterPorId(Number(req.params.id));
    if (!auditoria) return res.status(404).json({ success: false, message: 'Auditoria não encontrada.' });
    return res.json({ success: true, data: auditoriaService.paraRelatorio(auditoria) });
  } catch (err) { return res.status(500).json({ success: false, message: 'Erro ao carregar auditoria.' }); }
}
async function baixarXlsx(req, res) {
  try {
    if (!temPermissao(req, 'exportar_higiene_maos')) return negar(res);
    const auditoria = auditoriaService.paraRelatorio(await auditoriaService.obterPorId(Number(req.params.id)));
    if (!auditoria) return res.status(404).json({ success: false, message: 'Auditoria não encontrada.' });
    const arquivo = await exportService.gerarXlsx(auditoria);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="auditoria-higiene-maos-${auditoria.NR_SEQUENCIA}.xlsx"`);
    return res.send(Buffer.from(arquivo));
  } catch (err) { console.error('[Auditorias] xlsx:', err.message); return res.status(500).json({ success: false, message: 'Erro ao gerar XLSX.' }); }
}
async function baixarPdf(req, res) {
  try {
    if (!temPermissao(req, 'exportar_higiene_maos')) return negar(res);
    const auditoria = auditoriaService.paraRelatorio(await auditoriaService.obterPorId(Number(req.params.id)));
    if (!auditoria) return res.status(404).json({ success: false, message: 'Auditoria não encontrada.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="auditoria-higiene-maos-${auditoria.NR_SEQUENCIA}.pdf"`);
    exportService.gerarPdf(auditoria, res);
  } catch (err) { console.error('[Auditorias] pdf:', err.message); if (!res.headersSent) return res.status(500).json({ success: false, message: 'Erro ao gerar PDF.' }); }
}

// ─── Auditoria de Processos ───────────────────────────────────────────────

async function listarOpcoesProcessos(req, res) {
  try { if (!temPermissao(req, 'lancar_auditoria_processos')) return negar(res); return res.json({ success: true, data: await auditoriaService.listarOpcoes() }); }
  catch (err) { console.error('[Auditorias] opções processos:', err.message); return res.status(500).json({ success: false, message: 'Erro ao carregar opções.' }); }
}
async function salvarAuditoriaProcessos(req, res) {
  try {
    if (!temPermissao(req, 'lancar_auditoria_processos')) return negar(res);
    const data = await auditoriaService.salvarAuditoriaProcessos(req.body, req.session.usuario.nm_usuario);
    return res.status(201).json({ success: true, data, message: 'Auditoria de Processos salva com sucesso.' });
  } catch (err) { console.error('[Auditorias] salvar processos:', err.message); return res.status(400).json({ success: false, message: err.message || 'Erro ao salvar auditoria.' }); }
}
async function listarHistoricoProcessos(req, res) {
  try { if (!temPermissao(req, 'visualizar_historico_auditoria_processos')) return negar(res); return res.json({ success: true, data: await auditoriaService.listarHistoricoProcessos() }); }
  catch (err) { console.error('[Auditorias] histórico processos:', err.message); return res.status(500).json({ success: false, message: 'Erro ao carregar histórico.' }); }
}
async function listarHistoricoProcessosConsolidado(req, res) {
  try { if (!temPermissao(req, 'visualizar_historico_auditoria_processos')) return negar(res); return res.json({ success: true, data: await auditoriaService.listarHistoricoProcessosConsolidado() }); }
  catch (err) { console.error('[Auditorias] histórico processos consolidado:', err.message); return res.status(500).json({ success: false, message: 'Erro ao carregar histórico consolidado.' }); }
}
async function obterProcessos(req, res) {
  try {
    if (!temPermissao(req, 'visualizar_historico_auditoria_processos')) return negar(res);
    const auditoria = await auditoriaService.obterProcessosPorId(Number(req.params.id));
    if (!auditoria) return res.status(404).json({ success: false, message: 'Auditoria não encontrada.' });
    return res.json({ success: true, data: auditoriaService.paraRelatorioProcessos(auditoria) });
  } catch (err) { return res.status(500).json({ success: false, message: 'Erro ao carregar auditoria.' }); }
}
async function baixarXlsxProcessos(req, res) {
  try {
    if (!temPermissao(req, 'exportar_auditoria_processos')) return negar(res);
    const auditoria = auditoriaService.paraRelatorioProcessos(await auditoriaService.obterProcessosPorId(Number(req.params.id)));
    if (!auditoria) return res.status(404).json({ success: false, message: 'Auditoria não encontrada.' });
    const arquivo = await exportService.gerarXlsxProcessos(auditoria);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="auditoria-processos-${auditoria.NR_SEQUENCIA}.xlsx"`);
    return res.send(Buffer.from(arquivo));
  } catch (err) { console.error('[Auditorias] xlsx processos:', err.message); return res.status(500).json({ success: false, message: 'Erro ao gerar XLSX.' }); }
}
async function baixarPdfProcessos(req, res) {
  try {
    if (!temPermissao(req, 'exportar_auditoria_processos')) return negar(res);
    const auditoria = auditoriaService.paraRelatorioProcessos(await auditoriaService.obterProcessosPorId(Number(req.params.id)));
    if (!auditoria) return res.status(404).json({ success: false, message: 'Auditoria não encontrada.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="auditoria-processos-${auditoria.NR_SEQUENCIA}.pdf"`);
    exportService.gerarPdfProcessos(auditoria, res);
  } catch (err) { console.error('[Auditorias] pdf processos:', err.message); if (!res.headersSent) return res.status(500).json({ success: false, message: 'Erro ao gerar PDF.' }); }
}

async function listarPacientesOntem(req, res) {
  try {
    if (!temPermissao(req, 'lancar_auditoria_processos')) return negar(res);
    const pacientes = await auditoriaService.listarPacientesOntem();
    return res.json({ success: true, data: pacientes });
  } catch (err) { console.error('[Auditorias] pacientes ontem:', err.message); return res.status(500).json({ success: false, message: 'Erro ao listar pacientes.' }); }
}
async function pacienteAleatorio(req, res) {
  try {
    if (!temPermissao(req, 'lancar_auditoria_processos')) return negar(res);
    const paciente = await auditoriaService.pacienteAleatorio();
    if (!paciente) return res.status(404).json({ success: false, message: 'Nenhum paciente internado encontrado.' });
    return res.json({ success: true, data: paciente });
  } catch (err) { console.error('[Auditorias] paciente aleatório:', err.message); return res.status(500).json({ success: false, message: 'Erro ao buscar paciente.' }); }
}

module.exports = { listarOpcoes, salvarHigieneMaos, listarHistorico, listarHistoricoConsolidado, obterAuditoria, baixarXlsx, baixarPdf, listarOpcoesProcessos, salvarAuditoriaProcessos, listarHistoricoProcessos, listarHistoricoProcessosConsolidado, obterProcessos, baixarXlsxProcessos, baixarPdfProcessos, listarPacientesOntem, pacienteAleatorio };
