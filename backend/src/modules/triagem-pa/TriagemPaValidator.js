const { AppError } = require('../../core/errors/AppError');

function validarRascunho(rascunhoData, configClinica) {
  if (!rascunhoData) return;

  // Sinais vitais
  if (rascunhoData.sinaisVitais) {
    const sv = rascunhoData.sinaisVitais;
    if (sv.pas && !Number.isInteger(Number(sv.pas))) throw new AppError('PA Sistólica deve ser inteiro', 400);
    if (sv.pad && !Number.isInteger(Number(sv.pad))) throw new AppError('PA Diastólica deve ser inteiro', 400);
    if (sv.fc && !Number.isInteger(Number(sv.fc))) throw new AppError('Frequência Cardíaca deve ser inteiro', 400);
    if (sv.fr && !Number.isInteger(Number(sv.fr))) throw new AppError('Frequência Respiratória deve ser inteiro', 400);
    if (sv.temperatura && isNaN(parseFloat(sv.temperatura))) throw new AppError('Temperatura deve ser numérico', 400);
    if (sv.peso && isNaN(parseFloat(sv.peso))) throw new AppError('Peso deve ser numérico', 400);
  }

  // Historico
  if (rascunhoData.historicoSaude && Array.isArray(rascunhoData.historicoSaude)) {
    const temNega = rascunhoData.historicoSaude.includes('Nega Comorbidades');
    if (temNega && rascunhoData.historicoSaude.length > 1) {
      throw new AppError('Nega Comorbidades não pode ser combinado com outras opções', 400);
    }
  }

  // Estado Geral
  if (rascunhoData.estadoGeral && Array.isArray(rascunhoData.estadoGeral)) {
    const est = rascunhoData.estadoGeral;
    if (est.includes('Corado') && est.includes('Hipocorado')) throw new AppError('Estado geral incompatível: Corado e Hipocorado', 400);
    if (est.includes('Nutrido') && est.includes('Desnutrido')) throw new AppError('Estado geral incompatível: Nutrido e Desnutrido', 400);
    if (est.includes('Hidratado') && est.includes('Desidratado')) throw new AppError('Estado geral incompatível: Hidratado e Desidratado', 400);
  }
}

module.exports = { validarRascunho };
