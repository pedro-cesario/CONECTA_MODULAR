const setorRepository = require('.//setorRepository');
const { getPerfisFromGroups } = require('../../core/config/especialidades');
const { getConnection } = require('../../core/database');
const oracledb = require('oracledb');

async function listarSetores() {
  const setores = await setorRepository.findAll();
  return setores.map(s => ({
    cd_setor_atendimento: s.CD_SETOR_ATENDIMENTO,
    ds_setor_atendimento: s.DS_SETOR_ATENDIMENTO
  }));
}

async function listarSetoresLivro(usuario, dataPlantao, turno) {
  const setoresAtivos = await setorRepository.findAllAtivos();
  const rows = [...setoresAtivos];

  const unicos = [];
  const seen = new Set();
  rows.forEach(row => {
    const id = Number(row.CD_SETOR_ATENDIMENTO);
    if (!Number.isInteger(id) || seen.has(id)) return;
    seen.add(id);
    unicos.push({
      cd_setor_atendimento: id,
      ds_setor_atendimento: row.DS_SETOR_ATENDIMENTO
    });
  });

  if (dataPlantao && turno) {
    const setoresComEscala = await buscarSetoresComEscalaLiberada(dataPlantao, turno);
    const setorSet = new Set(setoresComEscala);
    unicos.forEach(s => {
      s.escala_liberada = setorSet.has(s.cd_setor_atendimento);
    });
  }

  return unicos;
}

async function buscarSetoresComEscalaLiberada(dataPlantao, turno) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT DISTINCT cd_setor_atendimento
       FROM ocorrencia
       WHERE ie_tipo_ocorrencia = 'LA'
         AND TRUNC(dt_liberacao) = TO_DATE(:data_plantao, 'YYYY-MM-DD')
         AND NVL(ie_situacao, 'A') <> 'I'`,
      { data_plantao: dataPlantao },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const setores = [];
    for (const row of (result.rows || [])) {
      setores.push(Number(row.CD_SETOR_ATENDIMENTO));
    }
    return setores;
  } finally {
    await conn.close();
  }
}

async function listarSetoresInternacao() {
  const setores = await setorRepository.findAllAtivos();
  const result = setores.map(s => ({
    cd_setor_atendimento: s.CD_SETOR_ATENDIMENTO,
    ds_setor_atendimento: s.DS_SETOR_ATENDIMENTO
  }));

  if (!result.some(s => Number(s.cd_setor_atendimento) === 4)) {
    result.push({ cd_setor_atendimento: 4, ds_setor_atendimento: 'Psicologia' });
  }

  const seen = new Set();
  const uniqueResult = [];
  for (const s of result) {
    const id = Number(s.cd_setor_atendimento);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    uniqueResult.push(s);
  }

  return uniqueResult;
}

module.exports = { listarSetores, listarSetoresLivro, listarSetoresInternacao };
