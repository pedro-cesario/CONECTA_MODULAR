const assert = require('assert');
const TriagemPaClassificacaoService = require('./src/modules/triagem-pa/TriagemPaClassificacaoService');

async function runTests() {
  console.log("Running Fase 5 Refactor Tests...");

  // Default configs (No admin configs passed)
  let rascunho = { sinaisVitais: { fc: 170 }, criteriosManuais: ['A3'] };
  let result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho);
  assert(result.coresElegiveis.includes('VERMELHO'));
  assert(result.coresElegiveis.includes('AMARELO'));
  assert(result.classificacaoResolvida === 'VERMELHO'); // Precedence VERMELHO > AMARELO

  // 1. Mudar FC >= 160 para >= 150 -> FC 155 passa a disparar
  let regrasAuto = [
    { codigo: 'V2_FC_ALTA', criterio: 'V2', cor: 'VERMELHO', campo: 'fc', operador: '>=', valor: 150, ativo: true }
  ];
  rascunho = { sinaisVitais: { fc: 155 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(result.coresElegiveis.includes('VERMELHO'));
  assert(result.classificacaoResolvida === 'VERMELHO');

  // 2. Mudar SpO2 < 85 para < 90 -> SpO2 88 passa a disparar
  regrasAuto = [
    { codigo: 'V2_SPO2_BAIXA', criterio: 'V2', cor: 'VERMELHO', campo: 'spo2', operador: '<', valor: 90, ativo: true }
  ];
  rascunho = { sinaisVitais: { spo2: 88 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(result.classificacaoResolvida === 'VERMELHO');

  // 3. Alterar prioridade para: AMARELO > VERMELHO > VERDE > AZUL
  const prioridadeInversa = ['AMARELO', 'VERMELHO', 'VERDE', 'AZUL'];
  rascunho = { sinaisVitais: { fc: 170 }, criteriosManuais: ['A3'] }; // FC=170 -> Vermelho, A3 -> Amarelo
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_precedencia: JSON.stringify(prioridadeInversa) });
  assert(result.coresElegiveis.includes('VERMELHO') && result.coresElegiveis.includes('AMARELO'));
  assert(result.classificacaoResolvida === 'AMARELO');

  // 4. Desativar regra FC alta -> FC 170 deixa de disparar essa regra
  regrasAuto = TriagemPaClassificacaoService.defaultRegrasAutomaticas.map(r => 
    r.codigo === 'V2_FC_ALTA' ? { ...r, ativo: false } : r
  );
  rascunho = { sinaisVitais: { fc: 170 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(!result.coresElegiveis.includes('VERMELHO'));

  // 5. Desativar critério A3 -> não participa
  let regrasMan = TriagemPaClassificacaoService.defaultRegrasManuais.map(r => 
    r.codigo === 'A3' ? { ...r, ativo: false } : r
  );
  rascunho = { criteriosManuais: ['A3'] };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_manuais: JSON.stringify(regrasMan) });
  assert(!result.coresElegiveis.includes('AMARELO'));
  assert(result.classificacaoResolvida === null);

  // 6. Operador inválido rejeitado
  regrasAuto = [{ codigo: 'TESTE', cor: 'VERMELHO', campo: 'fc', operador: 'INVALIDO', valor: 100, ativo: true }];
  try {
    TriagemPaClassificacaoService.validarRegrasAutomaticas(regrasAuto);
    assert(false, "Should have thrown");
  } catch(e) {
    assert(e.message.includes('Operador não suportado'));
  }

  // 7. Campo desconhecido rejeitado
  regrasAuto = [{ codigo: 'TESTE', cor: 'VERMELHO', campo: 'campo_inventado', operador: '>', valor: 100, ativo: true }];
  try {
    TriagemPaClassificacaoService.validarRegrasAutomaticas(regrasAuto);
    assert(false, "Should have thrown");
  } catch(e) {
    assert(e.message.includes('Campo desconhecido'));
  }

  console.log("All tests passed!");
}
runTests().catch(err => { console.error(err); process.exit(1); });
