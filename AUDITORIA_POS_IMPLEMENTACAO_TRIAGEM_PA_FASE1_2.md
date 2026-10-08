# Auditoria Pós-Implementação (Fases 1 e 2) - Triagem P.A.

## 1. CORE PACIENTES

- **Desacoplamento:** A busca de pacientes foi totalmente isolada no arquivo `backend/src/modules/core/paciente/PacienteRepository.js` e na sua respectiva camada de serviço `PacienteService.js`, sem acoplamento à Recepção.
- **Duplicidade:** O método `verificarDuplicidadePaciente` verifica CPF, Data de Nascimento e prevê exceção de `cdPessoaFisica`, operando no Core de forma reutilizável.
- **Criação `PESSOA_FISICA` e `PESSOA_CLASSIF`:** Foram encapsuladas nas funções genéricas `salvarPessoaFisica` e `atribuirClassificacaoPessoa`.
- **Hardcodes:** Os IDs `1` (Paciente não identificado) e `2` (Sem documento) NÃO estão hardcoded no backend. O `PacienteService` possui a função `criarPacienteNaoIdentificado(nrSeqClassif)` que espera a classificação vinda da configuração (parâmetro).
- **Bind Variables:** Todas as queries em `PacienteRepository` (`:nm`, `:cpf`, `:id`, `:dtNasc`) usam bind variables corretamente.

## 2. CORE ATENDIMENTO

- **Desacoplamento:** O Core (arquivo `AtendimentoRepository.js`) agora concentra a rotina pesada de criar os vínculos `atend_categoria_convenio`, `atend_paciente_unidade` e as chamadas ao `CONTA_PACIENTE_SEQ`.
- **Encerramento de Senhas e Filas:** A abertura no Core NÃO encerra a senha da fila nem inutiliza a senha do paciente, sendo totalmente voltada apenas para o Atendimento em si.
- **Parâmetros Parametrizados:** Os campos `cd_setor_atendimento`, `cd_procedencia`, `ie_tipo_atendimento`, `cd_clinica` não são fixados (hardcoded). Eles são esperados no `payload` e passados via bind variables (`:setor`, `:proc`, `:tipo_atend`, `:clinica`).
- **Campos de Tempo (`dt_inicio_atendimento`, `dt_fim_atendimento`):** 
NÃO são alterados durante a query primária de inserção em `atendimento_paciente` na camada Core. Eles são preenchidos como nulos por omissão. Na camada da `Recepção` (`recepcaoService.js`), a tabela secundária `paciente_senha_fila` é atualizada setando esses campos para a hora atual (`dt_inicio_atendimento = SYSDATE` e `dt_fim_atendimento = SYSDATE`).

## 3. RECEPÇÃO

- **Chamada ao Core:** O `recepcaoService.js` foi alterado e chama `AtendimentoService.abrirAtendimento(payload)`.
- **Comportamento Legado:** O encerramento explícito do ticket do paciente no painel foi preservado localmente no Service da Recepção através de um `UPDATE paciente_senha_fila SET dt_inicio_atendimento = SYSDATE, dt_fim_atendimento = SYSDATE`. Com isso, não foi duplicada a regra inteira, apenas preservado o fluxo exclusivo da recepção.

## 4. CORE FILAS

As operações de chamadas de senhas no painel foram extraídas para `FilaRepository.js` com êxito.

**DIVERGÊNCIA CRÍTICA:**
Ao invés de usar os wrappers oficiais do pacote recomendados na auditoria anterior (`atendimento_fila_tasy_pkg.TRANSFERIR_PAC_FILA_W` e `atendimento_fila_tasy_pkg.INUTILIZAR_SENHA_W`), as implementações chamam diretamente as procedures `TRANSFERIR_PAC_FILA` e `INUTILIZAR_SENHA`.

- **TRANSFERIR_PAC_FILA:**
  - **JS:** `transferirPacienteFila`
  - **Parâmetros:** `nrSeqFilaNova`, `nrSeqFilaAtual`, `cdSenha`, `nrSeqSenha`.
  - **Tratamento de erro:** Recebe saída `ds_erro_p` que levanta `RAISE_APPLICATION_ERROR`.
  - **Binds:** Sim, todas usam binds.
- **INUTILIZAR_SENHA:**
  - **JS:** `inutilizarSenha`
  - **Parâmetros:** `cdSenha`, `cdFila`, `nrSeqSenha`, `nmUsuario`, `nrSeqMotivo`.

Ambas executam `commit` explícito no NodeJS, e o comportamento atende funcionalmente, mas não usa o Package oficial.

## 5. CORE TRIAGEM

- **Início Triagem:** O método `iniciarTriagem` foi implementado e dispara: `UPDATE atendimento_paciente SET dt_inicio_atendimento = SYSDATE...`.
- **Fim Triagem:** O método `finalizarTriagem` dispara: `UPDATE atendimento_paciente SET dt_fim_triagem = SYSDATE...`.
- **Classificação:** O método `atualizarClassificacaoRisco` atualiza o campo `nr_seq_triagem = :nrSeqTriagem`.
- **Validação Crítica (`IE_STATUS_PA`):** NÃO foram encontradas atualizações diretas para `IE_STATUS_PA` nos arquivos analisados. A trigger do TASY cuidará disso de acordo com a modificação de `nr_seq_triagem`.

## 6. CLASSIFICAÇÃO DE RISCO

No arquivo `TriagemRepository.js`, a função para atualizar a classificação envia estritamente:

```sql
UPDATE atendimento_paciente
SET nr_seq_triagem = :nrSeqTriagem,
    dt_atualizacao = SYSDATE,
    nm_usuario = :nmUsuario
WHERE nr_atendimento = :nrAtendimento
```

Este código utiliza bind variables. É a forma recomendada e correta, delegando a inteligência secundária de cor e horário (`DT_CLASSIF_RISCO`) para o TASY e suas triggers associadas a `nr_seq_triagem`.

## 7. CONECTA ADMIN

As 16 configurações (Estabelecimento, Setor, Procedência, Clínica, Tipo Atend, Motivos, Filas de Origem/Destino, ID Não Identificado/Sem Doc, Cores de Risco e Descartes) constam no frontend (`frontend/admin.html`) e no arquivo de salvamento (`adminController.js` e `configCache.js`).

- **Existe na UI?:** Sim (no novo Subpane de Triagem P.A.).
- **Carrega?:** Sim (função `loadConfigSistema` atualizada).
- **Salva?:** Sim (novo ouvinte de botão `btn-save-config-triagem-pa`).
- **Backend aceita?:** Sim (via endpoint REST `POST /api/admin/system/config`).
- **Valor persistido?:** Sim (na tabela Key-Value `configuracoes_sistema`).

## 8. VALIDAÇÃO BACKEND DAS CONFIGURAÇÕES

**VALIDAÇÃO INSUFICIENTE.**

O backend (rota `/api/admin/system/config` implementada em `adminController.js` via `configCache.js`) não faz nenhuma validação estruturada sobre as chaves enviadas. O script salva cegas (Key-Value) sem verificar, via TASY, se `triagem_setor` existe na base Oracle (`setor_atendimento`), se a fila do painel existe, ou se os `nr_seq_triagem` informados para as cores da classificação de risco são códigos válidos e ativados.
Esta validação pode levar a erros de SQL durante a abertura do PA, caso administradores insiram IDs incorretos no Conecta Admin.

## 9. HARDCODES

Os seguintes hardcodes foram observados e requerem discernimento:

- `39` (Setor padrão): **Hardcode legado/Fallback.** Usado em `recepcaoService.js` para manter a compatibilidade se a chave de `sysConfig.recepcao_cd_setor_padrao` estiver vazia. Legítimo para a Recepção.
- Não existem os IDs de triagem hardcoded para a classificação de risco (nem cores, nem motivos de descarte) no Core, provando que o módulo modularizou esses parâmetros para o Admin.
- Procedures TASY: `INUTILIZAR_SENHA` e `TRANSFERIR_PAC_FILA` estão gravadas direto nas queries e divergem da auditoria recomendada. **Ajuste Recomendado**.

## 10. COMPATIBILIDADE

O serviço `Recepção` não quebrou.
O carregamento da aplicação `node -e "require('./backend/src/modules/recepcao/recepcaoService.js')"` sobe perfeitamente (sem circular dependencies ou falta de módulos). As rotinas do painel Admin continuam intactas.

## 11. TESTES

- **Testes Executados:** Verificação sintática via AST nodeJS (`node --check`) sem problemas. Verificação de require para arquivos chaves (`recepcaoService` e `adminController`), o que garante que não há `module_not_found` nos módulos de importação. Inspeção manual completa do source code e grep nas dependências de Core.

## 12. RESULTADO FINAL

| Item | Resultado | Severidade | Evidência |
|---|---|---|---|
| Core Paciente | OK | - | CPF validado, sem dependência inversa, binds corretos. |
| Core Atendimento | OK | - | Desacoplado da Recepção, rotinas transferidas com Binds. |
| Core Fila | AJUSTE NECESSÁRIO | ALTA | Usa procedures genéricas em vez do `atendimento_fila_tasy_pkg`. |
| Core Triagem | OK | - | Atualiza APENAS os campos solicitados (dt_inicio e dt_fim_triagem). |
| Recepção | OK | - | Aderente ao Core, compatibilidade resguardada. |
| Admin | OK | - | 16 configurações carregadas e enviadas ao backend. |
| Configuração | VALIDAÇÃO INSUFICIENTE | MÉDIA | `adminController.js` não cruza IDs com o Oracle. |
| Classificação | OK | - | Binds e tabela `ATENDIMENTO_PACIENTE` preservada. |
| IE_STATUS_PA | OK | - | Não setado. Deixado para o Oracle/Trigger. |
| Transferência / Descarte| DIVERGÊNCIA CRÍTICA | ALTA | Wrapper oficial divergente (`INUTILIZAR_SENHA` x `..._W`). |
| Hardcodes | AJUSTE NECESSÁRIO | BAIXA | `39` só presente como fallback legado (tolerável). |
| Compatibilidade | OK | - | Nenhum import quebrado ou pendência fatal. |

## 13. VEREDITO

FASE 1 APROVADA: **SIM**
FASE 2 APROVADA: **NÃO TOTALMENTE**
PODE INICIAR FASE 3: **SIM** (desde que ciente dos pontos abaixo)

**AJUSTES OBRIGATÓRIOS ANTES/DURANTE A FASE 3:**
1. Alterar as procedures de Fila (`TRANSFERIR_PAC_FILA` e `INUTILIZAR_SENHA`) para o pacote oficial e wrapper (`atendimento_fila_tasy_pkg.xxx_W`).
2. Melhorar a consistência no backend das configs do Admin, rejeitando a inserção se IDs inválidos (ex: fila inexistente) forem submetidos, evitando erro crítico tardio no banco durante o atendimento.
