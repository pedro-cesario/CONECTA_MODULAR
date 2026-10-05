# PADRONIZACAO_CONECTA_03_1_PLANO_REVISADO.md

## 1. CORRIGIR CONCLUSÕES (REVISÃO DOS DIAGNÓSTICOS)

- **Autenticação:** A aplicação utiliza sessões estaduais no backend (baseadas em cookie + armazenamento da sessão no Redis/SQLite via Express Session). Os grupos LDAP são consultados e salvos na sessão; não há uso de JWT ou autenticação puramente baseada em token *stateless*.
- **Relatórios:** Existe autenticação (verificação de sessão) no acesso aos relatórios, mas falta *autorização* (validação se o ID do relatório solicitado pertence aos escopos/módulos permitidos para o perfil logado).
- **Conexões Oracle:**
  - *Vazamento confirmado:* `recepcaoRepository.js` (ex: linhas 1047, 1583) e `setorService.js` adquirem a conexão e disparam erros síncronos de validação de input antes de entrarem em blocos transacionais seguros, vazando a conexão.
  - *Aquisição desnecessária:* Funções que pedem conexão ao pool sem necessidade ou muito antes do momento de I/O.
  - *Risco não comprovado:* Funções que usam `try/catch/finally` corretamente, cujo risco de falha ao fechar a conexão (`conn.close`) foi mitigado, mas que precisam de revisão estrutural de dependência.
- **Text-to-Speech (TTS):** O endpoint `/api/painel/audio` é um proxy com destino fixo para o Google Translate. Ele não é consumido pela interface frontend auditada (que usa `window.speechSynthesis`). A desativação é uma *proposta* para eliminar endpoints ociosos, não uma decisão já ratificada.
- **Git e Segredos:** Não proporemos exclusão de histórico de commits automaticamente. Arquivos sensíveis (`auth.sqlite`, `config.db`, `policy-cache.json`, `test-tasy.js`, `test-db-cancel.js`) devem ser incluídos no `.gitignore` e removidos do controle de versão (mantidos apenas localmente).
- **SQLite e Múltiplas Instâncias:** O SQLite será mantido para os casos de uso atuais (ex: auth local/config). Não há justificativa para substituí-lo agora com base apenas em uma hipótese não confirmada de escalabilidade horizontal.
- **Prazos:** A adequação será baseada em lotes delimitados de tarefas, não em promessas arbitrárias de semanas.

## 2. CONFIGURAÇÕES PELO PAINEL

A gestão de configurações vitais (Oracle, LDAP) pelo painel requer segurança reforçada, dado que manipulam segredos institucionais.

- **Configuração Externa Mínima vs. Parâmetros Administráveis:**
  - *Externa Mínima (`.env`):* Chave mestre de criptografia (`MASTER_KEY`), portas do servidor, ambiente (`NODE_ENV`).
  - *Administráveis (Painel):* Strings de conexão Oracle, URLs LDAP, timeouts.
- **Acesso Inicial (Bootstrap):** Criação de um mecanismo restrito de "First Boot" (ex: usuário administrador de emergência gerado se o banco de configurações estiver vazio ou via token local descartável) para configurar o LDAP pela primeira vez. Ao salvar e testar com sucesso, este acesso é desativado.
- **Proteção e Armazenamento de Segredos:** Senhas (Oracle/LDAP) no banco de configurações (SQLite) devem ser criptografadas (ex: AES-256) utilizando a `MASTER_KEY` contida fora do banco e do repositório (variável de ambiente).
- **Contratos de Resposta e Preservação de Senha:** Respostas da API de configuração devem mascarar segredos (ex: `oraclePassword: "********"`). Na atualização, se a senha enviada for nula ou mascarada, preserva-se o valor criptografado existente.
- **Testes e Aplicação Controlada:**
  - *Teste:* Endpoint específico testa a conexão (Oracle/LDAP) com as configurações fornecidas *antes* de salvá-las, retornando sucesso/erro sem quebrar a aplicação principal.
  - *Aplicação (Graceful Reload):* A atualização de pools (Oracle) e clientes (LDAP) deve ocorrer de forma paralela. O pool antigo é mantido para requisições em andamento; requisições novas usam o pool novo. Em caso de configuração inválida, a aplicação deve se recuperar e reverter para a configuração anterior na memória.
- **Instant Client:** Preservar a instalação fornecida na pasta local, copiada para os containers.
- **Auditoria e Ambientes:** Ações de configuração (quem, quando, o quê) são auditadas em log, sem expor os valores alterados. Garantir separação estrita e configuração distinta para Homologação e Produção.

## 3. CONTRATOS DE API E COMPATIBILIDADE

O objetivo é definir um envelope canônico de sucesso e erro para *novos* endpoints e migrações, mantendo os legados inalterados até suas respectivas refatorações.

| Método/Caminho representativo | Consumidor | Formato Atual (Exemplo) | Formato Proposto (Canônico) | Estratégia de Compatibilidade |
|---|---|---|---|---|
| `GET /api/version` | Frontend `utils.js:loadVersion()` | `{ ok: true, version: "..." }` | `{ ok: true, version: "...", showTestBar: true/false }` | Manter estritamente o contrato real; migrar endpoint com cautela máxima. |
| `GET /api/modulos` | Frontend Menu / `auth.js` | `[...]` (Array completo de módulos) | `{ ok: true, data: [...] }` | Refatorar endpoint + consumidor no frontend no mesmo lote. |
| `POST /api/registros` | Mod. Registros | `{ success: true, id: 123 }` | `{ ok: true, data: { id: 123 } }` | Manter original até módulo Registros ser o foco. |
| `GET /api/relatorios/123/pdf`| Mod. Relatórios | Binário `application/pdf` | Binário `application/pdf` | Não usar envelope JSON. Contrato preservado. |
| `GET /api/sse/painel` | Painel TV | `text/event-stream` | `text/event-stream` | Não usar envelope JSON. Contrato preservado. |

- **Erros e Validação:** Envelopes de erro padrão: `{ "ok": false, "error": "Mensagem pública amigável", "requestId": "uuid" }`. Logs internos rastreiam o `requestId` junto com stacks de exceção, que nunca são expostos na rede. Códigos HTTP consistentes: 200/201 (Sucesso), 400 (Bad Request), 401 (Não autenticado), 403 (Acesso Negado), 404 (Não Encontrado), 409 (Conflito), 500 (Erro Servidor).
- **Tratamento de Datas:**
  - *Instante com fuso (Logs, Auditoria, Transações no backend):* Formato ISO 8601 UTC (ex: `2024-01-01T12:00:00Z`).
  - *Data civil sem horário (Nascimentos, Validades):* `YYYY-MM-DD`.
  - *Horário local de plantão / Datas Assistenciais:* Não converter cegamente para UTC, pois prescrições e passagens de plantão dependem do fuso hospitalar local. Se houver timestamps existentes no Oracle (ex: `DATE` ou `TIMESTAMP` sem timezone), tratar conforme o *timezone* local da instituição de saúde para manter compatibilidade com relatórios do TASY.

## 4. AUTORIZAÇÃO

A autorização é baseada em três anéis de proteção:
1. **Middleware (`authMiddleware`):** Garante a autenticidade (Sessão válida, cookie legível). Rejeita com 401 se falhar. Avalia o módulo/ação de forma grosseira caso parametrizado.
2. **Serviço (Domain Logic):** Garante o escopo de recurso. Verifica se o perfil do usuário possui o nível hierárquico, permissão ou vínculo de setor para manipular o recurso solicitado. Rejeita com 403 se falhar.
3. **Repositório (Data Access):** Consulta limitada ao escopo autorizado via *bind variables* (cláusulas `WHERE setor_id IN (escopos_permitidos)`), garantindo que dados não vazem nem em caso de erro na lógica de serviço.

- **Endpoints Sensíveis Apenas com `requireAuth`:** A rota `/api/modulos`, geração de relatórios e acessos a dados assistenciais sem verificação extra de perfil/setor no backend.
- **Falha de Configuração de Acesso (Fail-safe):** Se o cache de permissões estiver corrompido, vazio ou o Redis offline, a aplicação deve falhar de forma fechada (Deny by Default). Nenhum acesso será concedido por padrão.
- **Identificadores e `perfilTemAcessoModulo`:** Antes de normalizar cegamente a função (duplicada atualmente, com `toLowerCase` conflitante), deve-se mapear todos os chamadores. Caixas baixas no banco não implicam que o código ou o AD sempre enviem minúsculas.
- **Filtro em `/api/modulos`:** O array não deve vazar os módulos que o usuário não tem. Contudo, o frontend de Passagem de Plantão utiliza a visibilidade total para gerenciar *checkboxes* de setores inter-módulos. Devemos mapear esse uso antes de aplicar o filtro restrito no endpoint.

## 5. FRONTEND E PADRÃO VISUAL

- **Gerenciamento de Memória (Listeners e Timers):** Toda renderização de componentes com eventos globais (`window`, `document`) ou `setInterval` (ex: polling de notificações) deve ter rotinas explícitas de descarte (*cleanup*) ao sair do módulo ou ao substituir instâncias.
- **Requisições Fora de Ordem e Cancelamento:** Funções de busca com _debounce_ e navegações rápidas devem utilizar `AbortController` na camada `core/api.js` para abortar requisições obsoletas, prevenindo que a resposta de uma requisição antiga sobressaia a nova.
- **Tratamento de 401 e 403:**
  - *401 (Não Autenticado):* Interceptado globalmente pela `api.js`; deve forçar a ida à tela de login após limpar o estado local, prevenindo redirecionamentos contínuos.
  - *403 (Proibido):* Tratado pelo módulo; mostra alerta de falta de permissão ou oculta formulário, mantendo o usuário na tela de contexto se possível.
- **Rascunhos (Drafts) e Prevenção de Envios:**
  - O auto-save de rascunhos deve estar segregado por `userId + módulo + recursoId` no armazenamento local (`state.js`/`localStorage`), evitando vazar dados clínicos entre abas ou sessões.
  - Submissões devem desabilitar imediatamente os botões (via classe de loading padrão) no evento `submit`, evitando dupla submissão transacional (inserção de dois registros idênticos por duplo clique).
- **Estados Visuais (Carregamento, Vazio, Erro):** O Skeleton (`shimmerPulse`) é recomendado para transições de lista, porém **não** é substituto para estados vazios ou nulos. Estados vazios (ex: "Sem pacientes no setor") devem ser explícitos e amigáveis. Erros devem utilizar Toasts (não bloqueantes) ou Modais (ação exigida).
- **Auditoria de Componentes:** Não se deve invocar funções em `ui.js` sem antes atestar que estão exportadas. O uso de CSS deve respeitar a cascata, priorizando classes utilitárias e variáveis (`--primary`, `--slate-900`). Estilos inline (`style="..."`) são proibidos para cores/fontes, sendo toleráveis *apenas* em atributos estritamente dinâmicos e matemáticos (ex: `style="width: 50%"` para barras de progresso). Acessibilidade requer `outline` visível no foco de teclado.

## 6. TESTES E INFRAESTRUTURA

- **Isolamento de Testes:** As suítes não devem depender ou causar efeitos colaterais nos bancos de homologação ou produção. Deve-se manter a política da Etapa 02 (inicialização explícita de clientes externos via *hooks* e SQLite `in-memory` descartável).
- **Validações e AST:** O uso do Acorn (parser AST) deve ser mantido como validador da sintaxe *ES Modules*, prevenindo erros de carregamento nos browsers homologados. A dependência deve estar formalmente declarada caso utilizada.
- **Cache e Migrações:**
  - *Inicialização:* A execução de DDL (migrações) não deve estar no caminho crítico do carregamento do serviço ou do cache de autorizações em Produção. Deve haver separação estrita entre migrar dados e instanciar aplicações.
- **Ciclo de Atualização e Bind Mounts:** Como a aplicação utiliza *bind mounts* nos containers, a implantação de updates ou execução de *rollback* requerem transitar pelo histórico Git (retorno à versão anterior de *commit* e re-instalação de pacotes Node). Alterações de dados devem ser sempre retrocompatíveis (N-1) e validadas primeiramente no ambiente de Homologação. O frontend e o backend interagem via arquivos mapeados (o *cache buster* do navegador deve ser sempre atualizado em cada nova *release*).

## 7. PLANO COMPLETO (RASTREAMENTO E ETAPAS)

| Etapa | Resultado | Arquivos (Alvos) | Risco | Critérios de Aceite | Validações e Rollback | Decisões Pendentes |
|---|---|---|---|---|---|---|
| **A. Higiene Git** | Remoção de rastros | `.gitignore`, SQLite `.db` e `.sqlite`, senhas e artefatos em `test-tasy.js` e `test-db-cancel.js` | Baixo | Arquivos ignorados; credenciais não transitam no git | `git status` não enxerga db de sessão e config locais | - |
| **B. Fix Críticos Backend** | Conexões protegidas e TTS órfão fechado | `recepcaoRepository.js`, `setorService.js`, Rotas de Painel | Médio | Validações síncronas antes de `db.getConnection()`. Fim de vazamentos comprovados. Fechar proxy TTS. | Suíte de testes isolados rodando com erro de param garantindo que não chamou Oracle | Revisor deve aprovar exclusão definitiva do código TTS (TV). |
| **C. Auth Lógica e Filtro** | Sem grupos implícitos; `perfilTemAcesso` resolvido | `authMiddleware.js`, `authController.js`, `configCache.js`, `api/modulos` | Alto | AD define grupos. Correção da dupla declaração de `perfilTemAcessoModulo`. Filtro de modulos não quebra *checkbox* da Passagem. Autorização por setor corrigida. Relatórios com IDs filtrados. | Regressão nos endpoints; login mockado. | Normalizar IDs após mapear consumidores das strings "Livro/Escala". |
| **D. Módulo Piloto: Dashboard** | Módulo de Leitura seguro e padronizado | `dashboardController.js`, `dashboard.js`, `ui.js`, `api.js` | Baixo | Rotas padronizadas. Telas usam Skeletons, tratam 401 via `api.js` local, cancelam requests (Abort). Sem Ações de gravação. Escopo exato (Dashboard Leitos). | Testes em frontend simulado e respostas controladas | Inclusão de ações complexas delegada a etapas futuras. |
| **E. Painel Administrativo** | Gestão Segura de Oracle e LDAP | Config DB (SQLite), Service novo, Backend, Views de admin | Médio | Senhas salvas com criptografia AES via `MASTER_KEY`. Teste síncrono da conexão. Boot de emergência via admin temporário provido. Configs atualizam em real-time (pools). | Reload de pool (`try/catch`) com queries paralelas sem queda da API. | UI final do painel requer prototipação alinhada (Studio Feedback). |
| **F. Restante e Pendências Acumuladas** | Cobertura total | Arquivos de Relatórios, Livro, Passagem, Escala | Alto | Dependência Livro/Escala quebrada/isolada. Cache Frontend atualizado (V-busters). Listeners duplos eliminados (cleanup em onUnmount). Motivo de Cancelamento devidamente preenchido. Migrações executadas em *tooling* apartado (não no boot). | Teste massivo sistêmico com persistências complexas (Transactions). | Identificadores institucionais fixos precisam ser dinamizados via Painel. |

## 8. PRIMEIRO LOTE E MÓDULO PILOTO

**Proposta do Primeiro Lote (Ações Isoladas de Baixo Risco):**
Lista delimitada de arquivos, focando exclusivamente na higiene e estancamento de riscos críticos e contratuais. Nenhuma nova tela será criada.

*Arquivos Envolvidos e Ações (Primeiro Lote):*
1. `.gitignore`: Adicionar `.sqlite`, `.db`, `policy-cache.json`.
2. Remover do *tracking* Git os arquivos: `test-tasy.js`, `test-db-cancel.js`, bancos estáticos (garantindo ausência de credenciais em plain text).
3. `recepcaoRepository.js` e `setorService.js`: Movimentar lógicas de `db.getConnection()` para baixo dos *throws* de validação.
4. `frontend/src/core/utils.js` (loadVersion) e `versionHandler.js`: Confirmar o contrato exato `{ ok: true, version: "...", showTestBar: boolean }`.
5. Comentar o roteamento do proxy de Text-to-Speech (TTS) temporariamente até remoção definitiva.

*Critérios de Aceite:*
- Segredos e DBs locais não exibem modificações no `git status`.
- Funções afetadas no `recepcaoRepository` devem ser validadas contra o banco MOCK (nenhum *leak* provocado por inputs incorretos na suite de testes).

**Piloto Recomendado (Segundo Lote) — Dashboard (Apenas Leitura):**
- *Escopo Explícito:* O módulo Piloto no backend/frontend se limitará à refatoração do `Dashboard` restrito às operações de leitura (Listar Leitos, Painel, Ocupação).
- *Restrições:* Ações operacionais do painel (como emitir senhas, internar pacientes ou gravar rascunhos) estão expressamente excluídas do piloto para mitigar impacto direto na assistência.
- *Pendências Críticas Antes do Deploy:* A dupla declaração do `perfilTemAcessoModulo` (que pode comprometer a visualização do painel) e o tratamento de 401 via AbortController no novo módulo devem estar plenamente testados e funcionais. O deploy deste piloto *não* atesta a segurança do restante do monólito (passagem/livro), que seguem vulneráveis até completarem o cronograma.

---
### RESUMO DO FECHAMENTO

- **Decisões Propostas:**
  1. Criação de Painel Admin protegido com chaves `.env` (`MASTER_KEY`) e recarga de pools assíncrona.
  2. Adoção imediata de contrato canônico focado nas APIs nativas e `AbortController` global no frontend.
- **Dúvidas Impeditivas:** Falta validar como o array retornado por `/api/modulos` afeta checkboxes da "Passagem de Plantão" no estado legado. Não se pode filtrar no backend até sanar essa dependência de tela.
- **Primeiro Lote:** Higienização Git, Fix vazamento Oracle e Acerto do `/version`.
- **Limitações:** A avaliação visual requer confirmação do `DESIGN_SYSTEM.md` contra os *exports* reais presentes no arquivo atual `core/ui.js`. Alterações estáticas inline seguem restritas; apenas binds de tamanho matemático serão tolerados no style. A obrigatoriedade do AST Acorn só fará sentido se documentado como parte efetiva do CI, sem inviabilizar builds locais rápidos.
