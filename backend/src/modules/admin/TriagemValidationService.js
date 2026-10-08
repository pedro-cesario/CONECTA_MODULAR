const db = require('../../core/database/index.js');
const { AppError } = require('../../core/errors/AppError');

const CAMPOS_OBRIGATORIOS_ATENDIMENTO = [
  'triagem_estab',
  'triagem_setor',
  'triagem_procedencia',
  'triagem_clinica',
  'triagem_tipo_atend',
  'triagem_motivo',
  'triagem_fila_origem',
  'triagem_fila_destino'
];

function valorConfigurado(valor) {
  if (valor === null || valor === undefined) return false;
  const normalizado = String(valor).trim();
  return normalizado !== '' && normalizado !== '0';
}

class TriagemValidationService {
  async listarOpcoesPA() {
    const conn = await db.getConnection();
    try {
      const [motivos, filas, combinacoesClinicaTipo] = await Promise.all([
        conn.execute(
          `SELECT vl_dominio, ds_valor_dominio
             FROM valor_dominio
            WHERE cd_dominio = 10580
              AND NVL(ie_situacao, 'A') = 'A'
            ORDER BY vl_dominio`
        ),
        conn.execute(
          `SELECT nr_sequencia, ds_fila
             FROM fila_espera_senha
            WHERE ie_situacao = 'A'
            ORDER BY nr_sequencia`
        ),
        conn.execute(
          `SELECT DISTINCT
                  ct.ie_tipo_atendimento,
                  ct.ie_clinica,
                  d.ds_valor_dominio AS ds_clinica
             FROM clinica_tipo_atendimento ct
             JOIN valor_dominio d
               ON d.cd_dominio = 17
              AND d.vl_dominio = TO_CHAR(ct.ie_clinica)
            WHERE NVL(ct.ie_situacao, 'A') = 'A'
            ORDER BY ct.ie_tipo_atendimento, d.ds_valor_dominio`
        )
      ]);

      return {
        motivos: motivos.rows || [],
        filas: filas.rows || [],
        combinacoesClinicaTipo: combinacoesClinicaTipo.rows || []
      };
    } finally {
      if (conn) await conn.close();
    }
  }

  validateRequiredPAConfigs(configs) {
    const ausentes = CAMPOS_OBRIGATORIOS_ATENDIMENTO.filter(chave => !valorConfigurado(configs[chave]));
    if (ausentes.length) {
      throw new AppError(
        `Preencha os parâmetros obrigatórios da Triagem P.A.: ${ausentes.join(', ')}.`,
        422,
        'TRIAGEM_CONFIG_INCOMPLETA',
        { ausentes }
      );
    }
  }

  async validatePAConfigs(configs) {
    const conn = await db.getConnection();
    try {
      const errors = [];

      // Validar Estabelecimento
      if (configs.triagem_estab) {
        const estRes = await conn.execute(
          `SELECT 1 FROM estabelecimento WHERE cd_estabelecimento = :id`,
          { id: configs.triagem_estab }
        );
        if (estRes.rows.length === 0) {
          errors.push(`Estabelecimento Padrão (cd: ${configs.triagem_estab}) não existe.`);
        }
      }

      // Validar Setor
      if (configs.triagem_setor) {
        const setRes = await conn.execute(
          `SELECT 1 FROM setor_atendimento WHERE cd_setor_atendimento = :id`,
          { id: configs.triagem_setor }
        );
        if (setRes.rows.length === 0) {
          errors.push(`Setor Padrão (cd: ${configs.triagem_setor}) não existe no TASY.`);
        }
      }

      // Validar Procedencia
      if (configs.triagem_procedencia) {
        const procRes = await conn.execute(
          `SELECT 1 FROM procedencia WHERE cd_procedencia = :id`,
          { id: configs.triagem_procedencia }
        );
        if (procRes.rows.length === 0) {
          errors.push(`Procedência (cd: ${configs.triagem_procedencia}) não existe no TASY.`);
        }
      }

      // Validar Tipo Atendimento (Dominio 12)
      if (configs.triagem_tipo_atend) {
        const tipoRes = await conn.execute(
          `SELECT 1 FROM valor_dominio WHERE cd_dominio = 12 AND vl_dominio = :id`,
          { id: String(configs.triagem_tipo_atend) }
        );
        if (tipoRes.rows.length === 0) {
          errors.push(`Tipo de Atendimento (valor: ${configs.triagem_tipo_atend}) não existe no domínio 12.`);
        }
      }

      // Validar Motivo Atendimento (Dominio 10580)
      if (configs.triagem_motivo) {
        const motRes = await conn.execute(
          `SELECT 1 FROM valor_dominio WHERE cd_dominio = 10580 AND vl_dominio = :id`,
          { id: String(configs.triagem_motivo) }
        );
        if (motRes.rows.length === 0) {
          errors.push(`Motivo de Atendimento (valor: ${configs.triagem_motivo}) não existe no domínio 10580.`);
        }
      }

      // ie_clinica de ATENDIMENTO_PACIENTE usa o domínio TASY 17,
      // não a tabela CIH_CLINICA.
      if (configs.triagem_clinica) {
        const cliRes = await conn.execute(
          `SELECT 1
             FROM valor_dominio
            WHERE cd_dominio = 17
              AND vl_dominio = :id`,
          { id: String(configs.triagem_clinica) }
        );
        if (cliRes.rows.length === 0) {
          errors.push(`Clínica (valor: ${configs.triagem_clinica}) não existe no domínio clínico do TASY.`);
        }
      }

      // A clínica precisa ser compatível com o tipo de atendimento escolhido.
      // O mesmo vínculo é exigido pelo trigger de ATENDIMENTO_PACIENTE no TASY.
      if (configs.triagem_estab && configs.triagem_clinica && configs.triagem_tipo_atend) {
        const clinicaTipoRes = await conn.execute(
          `SELECT 1
             FROM clinica_tipo_atendimento
            WHERE cd_estabelecimento = :estabelecimento
              AND ie_clinica = :clinica
              AND ie_tipo_atendimento = :tipo_atendimento
              AND NVL(ie_situacao, 'A') = 'A'
              AND ROWNUM = 1`,
          {
            estabelecimento: configs.triagem_estab,
            clinica: configs.triagem_clinica,
            tipo_atendimento: configs.triagem_tipo_atend
          }
        );
        if (clinicaTipoRes.rows.length === 0) {
          errors.push(`Clínica ${configs.triagem_clinica} não é compatível com o Tipo de Atendimento ${configs.triagem_tipo_atend} no estabelecimento ${configs.triagem_estab}.`);
        }
      }

      // Validar Filas
      const filas = [
        configs.triagem_fila_origem,
        configs.triagem_fila_destino
      ].filter(Boolean);

      for (const f of filas) {
        const fRes = await conn.execute(
          `SELECT 1 FROM fila_espera_senha WHERE nr_sequencia = :id`,
          { id: f }
        );
        if (fRes.rows.length === 0) {
          errors.push(`Fila de espera (nr_sequencia: ${f}) não existe.`);
        }
      }

      // Validar Classificações
      const classifPessoas = [
        configs.triagem_classif_nao_identificado,
        configs.triagem_classif_sem_doc
      ].filter(Boolean);

      for (const cp of classifPessoas) {
        const cpRes = await conn.execute(
          `SELECT 1 FROM classif_pessoa WHERE nr_sequencia = :id`,
          { id: cp }
        );
        if (cpRes.rows.length === 0) {
          errors.push(`Classificação de Pessoa (nr_sequencia: ${cp}) não existe no TASY.`);
        }
      }

      // Validar Classificações de Risco (Cores com correspondência de nome)
      const cores = [
        { id: configs.triagem_cor_vermelho, expectedName: 'Vermelho' },
        { id: configs.triagem_cor_amarelo, expectedName: 'Amarelo' },
        { id: configs.triagem_cor_verde, expectedName: 'Verde' },
        { id: configs.triagem_cor_azul, expectedName: 'Azul' }
      ].filter(c => c.id);

      for (const cor of cores) {
        const corRes = await conn.execute(
          `SELECT ds_classificacao FROM triagem_classif_risco WHERE nr_sequencia = :id`,
          { id: cor.id }
        );
        if (corRes.rows.length === 0) {
          errors.push(`Classificação de Risco (nr_sequencia: ${cor.id}) não existe no TASY.`);
        } else {
          const ds = corRes.rows[0].DS_CLASSIFICACAO;
          if (!ds || !ds.toUpperCase().includes(cor.expectedName.toUpperCase())) {
            errors.push(`Classificação de Risco (nr_sequencia: ${cor.id}) aponta para '${ds}' ao invés de '${cor.expectedName}'.`);
          }
        }
      }

      // Validar Motivo Inutilizacao
      if (configs.triagem_motivo_inutilizacao) {
        const miRes = await conn.execute(
          `SELECT 1 FROM motivo_inutilizacao_senha WHERE nr_sequencia = :id`,
          { id: configs.triagem_motivo_inutilizacao }
        );
        if (miRes.rows.length === 0) {
          errors.push(`Motivo Inutilização de Senha (nr_sequencia: ${configs.triagem_motivo_inutilizacao}) não existe.`);
        }
      }

      if (errors.length > 0) {
        throw new AppError(
          `Erros de validação do P.A.: ${errors.join(' ')}`,
          422,
          'TRIAGEM_CONFIG_INVALIDA',
          { errors }
        );
      }
    } finally {
      if (conn) await conn.close();
    }
  }
}

module.exports = new TriagemValidationService();
