const auditoriaRepository = require('../repositories/auditoriaRepository');

const OPORTUNIDADES = {
  ANTES_CONTATO_PACIENTE: 'Antes de contato com o paciente',
  ANTES_PROCEDIMENTO_ASSEPTICO: 'Antes de procedimento asséptico',
  APOS_FLUIDOS: 'Após contato com fluidos',
  APOS_CONTATO_PACIENTE: 'Após contato com o paciente',
  APOS_CONTATO_AMBIENTE: 'Após contato com o ambiente'
};
const RESULTADOS = { A: 'Álcool', S: 'Sabonete', P: 'Perdida' };

function normalizarPayload(payload = {}) {
  const oportunidades = Array.isArray(payload.oportunidades) ? payload.oportunidades : [];
  const dados = {
    dt_auditoria: String(payload.dt_auditoria || ''),
    cd_setor_atendimento: Number(payload.cd_setor_atendimento),
    cd_avaliador: Number(payload.cd_avaliador),
    ie_turno: String(payload.ie_turno || '').toUpperCase(),
    cd_profissional: Number(payload.cd_profissional),
    ds_observacao: String(payload.ds_observacao || '').trim(),
    oportunidades: oportunidades.map(item => ({
      ie_tipo_oportunidade: String(item?.ie_tipo_oportunidade || '').toUpperCase(),
      ie_resultado: String(item?.ie_resultado || '').toUpperCase()
    }))
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dt_auditoria)) throw new Error('Data da auditoria inválida.');
  if (!Number.isInteger(dados.cd_setor_atendimento)) throw new Error('Setor é obrigatório.');
  if (!Number.isInteger(dados.cd_avaliador)) throw new Error('Avaliador é obrigatório.');
  if (!Number.isInteger(dados.cd_profissional)) throw new Error('Profissional é obrigatório.');
  if (!['D', 'N'].includes(dados.ie_turno)) throw new Error('Turno inválido.');
  if (dados.ds_observacao.length > 4000) throw new Error('Observações devem ter no máximo 4000 caracteres.');
  if (dados.oportunidades.length !== auditoriaRepository.OPORTUNIDADES.length) throw new Error('Preencha todas as oportunidades.');

  const tipos = new Set(dados.oportunidades.map(item => item.ie_tipo_oportunidade));
  if (tipos.size !== auditoriaRepository.OPORTUNIDADES.length || auditoriaRepository.OPORTUNIDADES.some(tipo => !tipos.has(tipo))) {
    throw new Error('As oportunidades informadas são inválidas.');
  }
  if (dados.oportunidades.some(item => !['A', 'S', 'P'].includes(item.ie_resultado))) {
    throw new Error('Resultado de oportunidade inválido.');
  }
  return dados;
}

async function salvarHigieneMaos(payload, nmUsuario) {
  const dados = normalizarPayload(payload);
  return auditoriaRepository.salvarHigieneMaos(dados, nmUsuario);
}

function paraRelatorio(auditoria) {
  if (!auditoria) return null;
  return {
    ...auditoria,
    turno_label: auditoria.IE_TURNO === 'N' ? 'Noite' : 'Dia',
    oportunidades: (auditoria.oportunidades || []).map(item => ({
      ...item,
      oportunidade_label: OPORTUNIDADES[item.IE_TIPO_OPORTUNIDADE] || item.IE_TIPO_OPORTUNIDADE,
      resultado_label: RESULTADOS[item.IE_RESULTADO] || item.IE_RESULTADO,
      conforme: ['A', 'S'].includes(item.IE_RESULTADO)
    }))
  };
}

module.exports = { OPORTUNIDADES, RESULTADOS, normalizarPayload, salvarHigieneMaos, listarOpcoes: auditoriaRepository.listarOpcoes, listarHistorico: auditoriaRepository.listarHistorico, listarHistoricoConsolidado: auditoriaRepository.listarHistoricoConsolidado, obterPorId: auditoriaRepository.obterPorId, paraRelatorio };
