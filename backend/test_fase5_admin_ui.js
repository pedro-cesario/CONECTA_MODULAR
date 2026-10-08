const assert = require('assert');
const TriagemPaClassificacaoService = require('./src/modules/triagem-pa/TriagemPaClassificacaoService');

async function runTests() {
  console.log("Running Fase 5 Admin UI/Motor Tests...");

  // 1. PAS >170 OR PAD >120 funciona no default;
  let rascunho = { sinaisVitais: { pas: 175, pad: 110 } }; // Only PAS > 170
  let result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho);
  assert(result.coresElegiveis.includes('VERMELHO'));
  assert(result.classificacaoResolvida === 'VERMELHO');

  // 2. alterar OR para AND pelo mock do Admin muda o comportamento sem código;
  let regrasAuto = JSON.parse(JSON.stringify(TriagemPaClassificacaoService.defaultRegrasAutomaticas));
  let regraPaAlta = regrasAuto.find(r => r.id === 'V2_PA_ALTA');
  regraPaAlta.operadorLogico = 'AND'; // Requires both PAS > 170 AND PAD > 120
  
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(!result.coresElegiveis.includes('VERMELHO')); // Fails because PAD is 110 (not > 120)

  rascunho = { sinaisVitais: { pas: 175, pad: 125 } }; // Now both are true
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(result.coresElegiveis.includes('VERMELHO'));

  // 3. mudar limite PAS de 170 para 180 muda resultado;
  regraPaAlta.operadorLogico = 'OR';
  regraPaAlta.condicoes.find(c => c.campo === 'pas').valor = 180;
  
  rascunho = { sinaisVitais: { pas: 175 } }; // No longer triggers because limit is 180
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(!result.coresElegiveis.includes('VERMELHO'));

  // 4. mudar Glasgow <=8 para <=9 muda resultado;
  regrasAuto.find(r => r.id === 'V3_GLASGOW').condicoes[0].valor = 9;
  rascunho = { glasgow: { ocular: 3, verbal: 3, motora: 3 } }; // Sum = 9
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(result.coresElegiveis.includes('VERMELHO'));

  // 5. desativar V2 FC alta impede disparo;
  regrasAuto.find(r => r.id === 'V2_FC_ALTA').ativo = false;
  rascunho = { sinaisVitais: { fc: 180 } };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_automaticas: JSON.stringify(regrasAuto) });
  assert(!result.coresElegiveis.includes('VERMELHO'));

  // 6. alterar descrição de A3 aparece no retorno configurado;
  let regrasManuais = JSON.parse(JSON.stringify(TriagemPaClassificacaoService.defaultRegrasManuais));
  regrasManuais.find(m => m.codigo === 'A3').descricao = 'Choro muito intenso modificado';
  
  rascunho = { criteriosManuais: ['A3'] };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_manuais: JSON.stringify(regrasManuais) });
  assert(result.criteriosIdentificados.find(c => c.codigo === 'A3').descricao === 'Choro muito intenso modificado');

  // 7. alterar ordem modifica ordem no Wizard/config retornada;
  regrasManuais.find(m => m.codigo === 'A3').ordem = 1;
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_manuais: JSON.stringify(regrasManuais) });
  assert(result.configManuaisValidas.find(m => m.codigo === 'A3').ordem === 1);

  // 8. alterar cor de critério modifica coresElegiveis;
  regrasManuais.find(m => m.codigo === 'A3').cor = 'VERMELHO';
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_manuais: JSON.stringify(regrasManuais) });
  assert(result.coresElegiveis.includes('VERMELHO'));
  assert(result.classificacaoResolvida === 'VERMELHO');

  // 9. mudar precedência modifica classificacaoResolvida;
  rascunho = { sinaisVitais: { fc: 170 }, criteriosManuais: ['A3'] }; // FC 170 -> VERMELHO, A3 (default) -> AMARELO
  let precInvertida = ['AMARELO', 'VERMELHO', 'VERDE', 'AZUL'];
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_precedencia: JSON.stringify(precInvertida) });
  assert(result.classificacaoResolvida === 'AMARELO');

  // 10. critério inativo enviado manualmente é rejeitado;
  regrasManuais = JSON.parse(JSON.stringify(TriagemPaClassificacaoService.defaultRegrasManuais));
  regrasManuais.find(m => m.codigo === 'A3').ativo = false;
  rascunho = { criteriosManuais: ['A3'] };
  result = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, { triagem_regras_manuais: JSON.stringify(regrasManuais) });
  assert(result.classificacaoResolvida === null);
  assert(result.coresElegiveis.length === 0);

  // 11. configuração inválida não persiste parcialmente (test validation).
  try {
    TriagemPaClassificacaoService.validarRegrasAutomaticas([
      { id: 'TESTE', cor: 'VERMELHO', ativo: true, operadorLogico: 'XOR', condicoes: [] }
    ]);
    assert(false, "Should throw AppError on invalid logic operator");
  } catch(e) {
    assert(e.message.includes('agrupador diferente de AND/OR'));
  }

  console.log("All dynamic admin tests passed!");
}

runTests().catch(err => { console.error(err); process.exit(1); });
