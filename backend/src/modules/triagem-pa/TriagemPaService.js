const PacienteService = require('../core/paciente/PacienteService');
const AtendimentoRepository = require('../core/atendimento/AtendimentoRepository');
const TriagemService = require('../core/triagem/TriagemService');
const SettingsService = require('../admin/SettingsService');
const FilaService = require('../core/fila/FilaService');
const { AppError } = require('../../core/errors/AppError');
const db = require('../../core/database/index.js');

const CHAVES_ATENDIMENTO_TRIAGEM = [
  'triagem_estab',
  'triagem_setor',
  'triagem_procedencia',
  'triagem_clinica',
  'triagem_tipo_atend',
  'triagem_motivo',
  'triagem_fila_origem',
  'triagem_fila_destino',
  'triagem_medico_resp',
  'recepcao_cd_med_resp',
  'recepcao_cd_convenio_padrao'
];

function valorConfigurado(valor) {
  if (valor === null || valor === undefined) return false;
  const normalizado = String(valor).trim();
  return normalizado !== '' && normalizado !== '0';
}

async function obterConfiguracaoAtendimentoTriagem() {
  const configuracao = await SettingsService.getSettings(CHAVES_ATENDIMENTO_TRIAGEM);
  const chavesObrigatorias = CHAVES_ATENDIMENTO_TRIAGEM.filter(chave => ![
    'triagem_medico_resp',
    'recepcao_cd_med_resp',
    'recepcao_cd_convenio_padrao'
  ].includes(chave));
  const ausentes = chavesObrigatorias.filter(chave => !valorConfigurado(configuracao[chave]));
  if (ausentes.length) {
    throw new AppError(
      `Configurações obrigatórias da Triagem P.A. ausentes: ${ausentes.join(', ')}.`,
      422,
      'TRIAGEM_CONFIG_INCOMPLETA',
      { ausentes }
    );
  }

  const cdMedicoResp = valorConfigurado(configuracao.triagem_medico_resp)
    ? configuracao.triagem_medico_resp
    : configuracao.recepcao_cd_med_resp;
  if (!valorConfigurado(cdMedicoResp)) {
    throw new AppError(
      'Configuração de médico responsável ausente. Configure triagem_medico_resp ou recepcao_cd_med_resp no Admin.',
      422,
      'TRIAGEM_CONFIG_INCOMPLETA',
      { ausentes: ['triagem_medico_resp/recepcao_cd_med_resp'] }
    );
  }

  return { ...configuracao, cdMedicoResp };
}

async function validarPreRequisitosAtendimento(configuracao) {
  const conn = await db.getConnection();
  try {
    const [clinicaTipo, medico, unidade] = await Promise.all([
      conn.execute(
        `SELECT 1
           FROM clinica_tipo_atendimento
          WHERE cd_estabelecimento = :estabelecimento
            AND ie_clinica = :clinica
            AND ie_tipo_atendimento = :tipo_atendimento
            AND NVL(ie_situacao, 'A') = 'A'
            AND ROWNUM = 1`,
        {
          estabelecimento: configuracao.triagem_estab,
          clinica: configuracao.triagem_clinica,
          tipo_atendimento: configuracao.triagem_tipo_atend
        }
      ),
      conn.execute(
        `SELECT 1
           FROM medico
          WHERE cd_pessoa_fisica = :medico
            AND NVL(ie_situacao, 'A') = 'A'
            AND ROWNUM = 1`,
        { medico: String(configuracao.cdMedicoResp) }
      ),
      conn.execute(
        `SELECT 1
           FROM unidade_atendimento
          WHERE cd_setor_atendimento = :setor
            AND NVL(ie_situacao, 'A') = 'A'
            AND ROWNUM = 1`,
        { setor: configuracao.triagem_setor }
      )
    ]);

    const erros = [];
    if (clinicaTipo.rows.length === 0) {
      erros.push(`Clínica ${configuracao.triagem_clinica} não é compatível com o Tipo de Atendimento ${configuracao.triagem_tipo_atend}.`);
    }
    if (medico.rows.length === 0) {
      erros.push(`Médico responsável ${configuracao.cdMedicoResp} não está ativo no TASY.`);
    }
    if (unidade.rows.length === 0) {
      erros.push(`O setor ${configuracao.triagem_setor} não possui unidade de atendimento ativa.`);
    }
    if (erros.length) {
      throw new AppError(
        `Configuração de abertura de atendimento inválida: ${erros.join(' ')}`,
        422,
        'TRIAGEM_CONFIG_INCOMPATIVEL',
        { erros }
      );
    }
  } finally {
    await conn.close();
  }
}

async function buscarPacientes(termo) {
  if (!termo || termo.trim() === '') {
    return [];
  }
  return await PacienteService.buscarPessoas(termo);
}

async function registrarPacienteNaoIdentificado(nmUsuario) {
  // Ler config
  const classifNaoIdentificado = await SettingsService.getSetting('triagem_classif_nao_identificado');
  if (!classifNaoIdentificado) {
    throw new AppError('Configuração triagem_classif_nao_identificado ausente.', 422, 'TRIAGEM_CONFIG_INCOMPLETA');
  }
  const estabelecimento = await SettingsService.getSetting('triagem_estab');

  // Cria um paciente genérico
  const novoPaciente = {
    nm_pessoa_fisica: `PACIENTE NAO IDENTIFICADO ${Date.now()}`,
    dt_nascimento: null,
    nr_cpf: null,
    nm_mae: null,
    ie_sexo: 'N'
  };

  const cdPessoaFisica = await PacienteService.salvarPessoa(novoPaciente, nmUsuario);

  await PacienteService.atribuirClassificacao(cdPessoaFisica, classifNaoIdentificado, nmUsuario, estabelecimento);

  return { cd_pessoa_fisica: cdPessoaFisica };
}

async function registrarPacienteSemDocumento(cdPessoaFisica, nmUsuario) {
  const classifSemDoc = await SettingsService.getSetting('triagem_classif_sem_doc');
  if (!classifSemDoc) {
    throw new AppError('Configuração triagem_classif_sem_doc ausente.', 422, 'TRIAGEM_CONFIG_INCOMPLETA');
  }
  const estabelecimento = await SettingsService.getSetting('triagem_estab');

  await PacienteService.atribuirClassificacao(cdPessoaFisica, classifSemDoc, nmUsuario, estabelecimento);
  return { success: true };
}

async function iniciarAtendimentoTriagem(dados, nmUsuario) {
  let { cdPessoaFisica, nrSeqPacSenhaFila, condicaoIdentificacao } = dados;

  if (!condicaoIdentificacao || !['IDENTIFICADO', 'NAO_APRESENTOU_IDENTIFICACAO', 'NAO_IDENTIFICADO'].includes(condicaoIdentificacao)) {
    throw new AppError('Condição de identificação inválida ou não informada.', 400);
  }

  const configuracao = await obterConfiguracaoAtendimentoTriagem();
  await validarPreRequisitosAtendimento(configuracao);
  const estabelecimento = configuracao.triagem_estab;
  const setor = configuracao.triagem_setor;
  const procedencia = configuracao.triagem_procedencia;
  const tipoAtend = configuracao.triagem_tipo_atend;
  const clinica = configuracao.triagem_clinica;
  const cdMedicoResp = configuracao.cdMedicoResp;
  const cdConvenio = configuracao.recepcao_cd_convenio_padrao;

  if (condicaoIdentificacao === 'NAO_IDENTIFICADO') {
    const classifNaoIdentificado = await SettingsService.getSetting('triagem_classif_nao_identificado');
    if (!classifNaoIdentificado) {
      throw new AppError('Configuração triagem_classif_nao_identificado ausente.', 422, 'TRIAGEM_CONFIG_INCOMPLETA');
    }
    const novoPaciente = {
      nm_pessoa_fisica: `PACIENTE NAO IDENTIFICADO ${Date.now()}`,
      dt_nascimento: null,
      nr_cpf: null,
      nm_mae: null,
      ie_sexo: 'N'
    };
    cdPessoaFisica = await PacienteService.salvarPessoa(novoPaciente, nmUsuario);
    await PacienteService.atribuirClassificacao(cdPessoaFisica, classifNaoIdentificado, nmUsuario, estabelecimento);
  } else if (condicaoIdentificacao === 'NAO_APRESENTOU_IDENTIFICACAO') {
    if (!cdPessoaFisica) throw new AppError('Paciente obrigatório.', 400);
    const classifSemDoc = await SettingsService.getSetting('triagem_classif_sem_doc');
    if (!classifSemDoc) {
      throw new AppError('Configuração triagem_classif_sem_doc ausente.', 422, 'TRIAGEM_CONFIG_INCOMPLETA');
    }
    await PacienteService.atribuirClassificacao(cdPessoaFisica, classifSemDoc, nmUsuario, estabelecimento);
  } else {
    if (!cdPessoaFisica) throw new AppError('Paciente obrigatório.', 400);
  }

  // Verifica se a senha já possui atendimento aberto (Retomada)
  if (nrSeqPacSenhaFila) {
    const atendSenha = await AtendimentoRepository.verificarAtendimentoPorSenha(nrSeqPacSenhaFila);
    if (atendSenha) {
      return { nr_atendimento: atendSenha.nr_atendimento, cd_pessoa_fisica: atendSenha.cd_pessoa_fisica, resumed: true };
    }
  }

  // Verifica se o paciente já tem atendimento aberto geral e impede novo
  const atendAberto = await AtendimentoRepository.verificarAtendimentoAberto(cdPessoaFisica);
  if (atendAberto) {
    return { nr_atendimento: atendAberto, resumed: true };
  }

  // Abrir Atendimento
  const dadosAtendimento = {
    cdPessoaFisica,
    cdEstabelecimento: estabelecimento,
    cdSetorAtendimento: setor,
    cdProcedencia: procedencia,
    ieTipoAtendimento: tipoAtend,
    ieClinica: clinica,
    nrSeqPacSenhaFila: nrSeqPacSenhaFila || null,
    cdMedicoResp,
    cdConvenio: valorConfigurado(cdConvenio) ? cdConvenio : 1,
    cdCategoria: 1,
    // A Triagem apenas abre o atendimento clínico. O lançamento é feito
    // posteriormente quando a Recepção assumir o atendimento.
    gerarLancamentoAutomatico: false,
  };

  const result = await AtendimentoRepository.abrirAtendimento(dadosAtendimento, nmUsuario);

  // Iniciar Triagem (Atualiza DT_INICIO_ATENDIMENTO)
  await TriagemService.iniciar(result.nr_atendimento, nmUsuario);

  // Se tiver senha e ela estiver aguardando, talvez devêssemos mudar o status da senha
  // Mas a especificação diz: "Senha continua na fila de origem durante toda a triagem" (não fechada)
  // Então não fazemos FilaService.encerrarSenha! 

  result.cd_pessoa_fisica = cdPessoaFisica;
  return result;
}

async function descartarSenha(nrSeqPacSenhaFila, motivo, nmUsuario) {
  if (!nrSeqPacSenhaFila || !motivo) {
    throw new AppError('Senha e motivo são obrigatórios.', 400);
  }
  // Chamando rotina oficial autonoma INUTILIZAR_SENHA
  await FilaService.inutilizarSenha(nrSeqPacSenhaFila, motivo, nmUsuario);
  return { success: true };
}

async function obterStatusSenha(nrSeqPacSenhaFila) {
  if (!nrSeqPacSenhaFila) throw new AppError('Senha obrigatória', 400);
  const atendSenha = await AtendimentoRepository.verificarAtendimentoPorSenha(nrSeqPacSenhaFila);
  if (atendSenha) {
    let condicaoIdentificacao = 'IDENTIFICADO';
    const classifNaoIdent = await SettingsService.getSetting('triagem_classif_nao_identificado');
    const classifSemDoc = await SettingsService.getSetting('triagem_classif_sem_doc');
    const db = require('../../core/database/index.js');
    const conn = await db.getConnection();
    try {
      const res = await conn.execute(
        `SELECT cd_classificacao FROM pessoa_classif WHERE cd_pessoa_fisica = :cpf`,
        { cpf: atendSenha.cd_pessoa_fisica }
      );
      if (res.rows.length > 0) {
        const classifs = res.rows.map(r => String(r.CD_CLASSIFICACAO));
        if (classifNaoIdent && classifs.includes(String(classifNaoIdent))) {
          condicaoIdentificacao = 'NAO_IDENTIFICADO';
        } else if (classifSemDoc && classifs.includes(String(classifSemDoc))) {
          condicaoIdentificacao = 'NAO_APRESENTOU_IDENTIFICACAO';
        }
      }
    } catch(err) {
      console.error(err);
    } finally {
      if (conn) await conn.close();
    }
    
    return { 
      emAndamento: true, 
      nr_atendimento: atendSenha.nr_atendimento, 
      cd_pessoa_fisica: atendSenha.cd_pessoa_fisica,
      condicaoIdentificacao
    };
  }
  return { emAndamento: false };
}



const clinicoRepo = require('./TriagemPaClinicoRepository');
const rascunhoRepo = require('./TriagemPaRascunhoRepository');

async function carregarAlergiasPaciente(cdPessoaFisica) {
  return await clinicoRepo.carregarAlergiasPaciente(cdPessoaFisica);
}

async function buscarPrincipiosAtivos(termo) {
  const busca = String(termo || '').trim();
  if (busca.length < 2) return [];
  return await clinicoRepo.buscarPrincipiosAtivos(busca);
}


async function getRascunho(nrAtendimento) {
  return await rascunhoRepo.getRascunho(nrAtendimento) || {};
}


const TriagemPaClassificacaoService = require('./TriagemPaClassificacaoService');
const { validarRascunho } = require('./TriagemPaValidator');

async function saveRascunho(nrAtendimento, rascunhoData, nmUsuario) {
  const configClinica = await getConfiguracoesClinicas();
  validarRascunho(rascunhoData, configClinica);

  const adminConfigs = await SettingsService.getSettings([
    'triagem_precedencia',
    'triagem_regras_automaticas',
    'triagem_regras_manuais'
  ]);
  
  const classif = await TriagemPaClassificacaoService.calcularClassificacao(rascunhoData, adminConfigs);
  rascunhoData.classificacao = classif;

  const salvo = await rascunhoRepo.saveRascunho(nrAtendimento, rascunhoData, nmUsuario);
  return { ...salvo, classificacao: classif };
}

async function removerRascunho(nrAtendimento) {
  return await rascunhoRepo.removeRascunho(nrAtendimento);
}

async function getConfiguracoesClinicas() {
  const TriagemPaClassificacaoService = require('./TriagemPaClassificacaoService');
  const [config, regrasManuais] = await Promise.all([
    SettingsService.getSetting('triagem_campos_clinicos'),
    SettingsService.getSetting('triagem_regras_manuais')
  ]);
  
  let baseConfig = {};
  if (config) {
    try {
      baseConfig = JSON.parse(config);
    } catch(err) {
      console.error('[TriagemPaService] Erro ao parsear triagem_campos_clinicos', err);
    }
  } else {
    baseConfig = {
      historico: [
        { id: 'Diabetes', descricao: 'Diabetes' },
        { id: 'Hipertensão', descricao: 'Hipertensão' },
        { id: 'Nega Comorbidades', descricao: 'Nega Comorbidades', exclusivo: true }
      ],
      estadoGeral: [
        { id: 'Corado', descricao: 'Corado', incompativel: 'Hipocorado' },
        { id: 'Hipocorado', descricao: 'Hipocorado', incompativel: 'Corado' }
      ],
      comportamento: [
        { id: 'Cooperativo', descricao: 'Cooperativo' }
      ]
    };
  }

  let manuais = TriagemPaClassificacaoService.defaultRegrasManuais;
  if (regrasManuais) {
    try {
      manuais = TriagemPaClassificacaoService.validarRegrasManuais(JSON.parse(regrasManuais));
    } catch(err) {}
  }
  
  baseConfig.escalaManuais = manuais;
  return baseConfig;
}

module.exports = {
  removerRascunho,
  carregarAlergiasPaciente,
  buscarPrincipiosAtivos,
  getRascunho,
  saveRascunho,
  getConfiguracoesClinicas,
  buscarPacientes,
  registrarPacienteNaoIdentificado,
  registrarPacienteSemDocumento,
  iniciarAtendimentoTriagem,
  descartarSenha,
  obterStatusSenha,
  obterConfiguracaoAtendimentoTriagem,
  validarPreRequisitosAtendimento,
  CHAVES_ATENDIMENTO_TRIAGEM
};
