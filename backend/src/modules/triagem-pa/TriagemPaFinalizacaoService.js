const clinicoRepo = require('./TriagemPaClinicoRepository');
const rascunhoRepo = require('./TriagemPaRascunhoRepository');
const rascunhosDb = require('../../core/database/rascunhosDatabase');
const FilaRepository = require('../core/fila/FilaRepository');
const TriagemPaClassificacaoService = require('./TriagemPaClassificacaoService');
const SettingsService = require('../admin/SettingsService');

class TriagemPaFinalizacaoService {
  async finalizarTriagem(nrAtendimento, dados, nmUsuario) {
    const { nr_seq_senha, fila_atual, cd_senha_gerada, cd_pessoa_fisica } = dados;

    if (!nrAtendimento) throw new Error('Atendimento não informado');
    
    let finalizacao = await rascunhosDb.getFinalizacao(nrAtendimento);
    if (finalizacao && finalizacao.status === 'CONCLUIDA') {
      return { success: true, message: 'Triagem já foi finalizada anteriormente.' };
    }

    if (!finalizacao) {
      await rascunhosDb.upsertFinalizacao({
        nr_atendimento: nrAtendimento,
        nr_seq_senha,
        status: 'INICIADA',
        etapa_atual: 'INICIO',
        ultimo_erro: null,
        nm_usuario: nmUsuario
      });
      finalizacao = await rascunhosDb.getFinalizacao(nrAtendimento);
    }

    try {
      const rascunho = await rascunhoRepo.getRascunho(nrAtendimento);
      if (!rascunho) throw new Error('Nenhum rascunho encontrado para finalização');

      // 1. Recalcular classificação
      const adminConfigs = await SettingsService.getSettings([
        'triagem_precedencia',
        'triagem_regras_automaticas',
        'triagem_regras_manuais'
      ]);
      const classifFinal = await TriagemPaClassificacaoService.calcularClassificacao(rascunho, adminConfigs);

      // 2. Persistir Dados Clínicos
      if (finalizacao.etapa_atual === 'INICIO' || finalizacao.etapa_atual === 'ERRO_CLINICO') {
        if (rascunho.sinaisVitais) {
          await clinicoRepo.gravarSinaisVitais(nrAtendimento, cd_pessoa_fisica, nmUsuario, rascunho.sinaisVitais);
        }
        
        if (rascunho.alergias?.negaAlergias) {
          await clinicoRepo.gravarNegaAlergias(cd_pessoa_fisica, nrAtendimento, nmUsuario);
        } else if (Array.isArray(rascunho.alergias?.novas) && rascunho.alergias.novas.length) {
          await clinicoRepo.gravarAlergias(cd_pessoa_fisica, nrAtendimento, rascunho.alergias.novas, nmUsuario);
        }

        const totalGlasgow = TriagemPaClassificacaoService.calcularGlasgow(rascunho.glasgow);
        if (rascunho.glasgow && totalGlasgow) {
          await clinicoRepo.gravarGlasgow(nrAtendimento, { ...rascunho.glasgow, total: totalGlasgow }, nmUsuario);
        }

        await rascunhosDb.upsertFinalizacao({ nr_atendimento: nrAtendimento, etapa_atual: 'DADOS_CLINICOS_OK' });
        finalizacao.etapa_atual = 'DADOS_CLINICOS_OK';
      }

      // 3. Classificação TASY
      if (finalizacao.etapa_atual === 'DADOS_CLINICOS_OK') {
        const chaveCor = {
          VERMELHO: 'triagem_cor_vermelho',
          AMARELO: 'triagem_cor_amarelo',
          VERDE: 'triagem_cor_verde',
          AZUL: 'triagem_cor_azul'
        }[classifFinal.classificacaoResolvida];
        const corId = chaveCor ? await SettingsService.getSetting(chaveCor) : null;

        if (corId) {
          await clinicoRepo.atualizarClassificacao(nrAtendimento, corId, nmUsuario);
        }
        await rascunhosDb.upsertFinalizacao({ nr_atendimento: nrAtendimento, etapa_atual: 'CLASSIFICACAO_OK' });
        finalizacao.etapa_atual = 'CLASSIFICACAO_OK';
      }

      // 4. Evolução
      if (finalizacao.etapa_atual === 'CLASSIFICACAO_OK') {
        const textoEvolucao = this.gerarTextoEvolucao(rascunho, classifFinal);
        const cdEvolucao = await clinicoRepo.gravarEvolucao(nrAtendimento, cd_pessoa_fisica, textoEvolucao, nmUsuario);
        
        // Simular assinatura digital se houver
        await clinicoRepo.assinarEvolucao(cdEvolucao, cd_pessoa_fisica, textoEvolucao, nmUsuario);

        await rascunhosDb.upsertFinalizacao({ nr_atendimento: nrAtendimento, etapa_atual: 'EVOLUCAO_OK' });
        finalizacao.etapa_atual = 'EVOLUCAO_OK';
      }

      // 5. DT_FIM_TRIAGEM
      if (finalizacao.etapa_atual === 'EVOLUCAO_OK') {
        await clinicoRepo.atualizarFimTriagem(nrAtendimento, nmUsuario);
        await rascunhosDb.upsertFinalizacao({ nr_atendimento: nrAtendimento, etapa_atual: 'FIM_TRIAGEM_OK' });
        finalizacao.etapa_atual = 'FIM_TRIAGEM_OK';
      }

      // 6. Transferir Fila
      if (finalizacao.etapa_atual === 'FIM_TRIAGEM_OK') {
        if (nr_seq_senha) {
           const filaDestino = await SettingsService.getSetting('triagem_fila_destino') || 123; // fallback 
           await FilaRepository.transferirPacienteFila(filaDestino, fila_atual, nr_seq_senha, cd_senha_gerada);
        }
        await rascunhosDb.upsertFinalizacao({ nr_atendimento: nrAtendimento, etapa_atual: 'TRANSFERENCIA_OK', status: 'CONCLUIDA' });
        finalizacao.etapa_atual = 'TRANSFERENCIA_OK';
      }

      // 7. Limpar rascunho
      if (finalizacao.etapa_atual === 'TRANSFERENCIA_OK') {
        await rascunhoRepo.removeRascunho(nrAtendimento);
      }

      return { success: true };

    } catch (err) {
      await rascunhosDb.upsertFinalizacao({
        nr_atendimento: nrAtendimento,
        status: 'ERRO',
        ultimo_erro: err.message || 'Erro desconhecido'
      });
      throw err;
    }
  }

  gerarTextoEvolucao(rascunho, classif) {
    let linhas = [];
    linhas.push('TRIAGEM P.A.');
    linhas.push('');

    if (rascunho.queixaPrincipal) {
      linhas.push('Queixa principal:');
      linhas.push(rascunho.queixaPrincipal);
      linhas.push('');
    }

    if (rascunho.alergias) {
      linhas.push('Alergias:');
      if (rascunho.alergias.negaAlergias) {
        linhas.push('Nega alergias');
      } else if (Array.isArray(rascunho.alergias.novas)) {
        rascunho.alergias.novas.forEach(alergia => linhas.push(alergia.descricao || 'Alergia selecionada'));
      }
      linhas.push('');
    }

    if (rascunho.sinaisVitais) {
      linhas.push('Sinais vitais:');
      const sv = rascunho.sinaisVitais;
      if (sv.pas && sv.pad) linhas.push(`PA: ${sv.pas} / ${sv.pad} mmHg`);
      if (sv.fc) linhas.push(`FC: ${sv.fc} bpm`);
      if (sv.fr) linhas.push(`FR: ${sv.fr} irpm`);
      if (sv.temperatura || sv.temp) linhas.push(`Temperatura: ${sv.temperatura || sv.temp} °C`);
      if (sv.spo2 || sv.sato2) linhas.push(`SpO2: ${sv.spo2 || sv.sato2} %`);
      if (sv.peso) linhas.push(`Peso: ${sv.peso} kg`);
      linhas.push('');
    }

    if (rascunho.historicoSaude || rascunho.historico) {
      linhas.push('Histórico de saúde:');
      linhas.push((rascunho.historicoSaude || rascunho.historico).join(', '));
      linhas.push('');
    }

    if (rascunho.estadoGeral) {
      linhas.push('Estado geral:');
      linhas.push(rascunho.estadoGeral.join(', '));
      linhas.push('');
    }

    if (rascunho.comportamento) {
      linhas.push('Comportamento:');
      linhas.push(rascunho.comportamento.join(', '));
      linhas.push('');
    }

    if (rascunho.sintomasGripais && (rascunho.sintomasGripais.apresenta || rascunho.sintomasGripais.possui)) {
      linhas.push('Sintomas gripais:');
      linhas.push('Sim. ' + (rascunho.sintomasGripais.descricao || ''));
      linhas.push('');
    }

    const totalGlasgow = rascunho.glasgow?.total || TriagemPaClassificacaoService.calcularGlasgow(rascunho.glasgow);
    if (rascunho.glasgow && totalGlasgow) {
      linhas.push('Glasgow:');
      linhas.push(`Ocular: ${rascunho.glasgow.ocular}`);
      linhas.push(`Verbal: ${rascunho.glasgow.verbal}`);
      linhas.push(`Motora: ${rascunho.glasgow.motora}`);
      linhas.push(`Total: ${totalGlasgow}`);
      linhas.push('');
    }

    linhas.push('Escala de Triagem P.A.:');
    linhas.push(`Classificação final: ${classif.classificacaoResolvida || 'Sem critério resolvido'}`);
    if (classif.criteriosIdentificados && classif.criteriosIdentificados.length > 0) {
      linhas.push('Critérios identificados:');
      classif.criteriosIdentificados.forEach(e => linhas.push('- ' + (e.evidencia || e.descricao || e.criterio || e.codigo)));
    }

    return linhas.join('\n');
  }
}

module.exports = new TriagemPaFinalizacaoService();
