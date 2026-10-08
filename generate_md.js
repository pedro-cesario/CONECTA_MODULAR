const fs = require('fs');

const markdownContent = `
# ESTADO ATUAL PRONTO ATENDIMENTO (TRIAGEM) - CONECTA

## 1. Visão geral do módulo atual
- **Onde fica o módulo**: O fluxo de Pronto Atendimento / Triagem P.A. é implementado dentro do \`dashboard.js\` (como um modal) e reutiliza lógica de senhas e painel do módulo \`recepcao.js\`.
- **Principais páginas/componentes**: \`frontend/index.html\` possui a interface da fila (\`triagem-senhas-grid\`) e o modal de atendimento (\`modal-triagem-identificacao\`).
- **Backend envolvido**: \`backend/src/modules/recepcao\` (manipulação de fila, senhas, abertura de atendimento e busca de pacientes) e \`backend/src/modules/ehr\` (geração da evolução clínica a partir de template e dados de triagem).
- **Bancos envolvidos**: Banco local SQLite (\`auth.sqlite/config.db\`, \`auth.sqlite/audit.db\`) para configurações (painéis, Admin) e auditorias; e Banco Oracle (TASY) para toda a lógica transacional médica e fluxos do paciente.
- **Integrações utilizadas**: Consultas e procedures TASY diretas via \`oracledb\`.
- **Início e fim do fluxo**: Inicia quando a senha cai na fila do P.A., o usuário clica em "Chamar" e depois "Atender". Identifica o paciente (busca ou novo cadastro), confirma, o sistema abre o Atendimento TASY, exibe os 7 passos da triagem (template EHR). Ao finalizar, os dados vitais e evolução são persistidos no TASY e a senha é baixada da fila (encerrada).
- **Reutilização externa**: Módulo Recepção (filas, chamadas, busca de pessoas, cadastro rápido) e Módulo EHR (templates TASY e gerador de XML/assinatura).

## 2. Estrutura de arquivos
**Frontend**:
- \`frontend/index.html\` (ATIVO) - UI principal (grid de senhas e modais).
- \`frontend/src/modules/dashboard/dashboard.js\` (ATIVO) - Controla a Triagem P.A., fluxo do modal, steps da triagem e salvamento final.
- \`frontend/src/modules/recepcao/recepcao.js\` (ATIVO) - Renderiza fila, integra com chamadas de painel e busca de paciente.

**Backend**:
- \`backend/src/modules/recepcao/routes.js\` (ATIVO) - Rotas para \`/senhas\`, \`/atendimentos\` e \`/pessoas\`.
- \`backend/src/modules/recepcao/recepcaoController.js\` (ATIVO) - Controllers de fila e recepção.
- \`backend/src/modules/recepcao/recepcaoService.js\` (ATIVO) - Regras de negócio da recepção.
- \`backend/src/modules/recepcao/recepcaoRepository.js\` (ATIVO) - Interação com \`paciente_senha_fila\`, \`atendimento_paciente\`, \`pessoa_fisica\`.
- \`backend/src/modules/ehr/ehrRoutes.js\` (ATIVO) - Rota \`/ehr/template/:id\` e \`/ehr/registro\`.
- \`backend/src/modules/ehr/ehrController.js\` (ATIVO) - Orquestra a gravação da evolução, fluxos nativos (sinais vitais, alergias, glasgow) e assinatura digital.
- \`backend/src/core/database/index.js\` (ATIVO) - Conexão Oracle TASY.
- \`backend/src/core/config/configCache.js\` (ATIVO) - Obtém/salva filas vinculadas ao P.A. via admin.

**Configuração**:
- \`frontend/admin.html\` (ATIVO) - Configurações das filas de P.A.
- \`backend/src/modules/admin/adminController.js\` (ATIVO) - Rotas do painel admin de filas.

## 3. Fluxo atual da senha
- **Criação**: A criação original da senha não acontece nestes arquivos. As senhas são lidas da \`paciente_senha_fila\` (criadas pelo totem TASY ou emissor).
- **Tabela**: \`paciente_senha_fila\` (Oracle).
- **Fila**: Vinculada por \`nr_seq_fila_senha\`.
- **Status existentes**: As senhas são exibidas no painel enquanto não tiverem \`dt_inutilizacao\`, \`dt_utilizacao\`, \`dt_fim_atendimento\` ou \`dt_chamada\`.
- **Chamada**: Endpoint \`/api/recepcao/senhas/chamar\` executa \`FOR UPDATE SKIP LOCKED\` para pegar a próxima, dá \`UPDATE paciente_senha_fila SET dt_chamada = SYSDATE...\` e grava no histórico (\`paciente_senha_fila_hist\`). Aciona também procedure \`bifrost_integracao_senhas\`.
- **Rechamada**: Endpoint \`/api/recepcao/senhas/rechamar\` atualiza \`dt_nova_chamada\` e \`ie_rechamada = 'S'\`.
- **Início e Encerramento**: O encerramento da senha ocorre durante o POST de \`abrirAtendimento\` (\`/api/recepcao/atendimentos\`), onde a senha referenciada por \`nr_seq_pac_senha_fila\` sofre um \`UPDATE\` marcando \`dt_inicio_atendimento = SYSDATE\` e \`dt_fim_atendimento = SYSDATE\`, retirando-a da fila visual atual.
- **Movimentação**: Não há envio explícito de \`nr_fila_destino\` no frontend durante o fluxo P.A., o que significa que o código do Conecta encerra a senha ao abrir o atendimento. Qualquer transição para fila de consultório médico ocorre automaticamente pelo TASY (triggers/procedures nativos) no evento de criação de episódio, como documentado no tooltip em tela.
- **Descarte**: O endpoint \`/api/recepcao/senhas/:id/inutilizar\` e a função frontend \`inutilizarSenha\` existem, mas **NÃO SÃO UTILIZADOS** na interface atual da Triagem P.A.

## 4. Tela atual da fila P.A.
- **Carregamento**: Função \`carregarSenhasTriagem()\` faz GET em \`/api/recepcao/senhas?modulo=dashboard_pa\`.
- **Polling**: \`setInterval\` a cada 8000ms chama \`carregarSenhasTriagem(false)\` em background.
- **Visual**: Agrupamento em colunas pelas filas. Cards contêm: Iniciais (ex: P 123), Tempo de espera (alerta \`bg-warning\` se > 15 min), Nome do Paciente.
- **Ações disponíveis na UI**:
  - **Chamar**: Botão no card. Chama a senha na TV.
  - **Atender**: Botão no card. Abre modal de Triagem (\`abrirModalTriagemPA\`).
  - **Próxima Senha**: Botão no topo. Auto-chama a próxima senha com maior prioridade e abre o modal.
  - **Avulso**: Abre fluxo sem senha.
- **Ações NÃO disponíveis na UI**: Não existe botão de Descartar nem de Rechamar no card do P.A. (Rechamar só existe na tela principal da Recepção).

## 5. Modal atual de Triagem P.A.
1. Abre em \`modal-triagem-identificacao\`.
2. **Step de Busca**: Input para buscar por nome/CPF/Prontuário (integra com módulo recepção).
3. **Step de Cadastro**: Caso o paciente não seja encontrado, exibe form para criação rápida.
4. **Step de Confirmação**: Mostra um resumo.
5. **Ao Confirmar**: Ocorre a primeira persistência real (\`api.post('/api/recepcao/atendimentos')\`). Recebe um \`nr_atendimento\` (ou falha).
6. **Carregar Template**: Ocorre o fetch para \`/api/ehr/template/triagem\` que carrega a estrutura. A tela troca para os 7 passos clínicos (Queixa, Alergias, Sinais Vitais, Glasgow, etc).
7. **Preenchimento e Finalização**: Os passos são preenchidos no frontend (armazenamento de estado no DOM/formulário).
8. **Submissão**: Ao final (passo 7), envia tudo estruturado em um único POST \`/api/ehr/registro\`. O modal é fechado e a tela atualizada. O fluxo todo ocorre numa tacada só: se o usuário fechar no meio, o atendimento TASY já foi criado, mas a evolução não.

## 6. Identificação e busca de paciente
- **Como é buscado**: Input aciona \`/api/recepcao/pessoas/buscar?q=...\`
- **Query Oracle**: Consulta \`pessoa_fisica\` combinando filtros LIKE para \`nm_pessoa_fisica\`, \`nr_cpf\`, \`cd_pessoa_fisica\` (se numérico).
- **Seleção**: Ao selecionar, os dados do paciente (nome, cpf, cdPf) são codificados em Base64, e enviados para \`prepararConfirmacaoTriagem\`.
- **Pacientes não identificados**: Não existe fluxo explícito para "paciente desconhecido / sem documento". A busca só retorna o que existe. O usuário precisa criar um novo cadastro.

## 7. Cadastro de novo paciente
- **Tela**: \`triagem-modal-step-cadastro\`.
- **Campos**: Nome (obrigatório), CPF, Nasc (obrigatório), Sexo (obrigatório), Telefone, Mãe.
- **Criação**: Função \`salvarENovoAtendimentoTriagem()\` submete via POST \`/api/recepcao/pessoas\`.
- **Validação de CPF duplicado**:
  - No P.A.: **NÃO É FEITA** a chamada de validação antes de salvar.
  - Na Recepção: O endpoint \`/api/recepcao/pessoas/verificar-duplicidade\` existe e é usado pela UI da Recepção, consultando a tabela \`pessoa_fisica\`.
- **Procedure**: Executa \`INSERT INTO pessoa_fisica\` diretamente (gera PK por \`PESSOA_FISICA_SEQ.NEXTVAL\`).

## 8. Abertura de atendimento TASY
- **Momento**: Ocorre **antes** de abrir os 7 passos da evolução de triagem. Apenas ao confirmar os dados demográficos.
- **Função**: \`recepcaoRepository.abrirAtendimento\`.
- **Tabelas**: Criação tripla: \`ATENDIMENTO_PACIENTE\`, \`ATEND_CATEGORIA_CONVENIO\`, e \`ATEND_PACIENTE_UNIDADE\`.
- **Dados enviados**: \`cd_setor_atendimento: 39\` (hardcoded no frontend para P.A. Geral), \`cd_procedencia: 1\`, \`ie_tipo_atendimento: 1\`, \`cd_motivo_atendimento: 1\`, \`ie_clinica: 1\`.
- **Retorno**: Gera \`nr_atendimento\` via \`ATENDIMENTO_PACIENTE_SEQ.NEXTVAL\` e devolve ao frontend.
- **Risco**: Se a API falhar no meio, a interface dá erro. Não há idempotência para duplo-clique. Se clicar duas vezes na confirmação, pode gerar dois atendimentos TASY (a UI aplica um bloqueio local \`ui.setLoading(btnConfirmar, true)\`, mas falhas de rede podem burlar).

## 9. Triagem clínica atual
A tabela de template do TASY (\`EHR_TEMPLATE\`) é lida (por padrão template id 100051). Os componentes renderizados dependem da query em \`EHR_TEMPLATE_CONTEUDO\`.
O Conecta envia todos os campos serializados e o backend constrói texto e grava os fluxos estruturados, listados abaixo:
- **Sinais vitais**: Gravado (estruturado na \`ATENDIMENTO_SINAL_VITAL\`).
- **Alergias**: Gravado (estruturado na \`PACIENTE_ALERGIA\`).
- **Glasgow**: Gravado (estruturado na \`ATEND_ESCALA_INDICE\`).
- **Outros campos textuais** (Queixa, Histórico, Comportamento, etc): Juntados apenas no texto da Evolução (\`DS_EVOLUCAO\`).

## 10. Alergias
- **Consulta**: NÃO EXISTE ATUALMENTE consulta das alergias prévias do paciente no fluxo da triagem.
- **Cadastro**: Ao preencher o modal de Alergias, envia payload prefixado \`AL_\`.
- **Gravação**: Tabela \`PACIENTE_ALERGIA\`. Salva \`IE_NEGA_ALERGIAS\` (S/N) e a observação informada.
- **Atuação do Conecta**: O Conecta APENAS permite o lançamento destas alergias, sem mostrar o histórico.

## 11. Sinais vitais
- **Lançamento**: Realizado no modal específico, preenchido via form, mapeado para campos com prefixo \`SV_\`.
- **Tabela**: \`ATENDIMENTO_SINAL_VITAL\`. Vinculado ao \`NR_ATENDIMENTO\`.
- **Campos suportados**: PA Sistólica, PA Diastólica, Freq Cardíaca, Freq Respiratória, Temperatura, Peso, Saturação O2.
- **Frontend**: Usa componente nativo injetado (\`window.conectaCore.abrirFluxoNativo('Sinais Vitais', ...)\`).

## 12. Glasgow
- **Lançamento**: Modal nativo \`modal-fluxo-glasgow\`, envia dados com prefixo \`GL_\`.
- **Cálculo**: Feito no backend (\`ehrController.js\`), soma \`IE_ABERTURA_OCULAR + IE_RESPOSTA_VERBAL + IE_RESPOSTA_MOTORA + IE_REATIVIDADE_PUPILAR\`.
- **Tabela**: \`ATEND_ESCALA_INDICE\`.

## 13. Evolução gerada pela Triagem
- **Endpoint**: POST \`/api/ehr/registro\`.
- **Tabela**: \`EVOLUCAO_PACIENTE\`. (Gera PK \`EVOLUCAO_PACIENTE_SEQ.NEXTVAL\`).
- **Tipo de evolução**: \`IE_TIPO_EVOLUCAO = 1\` (Evolução Médica/Triagem).
- **Conteúdo**: O backend monta um texto corrido (\`DS_EVOLUCAO\`) iterando as chaves recebidas (que não sejam os fluxos nativos), ex: \`Queixa Principal: Paciente relata dor...\`. O texto dos fluxos (SV, GL, AL) também é apendado ao texto.
- **Assinatura**: Após a inserção, é gerado um XML canônico que passa por MD5 hash, e depois executa a procedure Oracle \`TASY_GRAVAR_ASSINATURA_DIGITAL\` assinando automaticamente com o usuário do Conecta.

## 14. Template Triagem P.A.
O sistema TASY é a fonte da verdade para o layout.
- A rota GET \`/api/ehr/template/:id\` consulta as tabelas \`EHR_TEMPLATE\`, \`EHR_TEMPLATE_CONTEUDO\` e \`EHR_ELEMENTO\`.
- Se ID = "triagem", busca o valor na tabela SQLite (\`configuracoes_sistema\`) em \`triagem_template_id\` (default 100051).
- Os elementos retornados determinam as caixas de texto que aparecem nos "passos" da Triagem.
- **Mas no final:** O conteúdo NÃO É GRAVADO de forma estrutural nativa de EHR no TASY. O Conecta **achata** todas as respostas em um grande texto de evolução (String \`DS_EVOLUCAO\`), mais a persistência de 3 tabelas satélites (Sinais vitais, Alergia e Glasgow).

## 15. Finalização da triagem
Sequência REAL (Código atual):
1. Usuário envia os forms preenchidos.
2. Endpoint \`/ehr/registro\` processa; não há controle transacional global.
3. Monta o texto de evolução.
4. Executa \`INSERT INTO EVOLUCAO_PACIENTE\`.
5. Executa os \`INSERT\` em \`ATENDIMENTO_SINAL_VITAL\`, \`ATEND_ESCALA_INDICE\` e \`PACIENTE_ALERGIA\` sequencialmente.
6. Gera o XML canônico em memória.
7. Executa \`TASY_GRAVAR_ASSINATURA_DIGITAL\`.
8. Envia OK para UI e fecha modal.
**Obs:** A senha já havia sido encerrada antes na abertura do atendimento.
**Riscos:** Falta transação no Node (se ocorrer falha entre os inserts dos fluxos e a assinatura, haverá dados "órfãos"). O sistema não possui rollback automático explícito (\`conn.rollback()\` não está no bloco catch e usa \`autoCommit: true\`).

## 16. Movimentação para próxima fila
- **No Conecta**: **NÃO EXISTE ATUALMENTE** movimentação explícita enviada pelo Conecta P.A. para a próxima fila médica. O frontend não envia \`nr_fila_destino\` no momento de criar o atendimento.
- **Consequência**: A senha antiga é apenas marcada com \`dt_fim_atendimento = SYSDATE\`.
- A documentação de tela afirma que o vínculo para a Fila de Consultório é feito "no TASY diretamente" após abertura.

## 17. Configuração no Conecta Admin
- **Filas do PA**: Configuráveis via \`frontend/admin.html\` que faz GET/POST em \`/api/admin/dashboard-pa/filas\`.
- **Armazenamento**: Tabela \`configuracoes_dashboard_pa\` no banco SQLite (\`auth.sqlite/config.db\`).
- **Query Oracle**: A lista de filas para seleção vem do TASY: \`SELECT nr_sequencia, ds_fila FROM FILA_ESPERA_SENHA\`.

## 18. Descarte de senha
- **TASY / Oracle**: O Conecta possui a lógica espelhada (\`inutilizarSenha\`) que atualiza a tabela \`paciente_senha_fila\` com \`dt_inutilizacao = SYSDATE\` e um \`nr_seq_motivo_inutilizacao\` (default 3 - Outros).
- **Frontend**: A interface da Triagem P.A. (**Dashboard**) **NÃO EXIBE BOTÃO DE DESCARTE/CANCELAMENTO**. A função existe no \`recepcao.js\` mas só é usada em outras telas (Recepção), deixando a Triagem vulnerável se o enfermeiro chamar uma senha que foi embora (fica sem opção de desfazer, a não ser que ele pule e deixe a senha presa, ou chame "Próxima").

## 19. Banco local do Conecta
Bancos locais detectados: **SQLite**.
- **\`auth.sqlite/config.db\`**:
  - \`configuracoes_dashboard_pa\`: PK chave, salva \`nr_sequencia_fila\` (Filas que aparecem no dashboard PA).
  - \`configuracoes_sistema\`: Configurações globais (\`triagem_template_id\`, etc).
- **\`auth.sqlite/audit.db\`**:
  - \`conecta_audit_trail\`: Registro básico de acessos.

Nenhuma tabela do fluxo médico/transacional do paciente é guardada no SQLite. 100% no TASY.

## 20. Oracle / TASY
Implementações, procedures e tabelas (todas ATIVAS):
- Tabela \`paciente_senha_fila\` e \`fila_espera_senha\` (Senhas)
- Tabela \`pessoa_fisica\` (Cadastro/Busca)
- Tabela \`atendimento_paciente\`, \`atend_categoria_convenio\`, \`atend_paciente_unidade\` (Abertura de atendimento)
- Tabelas \`EHR_TEMPLATE\`, \`EHR_TEMPLATE_CONTEUDO\`, \`EHR_ELEMENTO\` (Templates)
- Tabelas de registro: \`evolucao_paciente\`, \`atendimento_sinal_vital\`, \`atend_escala_indice\`, \`paciente_alergia\`
- **Procedure**: \`bifrost_integracao_senhas(nr_seq_senha_p)\` (Chamada de senha)
- **Procedure**: \`ATUALIZAR_SENHA_MONITOR(seq, 'L')\` (Monitor de TV)
- **Procedure**: \`TASY_GRAVAR_ASSINATURA_DIGITAL(DS_ASSINATURA_P, ...)\` (Assina as evoluções da triagem). IMPLEMENTAÇÃO EXTERNA AO REPOSITÓRIO.

## 21. Estados e status atuais
| Entidade | Status | Onde é usado | Significado atual |
|---|---|---|---|
| Senha | \`dt_chamada\` IS NULL | Fila de Triagem | Aguardando atendimento. |
| Senha | \`dt_chamada\` = SYSDATE | Fila/Guichê | Paciente foi chamado no painel. |
| Senha | \`ie_rechamada\` = 'S' | Fila/Guichê | Paciente chamado novamente. |
| Senha | \`dt_inicio_atendimento\` = SYSDATE<br>\`dt_fim_atendimento\` = SYSDATE | Abertura de Atendimento | Encerra o ciclo da senha do painel da triagem. |
| Senha | \`dt_inutilizacao\` = SYSDATE | Descarte | Senha inativada (via Recepção, não via Triagem). |
| Evolução | \`IE_SITUACAO\` = 'A' | Gravação EHR | Evolução Ativa. |

## 22. Pontos incompletos ou inconsistentes encontrados
- **Falta de transação atômica (Rollback)**: O \`ehrController.js\` realiza inúmeros INSERTS com \`autoCommit: true\`. Falhas no meio (ex: falha na assinatura digital) gerarão dados pela metade.
- **Criação de Atendimento e Duplicidade**: Não há bloqueio eficaz contra clique duplo na confirmação. Pode abrir 2 atendimentos para o paciente, pois \`abrirAtendimento\` não verifica se a senha já está atrelada.
- **CPF Duplicado na Triagem**: O \`dashboard.js\` chama o POST para criação rápida de paciente sem utilizar a validação de CPF (\`/pessoas/verificar-duplicidade\`) existente na Recepção, dependendo exclusivamente do banco de dados barrar a restrição.
- **Falta de botão Descartar/Inutilizar na fila de PA**: O enfermeiro não tem como descartar facilmente uma senha sem chamá-la e abrir um atendimento fantasma ou deixá-la pendurada.
- **Alergias "Cegas"**: O módulo permite adicionar alergias, mas NÃO EXIBE o que o paciente já tem cadastrado no banco.

## 23. Fluxo atual em Mermaid
\`\`\`mermaid
flowchart TD
    A[Senha na paciente_senha_fila] -->|Usuário clica Próxima/Atender| B[Chama no Painel TV]
    B --> C[Modal de Identificação]
    C --> D{Paciente encontrado?}
    D -->|Sim| F[Confirma Demográficos]
    D -->|Não| E[Cadastro Novo Paciente]
    E --> F
    F -->|Clique Confirmar| G[Cria Atendimento TASY e Encerra Senha PA]
    G --> H[Carrega Template EHR 100051]
    H --> I[Preenchimento 7 Telas Frontend]
    I -->|Gravar Dados| J[Insert de Fluxos Nativos: Sinais, Glasgow, Alergias]
    J --> K[Gera Texto Evolução]
    K --> L[Procedure Assinatura Digital]
    L --> M[Triagem Finalizada]
\`\`\`

## 24. Mapa ponta a ponta
| Etapa | Frontend | Endpoint | Backend | Banco local | TASY | Resultado |
|---|---|---|---|---|---|---|
| Ler fila | \`carregarSenhasTriagem\` | GET \`/senhas\` | \`recepcaoRepository\` | - | \`paciente_senha_fila\` | Senhas exibidas |
| Chamar | \`chamarProximaSenha\` | POST \`/senhas/chamar\`| \`recepcaoRepository\` | - | \`paciente_senha_fila\` UPDATE / Histórico | Senha pisca no painel |
| Identificar| Busca | GET \`/pessoas/buscar\` | \`recepcaoController\` | - | \`pessoa_fisica\` | Paciente localizado |
| Cadastrar | Modal Form | POST \`/pessoas\` | \`recepcaoRepository\` | - | \`pessoa_fisica\` INSERT | Novo registro PK |
| Atendimento| \`btnConfirmar\` | POST \`/atendimentos\` | \`recepcaoRepository\` | - | \`atendimento_paciente\` INSERT e encerra senha | Atendimento criado |
| Preencher | EHR Steps | GET \`/ehr/template/:id\` | \`ehrController\` | SQLite (config) | \`EHR_TEMPLATE\` | Forms renderizados |
| Finalizar | Submit Forms | POST \`/ehr/registro\` | \`ehrController\` | - | \`EVOLUCAO_PACIENTE\`, \`ATENDIMENTO_SINAL_VITAL\`, etc | Triagem no Prontuário |

## 25. Dependências externas
- **Procedures Oracle (TASY)**:
  - \`bifrost_integracao_senhas\`
  - \`ATUALIZAR_SENHA_MONITOR\`
  - \`TASY_GRAVAR_ASSINATURA_DIGITAL\`
- (Todas essenciais para o fluxo atual funcionar na integridade com o ecossistema hospitalar).

## 26. Módulo Recepção reaproveitável
- O P.A. (Dashboard Triagem) JÁ UTILIZA quase todo o módulo \`Recepcao\` para as rotinas fundamentais.
- A função \`recepcaoRepository.inutilizarSenha\` já existe e funciona perfeitamente, mas foi omitida visualmente da UI da Triagem.
- O endpoint \`verificar-duplicidade\` (Recepção) está disponível, e deveria ser injetado no processo de \`salvarENovoAtendimentoTriagem\` no P.A.

## 27. Concorrência e integridade
- **Duas chamadas (Próxima Senha)**: Há proteção (Usa \`FOR UPDATE SKIP LOCKED\` no \`chamarProximaSenha\`).
- **Abertura de atendimento**: NÃO há proteção se dois profissionais abrirem atendimento quase que simultaneamente na mesma aba antes da senha ser descartada visualmente.
- **Dois profissionais atenderem a mesma**: Se um profissional já chamou na tela, a senha some (ou muda status), mas se dois tentarem "atender" a mesma do grid, não há bloqueio de versão (\`dt_atualizacao\`) transacional para impedir que a mesma senha gere dois atendimentos seguidos.

## 28. Auditoria e rastreabilidade
- **Abertura/Atualização**: Usa \`nm_usuario\` recebido da sessão para gravar em \`atendimento_paciente.nm_usuario\`.
- **Evolução**: \`nm_usuario\` do Conecta é passado para a procedure de Assinatura Digital do TASY (que gera logs em \`tasy_assinat_dig_log\`).
- **Senha**: Toda chamada/atualização grava registro filho em \`paciente_senha_fila_hist\`.
- **Log Local**: SQLite grava logs gerais de requests nas rotas, mas o grosso clínico está no TASY.

## 29. Tratamento de erros
- Exibição padrão de Toast na UI com \`ui.showToast(err.message)\` (captura do backend).
- Falhas de rede exibem um card de fallback no grid: "Erro ao carregar fila".
- **Sem Rollback**: Como citado, nas rotinas de gravação de evolução (EHR), os bancos usam \`autoCommit: true\` ou comandos SQL individuais. Um erro no meio deixa lixo transacional.

## 30. Código legado e implementações paralelas
- Não foram encontrados arquivos "old" ou "v1" em atividade para essa regra de negócio. O fluxo P.A. coexiste bem com a Recepção reaproveitando o que é idêntico e bifurcando (no dashboard.js) o que é próprio do P.A.

## 31. Arquivos prioritários para próxima auditoria
Se uma LLM for corrigir ou melhorar este módulo, deve ler exatamente estes arquivos:
1. \`frontend/src/modules/dashboard/dashboard.js\` — UI da Triagem e chamadas aos controllers de EHR/Recepção.
2. \`backend/src/modules/ehr/ehrController.js\` — Coração da evolução clínica; aqui é preciso corrigir as transações sem rollback.
3. \`backend/src/modules/recepcao/recepcaoRepository.js\` — Onde estão os inserts de atendimento e o update da senha (para correção de duplicidades/locks).

## 32. Resumo executivo do estado atual
O fluxo atual de Pronto Atendimento / Triagem funciona no cenário principal, dependendo 100% de tabelas e procedures do TASY (nenhuma regra médica fica no banco local).
- **Já funciona bem**: Visualização da fila (painel atualiza em real-time), amarração do paciente via recepção (busca fluida), preenchimento do formulário da triagem que respeita dinamicamente os metadados EHR do TASY, e geração do XML.
- **Funciona parcialmente**: Cadastro rápido de paciente (não testa duplicidade no front P.A.).
- **Maiores fragilidades técnicas**:
  1. A inexistência de um botão "Descartar" ou "Inutilizar" na UI do Triagem (o backend tem suporte para isso via \`Recepcao\`).
  2. Falta de transações seguras (\`ROLLBACK\`) ao gravar evoluções. Se o banco Oracle desconectar após salvar a queixa, as alergias e assinatura não são gravadas, mas a evolução sim.
  3. Ausência de bloqueios em Duplo Clique na abertura do atendimento TASY.
- **Pontos não determinados**: O funcionamento exato da migração da fila Triagem -> fila Consultório, pois o Conecta **não realiza esse UPDATE explicitly**. Presume-se, pelo texto na tela, que dependa de uma TRIGGER no TASY que percebe a criação de \`ATENDIMENTO_PACIENTE\`. (NÃO FOI POSSÍVEL DETERMINAR PELO CÓDIGO ATUAL A EXISTÊNCIA DESTA TRIGGER NO ORACLE).
`;

fs.writeFileSync('/media/SAAS/SAAS/CONECTA_MODULAR/ESTADO_ATUAL_PRONTO_ATENDIMENTO_CONECTA.md', markdownContent);
console.log('Documento gerado com sucesso.');
