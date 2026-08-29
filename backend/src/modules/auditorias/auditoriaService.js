const auditoriaRepository = require('.//auditoriaRepository');

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
    cd_profissional: String(payload.cd_profissional || '').trim(),
    ds_observacao: String(payload.ds_observacao || '').trim(),
    oportunidades: oportunidades.map(item => ({
      ie_tipo_oportunidade: String(item?.ie_tipo_oportunidade || '').toUpperCase(),
      ie_resultado: String(item?.ie_resultado || '').toUpperCase()
    }))
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dt_auditoria)) throw new Error('Data da auditoria inválida.');
  if (!Number.isInteger(dados.cd_setor_atendimento)) throw new Error('Setor é obrigatório.');
  if (!Number.isInteger(dados.cd_avaliador)) throw new Error('Avaliador é obrigatório.');
  if (!dados.cd_profissional) throw new Error('Categoria é obrigatória.');
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

// ─── Auditoria de Processos ───────────────────────────────────────────────

const RESULTADOS_PROCESSOS = { S: 'Sim', N: 'Não', NA: 'Não se aplica' };

function calcularIdade(dtNascimento) {
  if (!dtNascimento) return null;
  const nasc = new Date(dtNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? idade : null;
}

function normalizarPayloadProcessos(payload = {}) {
  const respostas = Array.isArray(payload.respostas) ? payload.respostas : [];
  const dados = {
    dt_auditoria: String(payload.dt_auditoria || ''),
    cd_setor_atendimento: Number(payload.cd_setor_atendimento),
    cd_avaliador: Number(payload.cd_avaliador),
    ie_turno: String(payload.ie_turno || '').toUpperCase(),
    ds_observacao: String(payload.ds_observacao || '').trim(),
    nm_paciente: String(payload.nm_paciente || '').trim(),
    dt_nascimento: String(payload.dt_nascimento || '').trim(),
    dt_admissao: String(payload.dt_admissao || '').trim(),
    ds_unidade_leito: String(payload.ds_unidade_leito || '').trim(),
    nr_atendimento: String(payload.nr_atendimento || '').trim(),
    cd_paciente: payload.cd_paciente || null,
    nr_cpf: String(payload.nr_cpf || '').trim(),
    ds_diagnostico: String(payload.ds_diagnostico || '').trim(),
    ie_acompanhante: String(payload.ie_acompanhante || 'NA').toUpperCase(),
    respostas: respostas.map(item => ({
      cd_grupo: String(item?.cd_grupo || '').toUpperCase(),
      cd_subgrupo: String(item?.cd_subgrupo || '').toUpperCase() || null,
      cd_item: String(item?.cd_item || '').toUpperCase(),
      ie_resposta: String(item?.ie_resposta || '').toUpperCase(),
      ds_descricao: String(item?.ds_descricao || '').trim() || null
    }))
  };

  dados.nr_idade = dados.dt_nascimento ? calcularIdade(dados.dt_nascimento) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dt_auditoria)) throw new Error('Data da auditoria inválida.');
  if (!Number.isInteger(dados.cd_setor_atendimento)) throw new Error('Setor é obrigatório.');
  if (!Number.isInteger(dados.cd_avaliador)) throw new Error('Responsável é obrigatório.');
  if (!dados.nm_paciente) throw new Error('Nome do paciente é obrigatório.');
  if (dados.ds_observacao.length > 4000) throw new Error('Observações devem ter no máximo 4000 caracteres.');

  for (const r of dados.respostas) {
    if (!r.cd_grupo || !r.cd_item) throw new Error('Resposta com grupo/item inválido.');
    if (!['S', 'N', 'NA'].includes(r.ie_resposta)) throw new Error('Resposta inválida: use S, N ou NA.');
  }
  return dados;
}

async function salvarAuditoriaProcessos(payload, nmUsuario) {
  const dados = normalizarPayloadProcessos(payload);
  return auditoriaRepository.salvarAuditoriaProcessos(dados, nmUsuario);
}

function paraRelatorioProcessos(auditoria) {
  if (!auditoria) return null;
  return {
    ...auditoria,
    turno_label: auditoria.IE_TURNO === 'N' ? 'Noite' : auditoria.IE_TURNO === 'D' ? 'Dia' : '-',
    respostas: (auditoria.respostas || []).map(item => ({
      ...item,
      resposta_label: RESULTADOS_PROCESSOS[item.IE_RESPOSTA] || item.IE_RESPOSTA
    }))
  };
}

module.exports = { OPORTUNIDADES, RESULTADOS, normalizarPayload, salvarHigieneMaos, listarOpcoes: auditoriaRepository.listarOpcoes, listarHistorico: auditoriaRepository.listarHistorico, listarHistoricoConsolidado: auditoriaRepository.listarHistoricoConsolidado, obterPorId: auditoriaRepository.obterPorId, paraRelatorio, RESULTADOS_PROCESSOS, calcularIdade, normalizarPayloadProcessos, salvarAuditoriaProcessos, listarHistoricoProcessos: auditoriaRepository.listarHistoricoProcessos, listarHistoricoProcessosConsolidado: auditoriaRepository.listarHistoricoProcessosConsolidado, obterProcessosPorId: auditoriaRepository.obterProcessosPorId, paraRelatorioProcessos, listarPacientesOntem: auditoriaRepository.listarPacientesOntem, pacienteAleatorio: auditoriaRepository.pacienteAleatorio };
