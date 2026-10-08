const assert = require('assert');
const TriagemPaClassificacaoService = require('./src/modules/triagem-pa/TriagemPaClassificacaoService');

const mockAdminConfigs = {
  triagem_criterios_vermelho: JSON.stringify([{codigo:'V1'}, {codigo:'V4'}, {codigo:'V5'}]),
  triagem_criterios_amarelo: JSON.stringify([{codigo:'A1'}, {codigo:'A2'}, {codigo:'A3'}, {codigo:'A4'}, {codigo:'A5'}]),
  triagem_criterios_verde: JSON.stringify([{codigo:'G1'}, {codigo:'G2'}, {codigo:'G3'}, {codigo:'G4'}]),
  triagem_criterios_azul: JSON.stringify([{codigo:'B1'}, {codigo:'B2'}, {codigo:'B3'}, {codigo:'B4'}])
};

async function runTests() {
  console.log("Running Fase 5 Tests...");

  // 1. Glasgow <= 8 (V3)
  let rascunho = { glasgow: { ocular: 2, verbal: 2, motora: 4 } }; // sum 8
  let result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));
  assert(result.sugestaoFinal === 'VERMELHO');
  const v3 = result.criteriosIdentificados.find(c => c.regra === 'GLASGOW_LE_8');
  assert(v3 && v3.origem === 'AUTOMATICO' && v3.operador === '<=' && v3.limite === 8 && v3.valor === 8);

  // Glasgow > 8
  rascunho = { glasgow: { ocular: 4, verbal: 5, motora: 6 } }; // sum 15
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));
  assert(result.sugestaoFinal === null);
  assert(result.coresElegiveis.length === 0);

  // 2. Sinais Vitais Limites
  // FC
  rascunho = { sinaisVitais: { fc: 160 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));
  
  rascunho = { sinaisVitais: { fc: 159 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));
  
  rascunho = { sinaisVitais: { fc: 49 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { fc: 50 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));

  // FR
  rascunho = { sinaisVitais: { fr: 31 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));
  
  rascunho = { sinaisVitais: { fr: 30 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));
  
  rascunho = { sinaisVitais: { fr: 9 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { fr: 10 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));
  
  // SpO2
  rascunho = { sinaisVitais: { sato2: 84 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { sato2: 85 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));
  
  // PA grave
  rascunho = { sinaisVitais: { pas: 171, pad: 120 } }; // PAS > 170
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { pas: 170, pad: 121 } }; // PAD > 120
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { pas: 170, pad: 120 } }; // Normal-ish (not red)
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(!result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { pas: 79, pad: 60 } }; // PAS < 80
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));

  rascunho = { sinaisVitais: { pas: 80, pad: 59 } }; // PAD < 60
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.coresElegiveis.includes('VERMELHO'));
  
  // 3. Critérios Manuais
  rascunho = { criteriosManuais: ['A3'] };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.sugestaoFinal === 'AMARELO');

  // 4. Conflito
  rascunho = { sinaisVitais: { fc: 170 }, criteriosManuais: ['A3'] };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.conflito === true);
  assert(result.sugestaoFinal === 'CONFLITO_DE_CLASSIFICACAO');
  assert(result.coresElegiveis.includes('VERMELHO') && result.coresElegiveis.includes('AMARELO'));

  // 5. Recalculo (simulated by passing updated draft)
  rascunho = { sinaisVitais: { fc: 90 }, criteriosManuais: ['A3'] };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, mockAdminConfigs);
  assert(result.conflito === false);
  assert(result.sugestaoFinal === 'AMARELO');
  assert(!result.coresElegiveis.includes('VERMELHO'));

  console.log("All tests passed!");
}
runTests().catch(err => { console.error(err); process.exit(1); });
