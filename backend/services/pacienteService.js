const pacienteRepository = require('../repositories/pacienteRepository');
const dashboardRepository = require('../repositories/dashboardRepository');

function montarNomePaciente(row) {
  const nomeSocial = String(row.NM_SOCIAL || '').trim();
  const nomeCivil = String(row.NM_PESSOA_FISICA || '').trim();
  const nomeFallback = String(row.NOME || '').trim();

  if (nomeSocial) {
    return {
      nome: nomeSocial,
      ...(nomeCivil ? { nome_civil: nomeCivil } : {})
    };
  }

  return {
    nome: nomeCivil || nomeFallback || '-'
  };
}

async function listarPacientes(cdSetores) {
  if (!Array.isArray(cdSetores) || cdSetores.length === 0) {
    const error = new Error('Selecione ao menos um setor');
    error.status = 400;
    throw error;
  }

  const setorEct = 47;
  const setoresNormais = cdSetores.filter(s => Number(s) !== setorEct);
  const incluirEct = cdSetores.some(s => Number(s) === setorEct);

  const [resultados, resultadosEct] = await Promise.all([
    setoresNormais.length > 0 ? pacienteRepository.findBySetores(setoresNormais) : [],
    incluirEct ? pacienteRepository.findByAgendaEct() : []
  ]);

  const pacientes = [...resultados, ...resultadosEct].map(p => ({
    atendimento: p.ATENDIMENTO,
    ...montarNomePaciente(p),
    cd_unidade: p.CD_UNIDADE,
    setor: p.SETOR,
    cd_setor_atendimento: p.CD_SETOR_ATENDIMENTO,
    dt_cancelamento: p.DT_CANCELAMENTO || null
  }));

  return pacientes;
}

async function listarPacientesSetor(cdSetor) {
  const rows = await pacienteRepository.findBySetor(cdSetor);
  return rows.map(row => ({
    nr_atendimento: row.ATENDIMENTO,
    cd_setor_atendimento: row.CD_SETOR_ATENDIMENTO,
    cd_unidade: row.CD_UNIDADE,
    ...montarNomePaciente(row),
    setor: row.SETOR
  }));
}

async function listarPacientesComClassificacao(cdSetor) {
  const pacientes = await dashboardRepository.findPacientesComStatus(cdSetor);

  return pacientes.map(p => {
    const status = p.STATUS instanceof Set ? p.STATUS : new Set();
    const medicacaoSuspensa = status.has('CARD_LARANJA') ? 1 : 0;
    const medicacaoAgora = status.has('CARD_VERMELHO') ? 1 : 0;

    return {
      nr_atendimento: p.NR_ATENDIMENTO,
      cd_setor_atendimento: p.CD_SETOR_ATENDIMENTO,
      cd_unidade: p.CD_UNIDADE,
      classific_atend: p.CLASSIFIC_ATEND || '-',
      ...montarNomePaciente(p),
      setor: p.SETOR,
      medicacao_agora: medicacaoAgora,
      medicacao_suspensa: medicacaoSuspensa,
      checagem_pendente: status.has('CARD_AMARELO') ? 1 : 0,
      contencao_sn: status.has('CARD_VERDE') ? 1 : 0,
      alta_medica_programada: status.has('CARD_AZUL') ? 1 : 0,
      material_agora: status.has('CARD_LARANJA_2') ? 1 : 0,
      prescricoes_agora: Array.isArray(p.PRESCRICOES_AGORA) ? p.PRESCRICOES_AGORA : [],
      news_pontuacao: p.NEWS_PONTUACAO,
      news_resultado: p.NEWS_RESULTADO
    };
  });
}

module.exports = { listarPacientes, listarPacientesSetor, listarPacientesComClassificacao };
