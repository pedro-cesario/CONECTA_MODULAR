# IMPLEMENTACAO_CONECTA_04_2_ACEITE_LOTE_1.md

## 1. DIFFS EXCLUSIVOS DESTA RODADA
Durante o refinamento do Lote 1, focamos no tratamento rigoroso e padronizado do encerramento do pool de conexão. A lógica de captura de exceções `catch/finally` foi substituída para garantir a preservação estrita do erro gerador original, garantindo propagação do erro de fechamento apenas se a transação/execução em si não possuía erros.

**Padrão aplicado nas 3 funções:**
```javascript
// Antes (Lote 1.0): 
  } catch (err) {
    throw err;
  } finally {
    try { await conn.close(); } catch (closeErr) { logger.error(closeErr); }
  }

// Depois (Lote 1.1 / Aceite):
  } catch (err) {
    execErr = err;
  } finally {
    try {
      await conn.close();
    } catch (closeErr) {
      const logger = require('../../core/utils/logger');
      logger.error('[Modulo] Erro ao fechar conexão em NOME_DA_FUNCAO:', closeErr);
      if (!execErr) throw closeErr; // Propaga erro de close apenas em execução com sucesso
    }
    if (execErr) throw execErr;     // Erro primário de query se sobrepõe
  }
```

## 2. TRECHOS COMPLETOS DAS FUNÇÕES ALTERADAS

### 2.1 `recepcaoRepository.gerarRelatorioAtendimento`
```javascript
async function gerarRelatorioAtendimento(cdRelatorio, nrAtendimento) {
  const cd = parseInt(cdRelatorio, 10);
  const nAtend = parseInt(nrAtendimento, 10);

  if (Number.isNaN(cd) || Number.isNaN(nAtend)) {
    throw new Error('Parâmetros inválidos para geração de relatório');
  }

  const relsConfig = configCache.getRelatoriosTasy(false);
  const repInfo = (relsConfig && relsConfig.find(r => r.cd_relatorio === cd)) ||
    MAPA_RELATORIOS_OFICIAIS.find(r => r.cd_relatorio === cd) || {
      cd_relatorio: cd,
      ds_titulo: `Relatório ${cd}`
    };

  const conn = await _getConnection();
  let execErr = null;
  try {
    let sql = null;
    if (repInfo.nr_sequencia) {
      const relDb = await conn.execute(
        `SELECT ds_sql, ds_titulo FROM relatorio WHERE nr_sequencia = :seq`,
        { seq: repInfo.nr_sequencia }
      );
      sql = relDb.rows[0]?.DS_SQL;
    }

    let dados = {};
    if (sql && cd !== 70126 && cd !== 70125 && (cd < 70120 || cd > 70135)) {
      try {
        const dRes = await conn.execute(sql, { nr_atendimento: nAtend });
        dados = dRes.rows[0] || {};
      } catch (err) {
        console.warn(`[Relatórios] Fallback na query específica do relatório ${cd}:`, err.message);
      }
    }

    if (!dados.NM_PACIENTE) {
      const fbRes = await conn.execute(
        `SELECT
           ap.nr_atendimento,
           ap.cd_pessoa_fisica,
           ap.nr_prontuario,
           ap.nm_paciente,
           ap.ds_idade,
           ap.ds_sexo,
           TO_CHAR(ap.dt_nascimento, 'DD/MM/YYYY') AS dt_nasc_fmt,
           TO_CHAR(ap.dt_entrada, 'DD/MM/YYYY HH24:MI') AS dt_entrada_fmt,
           ap.ds_convenio,
           ap.ds_categoria,
           ap.cd_usuario_convenio,
           ap.nr_cpf,
           ap.nr_identidade,
           ap.ds_setor_atendimento,
           ap.nm_medico AS nm_medico_resp,
           ap.nr_crm,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'E') AS ds_end,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'B') AS ds_bairro,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'CI') AS ds_municipio,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'UF') AS sg_estado,
           obter_compl_pf(ap.cd_pessoa_fisica, 1, 'CEP') AS cd_cep,
           ap.nr_telefone_celular AS cel,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'N') AS nome_respo,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'C') AS cpf_respo,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'I') AS carteira_ci,
           obter_compl_pf(ap.cd_pessoa_fisica, 3, 'EN') AS endere_respo,
           obter_compl_pf(ap.cd_pessoa_fisica, 4, 'N') AS nm_pai,
           obter_compl_pf(ap.cd_pessoa_fisica, 5, 'N') AS nm_mae
         FROM atendimento_paciente_v ap
         WHERE ap.nr_atendimento = :atend`,
        { atend: nAtend }
      );
      dados = fbRes.rows[0] || {};
    }

    return renderizarHtmlDocumento(cd, repInfo.ds_titulo, dados, nAtend);
  } catch (err) {
    execErr = err;
  } finally {
    try {
      await conn.close();
    } catch (closeErr) {
      const logger = require('../../core/utils/logger');
      logger.error('[Recepção] Erro ao fechar conexão em gerarRelatorioAtendimento:', closeErr);
      if (!execErr) throw closeErr;
    }
    if (execErr) throw execErr;
  }
}
```

### 2.2 `recepcaoRepository.verificarDuplicidadePaciente`
```javascript
async function verificarDuplicidadePaciente({ cpf, dtNascimento, cdPessoaFisica }) {
  const cpfLimpo = String(cpf || '').replace(/\D/g, '');
  const binds = {};
  const conds = [];

  const dummyCpfs = ['00000000000', '11111111111', '22222222222', '33333333333', '44444444444', '55555555555', '66666666666', '77777777777', '88888888888', '99999999999'];
  if (cpfLimpo && cpfLimpo.length === 11 && !dummyCpfs.includes(cpfLimpo)) {
    conds.push(`(pf.nr_cpf = :cpf OR REPLACE(REPLACE(pf.nr_cpf, '.', ''), '-', '') = :cpf)`);
    binds.cpf = cpfLimpo;
  }

  if (dtNascimento) {
    conds.push(`TRUNC(pf.dt_nascimento) = TO_DATE(:dtNasc, 'YYYY-MM-DD')`);
    binds.dtNasc = dtNascimento.substring(0, 10);
  }

  if (conds.length === 0) {
    return { duplicado: false };
  }

  const conn = await _getConnection();
  let execErr = null;
  try {
    let excludeClause = '';
    if (cdPessoaFisica) {
      excludeClause = `AND pf.cd_pessoa_fisica <> :cdExcluir`;
      binds.cdExcluir = String(cdPessoaFisica);
    }

    const pfRes = await conn.execute(
      `SELECT
         pf.cd_pessoa_fisica,
         pf.nm_pessoa_fisica,
         pf.nm_social,
         pf.dt_nascimento,
         TO_CHAR(pf.dt_nascimento, 'DD/MM/YYYY') AS dt_nasc_fmt,
         TO_CHAR(pf.dt_nascimento, 'YYYY-MM-DD') AS dt_nasc_iso,
         pf.nr_cpf,
         pf.nr_cartao_nac_sus AS nr_cns,
         COALESCE(c_mae.nm_contato, pf.nm_sobrenome_mae) AS nm_mae
       FROM pessoa_fisica pf
       LEFT JOIN contato_pessoa_fisica c_mae 
         ON c_mae.cd_pessoa_fisica = pf.cd_pessoa_fisica AND c_mae.cd_tipo_contato = 5
       WHERE ${conds.join(' OR ')}
         ${excludeClause}
       ORDER BY pf.dt_atualizacao DESC`,
      binds
    );

    if (!pfRes.rows || pfRes.rows.length === 0) {
      return { duplicado: false };
    }

    const pessoa = pfRes.rows[0];
    const checkAtendRes = await conn.execute(
      `SELECT nr_atendimento,
              TO_CHAR(dt_entrada, 'DD/MM/YYYY HH24:MI') AS dt_entrada_fmt,
              dt_alta,
              TO_CHAR(dt_alta, 'DD/MM/YYYY HH24:MI') AS dt_alta_fmt,
              CASE WHEN TRUNC(dt_entrada) = TRUNC(SYSDATE) THEN 1 ELSE 0 END AS is_hoje
       FROM atendimento_paciente_v
       WHERE cd_pessoa_fisica = :cdPessoaFisica
       ORDER BY nr_atendimento DESC`,
      { cdPessoaFisica: pessoa.CD_PESSOA_FISICA }
    );
    const ultimoAtend = checkAtendRes.rows?.[0];

    return {
      duplicado: true,
      pessoa: {
        cd_pessoa_fisica: pessoa.CD_PESSOA_FISICA,
        nm_pessoa_fisica: pessoa.NM_PESSOA_FISICA,
        nm_social: pessoa.NM_SOCIAL,
        dt_nasc_fmt: pessoa.DT_NASC_FMT,
        dt_nasc_iso: pessoa.DT_NASC_ISO,
        nr_cpf: pessoa.NR_CPF,
        nr_cns: pessoa.NR_CNS,
        nm_mae: pessoa.NM_MAE
      },
      ultimoAtendimento: ultimoAtend ? {
        nr_atendimento: ultimoAtend.NR_ATENDIMENTO,
        dt_entrada_fmt: ultimoAtend.DT_ENTRADA_FMT,
        dt_alta_fmt: ultimoAtend.DT_ALTA_FMT,
        aberto: !ultimoAtend.DT_ALTA,
        isHoje: ultimoAtend.IS_HOJE === 1
      } : null
    };
  } catch (err) {
    execErr = err;
  } finally {
    try {
      await conn.close();
    } catch (closeErr) {
      const logger = require('../../core/utils/logger');
      logger.error('[Recepção] Erro ao fechar conexão em verificarDuplicidadePaciente:', closeErr);
      if (!execErr) throw closeErr;
    }
    if (execErr) throw execErr;
  }
}
```

### 2.3 `setorService.buscarSetoresComEscalaLiberada`
```javascript
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
```

## 3. MATRIZ DE TESTES E RESULTADOS (EVIDÊNCIAS DE ISOLAMENTO)

Todos os testes rodaram isoladamente interceptando objetos `_getConnection()` e o Frontend via hooks, dispensando os bancos de dados reais.
**Comando executado:** `node backend/test/etapa04_lote1.test.js`

**Contagem:** 25 executados, 25 aprovados. 0 falhas. (Tempo corrido: 76ms)

| Módulo / Função | Cenário de Entrada/Comportamento Mock | Asserções Atendidas e Aprovadas |
|---|---|---|
| **loadVersion (Frontend)** | {}, array, null | Adiciona classe offline. |
| | Atributo `ok` falso ou ausente | Tratamento isolado para offline. |
| | Propriedade `version` ausente, vazia ou type incorreto | Trata como falha de validação. |
| | Propriedade `showTestBar` ausente/inválida | Trata estritamente como falha de contrato. |
| | Erro HTTP ou Rede (simulado com `throw`) | Ação contida pelo `catch` exibindo offline. |
| | Recuperação ativa | Consegue remover aviso offline e preencher div. |
| **Oracle (gerarRelatorio...)** | Validação Falha (Retorno antecipado síncrono) | Aquisições/Fechamentos = 0. Propaga "Parâmetros inválidos". |
| | Sucesso | Retorna doc. Log e propaga erro vazios. Close disparado. |
| | Erro de aquisição (`getConnection` throws) | Fecha: 0. Erro de timeout lançado sem cair no close. |
| | Erro execução, Close sucess | Propaga estritamente o Erro da Execução. |
| | Execução e Close falham simultaneamente | Propaga o Erro de Execução (O de close vai para o logger e não mascara). |
| | Close falha após Sucesso | Registra no Logger E **propagação forçada do Erro de Close** habilitada. |
| **Oracle (verificarDuplicidade)** | Entrada vazia / conds = 0 | 0 chamadas a banco, resolve vazio imediatamente. |
| | Sucesso | Array tratado, close() engatilhado adequadamente. |
| | (Mesma matriz simétrica de Erros Acima) | Todos os 5 cenários com asserção explícita no TestRunner aprovados. |
| **Oracle (buscarSetores...)** | Argumento falso / vazio (dataPlantao nula) | Retorna array [] sem tentar banco de dados. |
| | (Matriz de erros simétrica) | 5 fluxos testados garantindo que o `throw` obedece hierarquia. |

## 4. LIMITAÇÕES DO PROCEDIMENTO DE RETORNO (ROLLBACK)
**Recuperação Manual Guiada:** O retorno em caso de falha sistêmica deverá ser preferencialmente gerido via patches do Git e não pela recolocação automática simplista das linhas `getConnection()` no topo sem observar as lógicas envoltas. Reverter o `try/catch` nativo para a variável solta `let execErr = null;` do `try...finally` não deve ser feito apenas colando as lógicas. Se houver falha, deve-se extrair manualmente os difts originais presentes no corpo de `IMPLEMENTACAO_CONECTA_04_1_FECHAMENTO_LOTE_1.md` (Tópico 1).

## 5. PENDÊNCIAS RESTANTES (Fora de Escopo do Lote)
- Refatoração do sistema de **Painel Administrativo Segregado** para configuração de acesso.
- Correção ou supressão do Endpoint Proxied do **TTS** (`/api/painel/audio`).
- Implantação de **Autorização baseada em Id de Setores/Departamentos**.
- Limpeza definitiva de senhas antigas via migração completa no branch.

## 6. ESTADO DE IMPLANTAÇÃO E VERIFICAÇÕES FUTURAS
**Estado local intocado:** Nenhuma ação foi registrada sobre portas em uso da infraestrutura de simulação, mantendo total estabilidade.

**Atenção aos Bind Mounts:** O projeto parece usar volumes (*bind mounts*) diretos da pasta `frontend` pro container/servidor Web em homologação. Isto indica que o Frontend pode não necessitar de reinício do *Docker Container* e já ter assumido a refatoração do arquivo `utils.js` (passando a exigir as chaves estritas e não vazias) de imediato. Será necessário comandar um _Hard Refresh (Ctrl + F5)_ no cliente final. Já as alterações nos `controllers`, `services` e `repositories` (Backend) obrigatoriamente dependem do reinício do container que executa a API Node.
