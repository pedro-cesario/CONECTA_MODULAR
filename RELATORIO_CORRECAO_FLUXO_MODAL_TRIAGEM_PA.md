# 1. Resumo

Foram corrigidas as regressões do fluxo da Triagem P.A. sem alterar regras clínicas, TASY, classificação, rascunho ou finalização. A correção separa a confirmação pré-atendimento das etapas clínicas, remove a confirmação nativa do navegador para paciente não identificado e corrige a validação/persistência das configurações oficiais `triagem_*`.

# 2. Erro de configuração do atendimento

A consulta à base de configurações local encontrou ausência dos oito registros obrigatórios: `triagem_estab`, `triagem_setor`, `triagem_procedencia`, `triagem_clinica`, `triagem_tipo_atend`, `triagem_motivo`, `triagem_fila_origem` e `triagem_fila_destino`.

O serviço antes retornava uma mensagem genérica e aplicava `1` como fallback para clínica. Agora valida todos os campos oficiais antes de abrir o atendimento, considera inválidos `null`, `undefined`, string vazia e `"0"`, não aplica fallback e devolve a lista exata de chaves ausentes no erro `TRIAGEM_CONFIG_INCOMPLETA`.

Na validação do ambiente em 08/10/2026, os oito registros estavam ausentes (`0/8`). O container ativo ainda executava a versão anterior, o que explicava a mensagem genérica vista no navegador; ele foi reiniciado para carregar a correção. A ausência de configuração agora retorna `422` (erro de validação), e não `500`. O atendimento só poderá ser iniciado após salvar no Admin os valores TASY reais — não foram inseridos valores inferidos ou hardcoded.

# 3. Chaves Admin encontradas

A tela administrativa já utiliza os oito nomes oficiais com prefixo `triagem_`. Foi identificado que o controller administrativo chamava `TriagemValidationService` sem importá-lo, impedindo a validação/salvamento das configurações da Triagem P.A.

O import foi restaurado. O salvamento agora combina os valores enviados com a configuração persistida, valida a presença dos oito campos e então valida as referências TASY existentes. A tela também marca os campos como obrigatórios e impede envio de valores vazios ou `0`.

# 4. Correção /api/triagem-pa/iniciar

`TriagemPaService.iniciarAtendimentoTriagem` passou a ler exclusivamente as chaves `triagem_*` através de uma função única de configuração obrigatória. Com configuração válida, o fluxo continua usando os valores persistidos; sem configuração, a falha é explícita e orienta o preenchimento no Admin, sem hardcode.

Foi validado em teste de serviço que a ausência informa as oito chaves e que valores válidos são relidos corretamente.

Após a configuração dos oito campos, o log expôs uma segunda falha de início: o atendimento era criado com `cd_medico_resp = 1`, valor fixo inexistente no TASY. A Triagem agora resolve o médico configurado em `triagem_medico_resp` ou, por compatibilidade, em `recepcao_cd_med_resp`. No ambiente, foi validado o médico ativo `408120` e o convênio configurado `3`; não há mais médico fixo no payload de abertura.

Foi acrescentada uma pré-validação de abertura antes de qualquer `INSERT`: médico ativo, unidade ativa no setor e compatibilidade entre clínica/tipo de atendimento. A análise do trigger TASY mostrou que `ie_clinica` é controlado pelo domínio 17, não por `CIH_CLINICA`; a validação e o Admin foram ajustados para essa fonte. No ambiente, o par configurável e validado para Tipo `3` é Clínica `5 — Psiquiátrica`. Configuração incompatível retorna `422 TRIAGEM_CONFIG_INCOMPATIVEL`, sem criar atendimento e sem retornar 500.

# 5. Correção /api/dashboard/internacao/detalhes

A causa inicial no repositório era a montagem de `IN (?)` junto de um bind nomeado `:nr_atendimento`. Oracle não aceita esse placeholder estilo `?` nesse contexto e a mistura de estilos pode gerar falha de bind.

Na validação integrada posterior, o log do ambiente identificou uma segunda causa real: `ORA-00942`, pois a consulta usava `TPL_GUIA_CONTEUDO_V` e `EHR_REGISTRO_CONTEUDO`, objetos que não existem no schema TASY conectado. A consulta foi migrada para os objetos disponíveis `EHR_REGISTRO`, `EHR_REG_TEMPLATE`, `EHR_REG_ELEMENTO` e `EHR_TEMPLATE_CONTEUDO_V`; também passou a filtrar pelo template correto (`rt.nr_seq_template`).

A consulta corrigida foi executada contra o TASY para o atendimento `773931`, retornando os campos de conteúdo `289669` e `289670`. O serviço de detalhes retornou o atendimento, paciente, setor, convênio e os resultados sem erro.

# 6. Fluxo de paciente identificado

Busca, seleção e confirmação continuam usando os dados dinâmicos. O card detalhado `Paciente selecionado` aparece somente antes do início; ao confirmar, o atendimento é iniciado e o modal avança diretamente para Queixa.

# 7. Fluxo sem documento

O caminho existente continua encaminhando a classificação configurada e a criação/abertura no momento do início. Um teste mockado percorreu o início com paciente sem documento e confirmou a classificação configurada, sem introdução de paciente coringa ou dado fixo.

# 8. Fluxo não identificado

Selecionar `Não identificado` agora troca o conteúdo do próprio modal por uma confirmação Conecta. O registro é criado apenas após `Confirmar e iniciar triagem`; o fluxo usa a classificação configurada e então avança para Queixa. Não há reutilização de paciente anterior.

# 9. Remoção de window.confirm

Foi removido o uso de `window.confirm()`/`confirm()` do fluxo de paciente não identificado. Há botão interno `Voltar` e confirmação interna no modal. A busca textual não encontrou confirmação nativa associada a paciente não identificado; o único `confirm()` remanescente em `dashboard.js` é de cancelamento legado, fora desse fluxo.

# 10. Máquina de estados visual

O estado inicial contém identificação, busca/confirmação e início de atendimento. Após sucesso da API, a flag de triagem iniciada é aplicada, os controles pré-atendimento são ocultados e as etapas clínicas são inicializadas. O reset do modal também restaura esse estado, evitando handlers ou botões residuais ao fechar e reabrir.

# 11. Correção dos botões

Antes de iniciar, a confirmação mostra `Cancelar` e `Avançar e Iniciar Triagem` (ou `Confirmar e iniciar triagem` para não identificado). Depois de iniciar, o footer clínico mostra somente `Voltar`, `Salvar rascunho` e `Avançar`; na revisão, `Finalizar Triagem`. O texto clínico foi normalizado de `Próxima Etapa` para `Avançar`.

# 12. Correção do card Paciente selecionado

O card detalhado foi mantido apenas na confirmação pré-atendimento. Ao iniciar, ele é ocultado e as telas clínicas usam o resumo compacto do paciente no topo, sem avatar e sem reapresentar o bloco de confirmação em Queixa, Sinais Vitais, Alergias, Histórico, Glasgow, Escala ou Revisão.

# 13. Etapas clínicas verificadas

Foram verificadas Queixa, Alergias, Sinais Vitais, Histórico, Glasgow, Escala e Revisão quanto à remoção dos controles pré-atendimento e ao footer clínico único. A estrutura visual existente foi mantida alinhada às referências oficiais já analisadas em `design/pronto atendimento/modal triagem`; esta correção não introduz redesign livre.

# 14. Arquivos alterados

- `backend/src/modules/triagem-pa/TriagemPaService.js`
- `backend/src/modules/admin/TriagemValidationService.js`
- `backend/src/modules/admin/adminController.js`
- `backend/src/modules/dashboard/dashboardRepository.js`
- `frontend/admin.html`
- `frontend/index.html`
- `frontend/src/modules/dashboard/dashboard.js`
- `frontend/src/modules/triagem-pa/TriagemPaClinico.js`
- `frontend/src/modules/triagem-pa/TriagemPaUI.js`
- `backend/src/test_e2e_triagem_mock.js`

# 15. Testes realizados

- Syntax check dos JS alterados: aprovado.
- Validação de HTML de `frontend/index.html`: tags balanceadas.
- Testes de validação administrativa: aprovados.
- Teste E2E mockado de iniciar, salvar rascunho e finalizar: aprovado.
- Teste mockado de fluxos identificado, novo paciente, sem documento e não identificado: aprovado.
- Teste de ausência/releitura das oito configurações: aprovado.
- Teste de montagem de binds do detalhe de internação: aprovado.

Os testes de integração com Oracle foram executados com mocks porque o ambiente de shell não possui o Instant Client (`DPI-1047`); nenhum dado temporário de teste foi mantido após as validações.

# 16. Resultado final

Com valores TASY válidos salvos no Admin, `/api/triagem-pa/iniciar` deixa de falhar por nomes divergentes, fallback clínico ou configuração silenciosamente vazia. O fluxo visual separa corretamente confirmação e triagem iniciada, e a rota de detalhes de internação passa a usar binds Oracle válidos.

## Atualização — separação do lançamento automático

O último erro real registrado em `/api/triagem-pa/iniciar` ocorreu depois de as configurações já terem sido validadas: `ORA-06550 / PLS-00306` na chamada a `GERAR_LANCAMENTO_AUTOMATICO`. A causa era o repositório de abertura executar, durante a Triagem P.A., uma etapa administrativa que pertence à Recepção, usando ainda uma assinatura antiga da procedure.

A abertura pela Triagem agora passa explicitamente `gerarLancamentoAutomatico: false`; assim, essa procedure não é mais alcançada nesse fluxo. A Recepção é a única chamadora que opta por essa etapa. Sua chamada foi mantida separada e atualizada para os dez parâmetros publicados pelo Oracle/TASY. A abertura e o lançamento permanecem na mesma transação quando a Recepção os executar.

Foram aprovados os syntax checks de `AtendimentoRepository.js`, `AtendimentoService.js`, `recepcaoService.js` e `TriagemPaService.js`, e o serviço Node foi reiniciado com a alteração.

## Atualização — rotina de log inexistente

Após a separação do lançamento automático, o log do backend revelou a próxima falha real: `PLS-00201`, porque `WHEB_ATEND_PACIENTE_PCK.GRAVAR_LOG_ATENDIMENTO` não existe no schema TASY deste ambiente. A chamada inválida foi removida do repositório de abertura; os campos de auditoria (`NM_USUARIO`, `DT_ATUALIZACAO` e equivalentes) que já são preenchidos nos próprios registros de atendimento continuam preservados.

Não foi usada a procedure `PLS_INSERIR_LOG_ATENDIMENTO` como substituta, pois a inspeção de sua implementação demonstrou que ela grava logs específicos de call center. A próxima operação do fluxo, que atualiza `DT_INICIO_ATENDIMENTO`, foi executada com o identificador técnico inexistente `-1`, validando o SQL e seus binds sem modificar atendimento real. O serviço foi reiniciado e ficou saudável.

## Atualização — alergias, histórico e escala

- Alergias: a tela anterior consultava e gravava colunas inexistentes (`DS_ALERGIA` e `DS_SUBSTANCIA`) em `PACIENTE_ALERGIA`. A nova busca consulta princípios ativos ativos no TASY e retorna `NR_SEQ_FICHA_TECNICA`; a seleção é obrigatória para adicionar e a finalização persiste esse identificador em `PACIENTE_ALERGIA`. Registros existentes agora são lidos da própria tabela, sem depender das colunas inválidas.
- Histórico: o textarea de `triagem_campos_clinicos` existia no Admin, mas não era preenchido no carregamento nem enviado na ação de salvar. A persistência e a validação de seus três arrays foram conectadas. Assim, os sete itens que forem configurados no Admin são renderizados integralmente, sem fallback visual ou conteúdo hardcoded.
- Escala: o motor já calculava os critérios, mas o frontend descartava a resposta do rascunho e só mostrava a lista manual como texto. A resposta agora retorna classificação e evidências ao modal; a etapa exibe critérios automáticos, critérios manuais selecionáveis, evidências e a classificação resolvida. Também foram unificados os nomes de sinais vitais e o total de Glasgow para a persistência/finalização.
