# Auditoria Técnica TASY - Integração Triagem P.A. (FASE 0)

Este documento apresenta os resultados da auditoria técnica focada na integração entre o Conecta HEAL e o sistema TASY/Oracle para o módulo de Triagem P.A. As informações aqui contidas foram validadas lendo diretamente o dicionário de dados (Data Dictionary) e o código PL/SQL das procedures e triggers do Oracle (TASY).

---

## 1. Classificação e Cor (NR_SEQ_TRIAGEM)

**Fluxo Correto do TASY:**
A coluna `NR_SEQ_TRIAGEM` na tabela `ATENDIMENTO_PACIENTE` determina a classificação de risco (e consequentemente, a cor).

**Papel Real de NR_SEQ_TRIAGEM:**
- É uma Foreign Key (FK) apontando para a tabela `TRIAGEM_CLASSIF_RISCO.NR_SEQUENCIA`.
- A tabela `TRIAGEM_CLASSIF_RISCO` contém a cor real configurada (`DS_COR_HTML`, `DS_CLASSIFICACAO`, etc). Por exemplo: Azul, Verde, Amarelo, Laranja, Vermelho, Branco.
- **Evidência:** Há uma constraint `ATEPACI_TRICLRI_FK` entre `ATENDIMENTO_PACIENTE.NR_SEQ_TRIAGEM` e `TRIAGEM_CLASSIF_RISCO.NR_SEQUENCIA`.
- **Comportamento via Trigger:** Quando `NR_SEQ_TRIAGEM` é alterado, a trigger de banco `ATENDIMENTO_PACIENTE_UPDATE` intercepta o evento, atualiza o campo `:new.dt_classif_risco := sysdate` e realiza um insert automático na tabela `LOG_PRIORIDADE_ATEND` para manter o histórico de reclassificação.
- **Ação Conecta:** O Conecta DEVE atualizar o campo `NR_SEQ_TRIAGEM` com o ID correto da classificação. O banco cuidará do log e da data de reclassificação automaticamente.

---

## 2. Status Assistencial (IE_STATUS_PA)

**Papel Real de IE_STATUS_PA:**
- O campo `IE_STATUS_PA` em `ATENDIMENTO_PACIENTE` **NÃO DEVE** ser atualizado manualmente via `UPDATE ... SET IE_STATUS_PA = 'XX'`.
- Ele é uma propriedade computada por triggers de banco baseada em eventos de data e hora do fluxo de pronto atendimento.

**Fluxo Correto:**
A trigger `ATENDIMENTO_PACIENTE_UPDATE` avalia o preenchimento de campos de data e sobrescreve o `IE_STATUS_PA`. O mapeamento oficial (extraído da trigger) é:

| Campo de Data Alterado no UPDATE | IE_STATUS_PA Definido Automaticamente pela Trigger | Significado (Inferido) |
| :--- | :--- | :--- |
| `dt_alta` | `AL` | Alta |
| `dt_lib_medico` | `LM` | Liberação Médica |
| `dt_medicacao` | `PA` | Procedimento/Medicação |
| `dt_fim_consulta` | `FC` | Fim Consulta |
| `dt_atend_medico` | `IC` | Início Consulta (Atend. Médico) |
| `dt_chamada_paciente` | `CP` | Chamada Paciente |
| `dt_fim_triagem` | `FT` | Fim Triagem |
| `dt_inicio_atendimento` | `TR` | Início Atendimento (Triagem) |
| `dt_reavaliacao_medica` | `RM` | Reavaliação Médica |
| `dt_liberacao_enfermagem`| `LE` | Liberação Enfermagem |

**Ação Conecta:** Para iniciar a triagem e mudar o status para 'TR', o Conecta deve atualizar `DT_INICIO_ATENDIMENTO = SYSDATE`. Para finalizar, deve atualizar `DT_FIM_TRIAGEM = SYSDATE` (mudando para 'FT'). A procedure interna `gravar_atend_status_pa` é chamada pela trigger automaticamente.

---

## 3. Gestão de Fila e Movimentação (PACIENTE_SENHA_FILA)

**Permanência na Fila durante a Triagem:**
- Durante a triagem, o paciente não deve sair da fila (`nr_seq_fila_senha` não muda). O atendimento é apenas marcado como iniciado (`dt_inicio_atendimento` em `atendimento_paciente` e/ou `dt_inicio_atendimento` em `paciente_senha_fila`).

**Movimentação ao Final (Transferência):**
- **Solução Descoberta:** Existe a procedure oficial do TASY chamada `TRANSFERIR_PAC_FILA`.
- Ela aceita os parâmetros: `nr_seq_fila_nova_p`, `nr_seq_fila_atual_p`, `nr_seq_senha_p`.
- A procedure atualiza o registro em `PACIENTE_SENHA_FILA` para a nova fila e insere um registro em `PACIENTE_SENHA_TRANSF_HIST`.
- **Ação Conecta:** Para transferir a senha para a fila médica após o fim da triagem, o Conecta deve executar a procedure `TRANSFERIR_PAC_FILA`.

---

## 4. Descarte / Inutilização de Senha

**Fluxo Correto:**
- **Solução Descoberta:** O TASY possui uma procedure oficial para este fim chamada `INUTILIZAR_SENHA(cd_senha_p, cd_fila_p, nr_seq_senha_p, nm_usuario_p, nr_seq_motivo_inutilizacao_p)`.
- Ela atualiza a `PACIENTE_SENHA_FILA` setando `dt_inutilizacao = sysdate` e zera as datas de atendimento.
- Além disso, ela deleta os registros órfãos na tabela associativa `atendimentos_senha` e atualiza `atendimento_paciente.ie_chamado = 'X'`.
- **Ação Conecta:** NUNCA fazer `UPDATE` direto para descartar senha. Chamar sempre a procedure `INUTILIZAR_SENHA`.

---

## 5. Condição de Identificação do Paciente

**Análise:**
- Buscamos por colunas de condição, desconhecido ou flag de identificação nas tabelas `ATENDIMENTO_PACIENTE` e `PESSOA_FISICA`.
- **Resultado:** **NÃO FOI POSSÍVEL DETERMINAR UMA COLUNA EXPLÍCITA PELO DICIONÁRIO DO TASY**.
- Não há um campo booleano nativo (ex: `ie_paciente_identificado`) diretamente associado.
- No padrão TASY, pacientes não identificados geralmente são cadastrados na `PESSOA_FISICA` de forma avulsa (ex: Nome = "Desconhecido") e posteriormente resolvidos via rotina de "Unificar Pessoa".
- **Ação Conecta:** Se o módulo Triagem P.A. do Conecta exigir a diferenciação em tela de "Paciente Identificado" vs "Paciente Não Identificado" (antes da abertura da ficha/cadastro Tasy pleno), essa propriedade deverá ser salva no próprio banco de dados do Conecta (PostgreSQL) ou utilizando um campo de texto livre / observação provisório.

---

## 6. Estado Atual x Fluxo Desejado (Integração)

| Recurso | Estado Atual (Legado/Tasy) | Fluxo Desejado (Conecta Nativo) |
| :--- | :--- | :--- |
| **Classificação/Cor** | Desconhecido ou manipulado via TASY frontend. | `UPDATE ATENDIMENTO_PACIENTE SET NR_SEQ_TRIAGEM = ?` |
| **Status (TR, FT, etc)** | Tasy atualizava datas. | `UPDATE ATENDIMENTO_PACIENTE SET DT_INICIO_ATENDIMENTO / DT_FIM_TRIAGEM = SYSDATE` |
| **Descarte de Senha** | - | Call `INUTILIZAR_SENHA` |
| **Mover Fila após Triagem** | - | Call `TRANSFERIR_PAC_FILA` |
| **Log de Classificação** | - | Gerado automaticamente pela Trigger `ATENDIMENTO_PACIENTE_UPDATE`. Nenhuma ação extra é necessária pelo Conecta. |

---

## 7. Semáforo Técnico TASY (Riscos e Alertas)

- 🟢 **VERDE:** **Status Assistencial (`IE_STATUS_PA`).** O mapeamento das triggers esclareceu o mecanismo. É seguro atualizar as colunas de data (`dt_inicio_atendimento`, `dt_fim_triagem`).
- 🟢 **VERDE:** **Movimentação de Fila / Descarte.** As procedures oficiais `TRANSFERIR_PAC_FILA` e `INUTILIZAR_SENHA` foram mapeadas, lidas e validadas. São seguras para consumo no módulo.
- 🟡 **AMARELO:** **Paciente Não Identificado.** Não existe coluna simples para isso nativamente. Pode exigir fluxo de cadastro "Dummy" ou controle 100% no banco PostgreSQL do Conecta. Necessita alinhamento funcional na especificação.
- 🔴 **VERMELHO:** N/A nesta fase, bloqueios de integração resolvidos com a leitura correta das procedures e triggers.

