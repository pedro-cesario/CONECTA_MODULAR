const setorRepository = require('.//setorRepository');
const { getPerfisFromGroups } = require('../../core/config/especialidades');
const { getConnection } = require('../../core/database');
let _getConnection = getConnection;
function setCustomGetConnectionForTest(fn) { _getConnection = fn; }
function resetCustomGetConnectionForTest() { _getConnection = getConnection; }
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
  if (!dataPlantao) {
    return [];
  }

  const conn = await _getConnection();
  let execErr = null;
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
  } catch (err) {
    execErr = err;
  } finally {
    try {
      await conn.close();
    } catch (closeErr) {
      const logger = require('../../core/utils/logger');
      logger.error('[Setores] Erro ao fechar conexão em buscarSetoresComEscalaLiberada:', closeErr);
      if (!execErr) throw closeErr;
    }
    if (execErr) throw execErr;
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

module.exports = {
  buscarSetoresComEscalaLiberada,
  setCustomGetConnectionForTest,
  resetCustomGetConnectionForTest, listarSetores, listarSetoresLivro, listarSetoresInternacao };
