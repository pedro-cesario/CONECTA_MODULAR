# Auditoria Técnica TASY - Identificação e Classificação (Complementar)

Este documento detalha os achados técnicos no banco de dados Oracle (TASY) para as regras de classificação de pessoas e criação de pacientes não identificados no Conecta HEAL.

---

## 1. Classificação da Pessoa (CLASSIF_PESSOA)

Foi analisada a estrutura utilizada para vincular classificações (como "Paciente não identificado" e "Paciente não apresentou identificação") ao cadastro do paciente.

### Tabela Relacional
A vinculação entre a pessoa física e a classificação ocorre na tabela **`PESSOA_CLASSIF`**.

### Parâmetros e Tipagem Encontrados

| Item | Resultado Técnico |
| :--- | :--- |
| **Tabela de vínculo** | `PESSOA_CLASSIF` |
| **Campo da pessoa** | `CD_PESSOA_FISICA` |
| **Campo da classificação** | `NR_SEQ_CLASSIF` |
| **Chave Primária (PK)** | `NR_SEQUENCIA` (Gerada pela sequence `PESSOA_CLASSIF_SEQ`) |
| **Classificações Existentes**| `1` = "Paciente não identificado"<br>`2` = "Paciente não apresentou identificação" |
| **Classificação do 410252** | Encontrado registro com `NR_SEQ_CLASSIF = 2` |
| **Data de Início/Fim** | Usa-se `DT_INICIO_VIGENCIA` e `DT_FINAL_VIGENCIA` (para histórico/inatividade). |
| **Situação / Inativação** | Quando inativo, preenche-se `DT_INATIVACAO`, `NM_USUARIO_INATIVACAO` e `DS_JUSTIF_INATIVACAO`. |
| **Procedure Oficial** | Não foi localizada procedure autônoma pública simples (ex: `INSERIR_CLASSIF`). O vínculo costuma ser feito via formulário Tasy ou via packages densas (ex: `ISH_PATIENT_PCK`). |
| **Forma recomendada** | Executar um `INSERT INTO PESSOA_CLASSIF` gerando ID via `PESSOA_CLASSIF_SEQ.NEXTVAL`, passando `CD_PESSOA_FISICA`, `NR_SEQ_CLASSIF`, `DT_INICIO_VIGENCIA = SYSDATE` e `DT_ATUALIZACAO`. |

---

## 2. Paciente Não Identificado (Criação Dinâmica)

A nova regra funcional estipula que a cada ocorrência de um paciente sem identificação, um **novo cadastro único** será criado no TASY, não utilizando mais pacientes "coringa".

### Validações Técnicas (`PESSOA_FISICA`)

1. **É possível existir mais de uma pessoa com nome "Paciente não identificado"?**
   - **SIM.** A coluna `NM_PESSOA_FISICA` não possui nenhuma restrição de unicidade (Unique Constraint). Apenas chaves como `CD_PESSOA_FISICA`, `NR_PRONTUARIO`, `NR_TRANSPLANTE` possuem validação `UNIQUE`.
2. **Constraint de impedimento?**
   - Nenhuma constraint impede múltiplos cadastros com exatamente o mesmo nome literal.
3. **Quais campos mínimos o TASY exige no INSERT?**
   - Os campos obrigatórios (`NOT NULL`) são muito limitados: Apenas a PK `CD_PESSOA_FISICA` (que deve vir da sequence de pessoa) e o `NM_PESSOA_FISICA`. Em geral, dados de auditoria (`DT_ATUALIZACAO`, `NM_USUARIO`) também devem ser informados.
4. **CPF pode ficar NULL?**
   - **SIM.** A coluna `NR_CPF` é `NULLABLE = 'Y'`.
5. **Data de Nascimento pode ficar NULL?**
   - **SIM.** A coluna `DT_NASCIMENTO` é `NULLABLE = 'Y'`.
6. **Procedure de Cadastro (INSERT vs PROC):**
   - Não há uma procedure PL/SQL simples amplamente utilizada via integração (como `CADASTRAR_PESSOA_FISICA`). O Tasy normalmente delega isso à UI. O uso de `INSERT INTO PESSOA_FISICA` direto (que o Conecta já usa hoje para coringas) é tecnicamente seguro desde que popule a sequence corretamente.
7. **Como atribuir a CLASSIF_PESSOA ao novo cadastro?**
   - Imediatamente após o `INSERT` na `PESSOA_FISICA` (recuperando o `CD_PESSOA_FISICA` retornado pela sequence), deve-se executar o `INSERT INTO PESSOA_CLASSIF` vinculando o novo paciente à classificação `1` ("Paciente não identificado").
8. **Fluxo nativo para unificação/identificação posterior:**
   - **SIM.** O TASY possui uma funcionalidade nativa nas telas assistenciais e de recepção ("Unificar Pessoa Física"). O Serviço Social ou Recepção descobre a verdadeira identidade do paciente, cadastra a pessoa real (ou localiza o cadastro antigo real do paciente no banco) e unifica a pessoa temporária com a definitiva. Não é necessário reconstruir esse processo no módulo Triagem P.A.

---

## 3. Cores da Triagem (Escala de Risco)

Os domínios cadastrados atualmente na tabela `TRIAGEM_CLASSIF_RISCO` do TASY de Homologação (com `CD_ESTABELECIMENTO = 1` e `IE_SITUACAO = 'A'`) são exatamente:

- `1` = Vermelho (`#DA2935`)
- `2` = Laranja (`#E86C00`)
- `3` = Amarelo (`#E3A600`)
- `4` = Verde (`#00BA2F`)
- `5` = Azul (`#0096ED`)
- `6` = Branco (`#FFFFFF`)

Para a nova interface da Triagem P.A., o front-end deverá utilizar os IDs 1, 3, 4 e 5, enviando este valor exato ao backend (que o salvará em `ATENDIMENTO_PACIENTE.NR_SEQ_TRIAGEM`), garantindo sincronia perfeita com as parametrizações oficiais do banco e triggers subsequentes.

