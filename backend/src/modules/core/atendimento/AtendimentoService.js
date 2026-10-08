const AtendimentoRepository = require('./AtendimentoRepository');
const AppError = require('../../../core/errors/AppError');

async function abrirAtendimento(dados, nmUsuario) {
  // Idempotência: Verificar se já existe um atendimento aberto
  if (dados.cd_pessoa_fisica) {
    const atendExistente = await AtendimentoRepository.verificarAtendimentoAberto(dados.cd_pessoa_fisica);
    if (atendExistente) {
      // Se já existir um atendimento em andamento para o paciente, e a configuração não permitir duplicidade
      // Retornar o ID existente
      return { nr_atendimento: atendExistente };
    }
  }

  // Validação dos parâmetros explícitos
  const payload = {
    cdPessoaFisica: dados.cd_pessoa_fisica,
    cdEstabelecimento: dados.cd_estabelecimento || 1,
    cdSetorAtendimento: dados.cd_setor_atendimento,
    cdProcedencia: dados.cd_procedencia || 1,
    ieTipoAtendimento: dados.ie_tipo_atendimento || 3,
    cdMedicoResp: dados.cd_medico_resp,
    nrSeqClassificacao: dados.nr_seq_classificacao || 2,
    nrSeqPacSenhaFila: dados.nr_seq_pac_senha_fila || null,
    cdConvenio: dados.cd_convenio || 3,
    cdCategoria: dados.cd_categoria || '1',
    cdPlanoConvenio: dados.cd_plano_convenio || null,
    cdUsuarioConvenio: dados.cd_usuario_convenio || '0',
    ieClinica: dados.ie_clinica || 1,
    cdMotivoAtendimento: dados.cd_motivo_atendimento || null,
    // Somente a Recepção habilita esta etapa administrativa.
    gerarLancamentoAutomatico: dados.gerar_lancamento_automatico === true
  };

  if (!payload.cdPessoaFisica) throw new AppError('Código da pessoa física é obrigatório para abrir atendimento', 400);
  if (!payload.cdSetorAtendimento) throw new AppError('Setor de atendimento é obrigatório', 400);

  const res = await AtendimentoRepository.abrirAtendimento(payload, nmUsuario);
  return res;
}

module.exports = {
  abrirAtendimento
};
