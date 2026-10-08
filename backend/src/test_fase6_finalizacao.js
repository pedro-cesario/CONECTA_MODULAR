const assert = require('assert');
const rascunhosDb = require('./core/database/rascunhosDatabase');

async function test_finalizacao_mock() {
  console.log("Mocking dependencies...");
  
  const TriagemPaFinalizacaoService = require('./modules/triagem-pa/TriagemPaFinalizacaoService');
  const clinicoRepo = require('./modules/triagem-pa/TriagemPaClinicoRepository');
  const rascunhoRepo = require('./modules/triagem-pa/TriagemPaRascunhoRepository');
  const FilaRepository = require('./modules/core/fila/FilaRepository');
  const SettingsService = require('./modules/admin/SettingsService');

  let callLog = [];
  
  clinicoRepo.gravarSinaisVitais = async () => { callLog.push('sinais'); return true; };
  clinicoRepo.gravarAlergia = async () => { callLog.push('alergia'); return true; };
  clinicoRepo.gravarGlasgow = async () => { callLog.push('glasgow'); return true; };
  clinicoRepo.atualizarClassificacao = async () => { callLog.push('classificacao'); return true; };
  clinicoRepo.gravarEvolucao = async () => { callLog.push('evolucao'); return 999; };
  clinicoRepo.assinarEvolucao = async () => { callLog.push('assinatura'); return true; };
  clinicoRepo.atualizarFimTriagem = async () => { callLog.push('fim'); return true; };
  
  FilaRepository.transferirPacienteFila = async () => { callLog.push('transferencia'); return true; };

  rascunhoRepo.getRascunho = async () => ({
    queixaPrincipal: "Dor de cabeca",
    sinaisVitais: { pas: 120, pad: 80 },
    alergias: { novaAlergia: true, novaAlergiaDesc: "Dipirona", negaAlergias: false },
    glasgow: { ocular: 4, verbal: 5, motora: 6, total: 15 }
  });
  
  let rascunhoRemovido = false;
  rascunhoRepo.removeRascunho = async () => { rascunhoRemovido = true; return true; };
  
  SettingsService.getSettings = async () => ({});
  SettingsService.getSetting = async (key) => {
    if (key === 'triagem_cor_verde') return 4;
    if (key === 'triagem_fila_destino') return 999;
    return null;
  };
  
  console.log("Iniciando finalizacao fake...");
  const nrAtendimento = 112233;
  await TriagemPaFinalizacaoService.finalizarTriagem(nrAtendimento, {
    nr_seq_senha: 55,
    cd_senha_gerada: 'A01',
    fila_atual: 10,
    cd_pessoa_fisica: 123
  }, 'TESTE');
  
  const fin = await rascunhosDb.getFinalizacao(nrAtendimento);
  console.log("Status final:", fin.status);
  console.log("Call Log:", callLog);
  console.log("Rascunho Removido:", rascunhoRemovido);
  
  assert.strictEqual(fin.status, 'CONCLUIDA');
  assert.ok(callLog.includes('sinais'));
  assert.ok(callLog.includes('alergia'));
  assert.ok(callLog.includes('glasgow'));
  assert.ok(callLog.includes('classificacao'));
  assert.ok(callLog.includes('evolucao'));
  assert.ok(callLog.includes('assinatura'));
  assert.ok(callLog.includes('fim'));
  assert.ok(callLog.includes('transferencia'));
  assert.ok(rascunhoRemovido);

  console.log("Test OK!");
  process.exit(0);
}

test_finalizacao_mock().catch(console.error);
