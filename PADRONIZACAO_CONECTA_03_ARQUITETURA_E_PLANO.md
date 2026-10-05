# PADRONIZACAO_CONECTA_03_ARQUITETURA_E_PLANO.md

## 1. ARQUITETURA DO BACKEND

O backend do Conecta HEAL é e continuará sendo um **monolito modular** construído com Node.js, Express e CommonJS. Não há necessidade técnica demonstrada para introduzir frameworks complexos, TypeScript ou microsserviços neste momento. A arquitetura atual e a proposta se dividem em camadas com responsabilidades claras:

- **Rotas e Middlewares (`routes.js`, `authMiddleware.js`)**:
  - **Responsabilidade já implementada:** Definir pontos de entrada da API, aplicar validações globais e verificar o token.
  - **Padrão proposto:** O arquivo de rotas não deve conter lógica de infraestrutura imediata. Importar `routes.js` (como acontece com `ocorrenciaController.js`) não deve abrir instantaneamente uma conexão de banco/Redis no root scope. Middlewares devem injetar as dependências sob demanda.
- **Controllers (ex: `authController.js`, `dashboardController.js`)**:
  - **Responsabilidade:** Validação rigorosa dos parâmetros de entrada, chamada de serviços de domínio e formatação do envelope de saída HTTP.
- **Serviços (Services)**:
  - **Responsabilidade:** Concentrar regras de negócio e autorização fina baseada em recurso/ação/setor.
  - **Limites das Transações:** A orquestração (commit/rollback) de operações multirrepositório deve residir aqui.
- **Repositórios (Repositories)**:
  - **Responsabilidade:** Consultas SQL exclusivas, isoladas da camada HTTP.
  - **Padrão proposto (Oracle):** Conexões devem ser solicitadas do pool **apenas após** todas as validações de entrada. O ciclo de vida da conexão deve usar invariavelmente blocos `try...finally { conn.close() }` com tratamento de erro adequado para não mascarar falhas no release da conexão.

**Limites do Monolito Modular:** Apesar da organização em módulos de domínio, toda a aplicação compartilha o mesmo processo e pool de recursos. Alterar um módulo isoladamente não permite reinício ou implantação independente.

## 2. CONTRATOS DE API

Atualmente, há inconsistências nos tipos e envoltórios de resposta retornados para o frontend.

**Contrato Proposto:**
- **Status HTTP:** 200/201 (Sucesso), 400 (Bad Request), 401 (Sessão Ausente/Inválida), 403 (Acesso Negado ao Módulo/Ação), 404 (Não Encontrado), 409 (Conflito), 500 (Erro Servidor).
- **Formato de Sucesso:** Padronizado como JSON raiz previsível `{ "ok": true, "data": { ... } }` ou o envelope direto, desde que a chave de sucesso esteja garantida em endpoints chave.
- **Formato de Erro:** `{ "ok": false, "error": "Mensagem detalhada", "code": "ERR_CODE" }`. O log com Request ID fica no backend; stack traces nunca são enviados ao cliente.
- **Paginação e Datas:** Uso de parâmetros de query `?page=x&limit=y` e respostas com formatação ISO 8601 e UTC universal.
- **Exceções Legítimas:** Serviços de geração de arquivo (PDF, XLSX) e Server-Sent Events (SSE) não devem ser encapsulados nesse envelope JSON.

**Ajuste Obrigatório (Compatibilidade Atual):**
- A rota testada do frontend espera um contrato restrito para validar o status da aplicação. A resposta oriunda de `versionHandler.js` (responsável por `/api/version`) deve continuar retornando a estrutura exata `{ "ok": true, "version": "...", "showTestBar": boolean }`.

## 3. AUTORIZAÇÃO

A política de autorização atual delega verificações demasiadas à ocultação visual no frontend e armazena chaves em cache estático com bugs implementados.

- **Avaliação Atual:** O `authMiddleware` valida a sessão do Redis. O `authController.js` avalia os grupos carregados do LDAP com o `configCache.js`. No entanto, a matriz de módulos retorna completa para o cliente, vazando todo o esquema de acesso.
- **Política Proposta:**
  - **Sessão ausente:** 401 nas rotas da API.
  - **Módulo não permitido:** 403. Proteção obrigatória executada no Service/Controller de retaguarda.
  - **Ação não permitida ou recurso restrito (Setor):** 403.
  - **Atribuição de Grupos:** Nenhuma inserção ou salvaguarda baseada em fallback hardcoded existirá (conforme verificado e isolado na Etapa 02). A inclusão de usuários em grupos assistenciais ou administrativos baseia-se unicamente em aprovação institucional no AD, sem tratamento de exceção em caso de falha de serviço de diretório.
  - O endpoint `GET /api/modulos` deve retornar unicamente as opções mapeadas e permitidas para o usuário logado.

## 4. ARQUITETURA DO FRONTEND

O Conecta HEAL utiliza Vanilla JavaScript com Enterprise ES Modules. Não haverá introdução de bundlers (Webpack/Vite) ou frameworks.

- **Organização de Código:** `index.html` evoca unicamente o `src/main.js`. Componentes modulares moram em `frontend/src/modules/`, baseados no Single Source of Truth do `core/state.js`.
- **Camada Visual:** Respeito absoluto ao `DESIGN_SYSTEM.md`. Proibição de estilos inline e uso exclusivo de tokens (`--primary`, `--slate-900`, etc).
- **Interface e Feedback (UX):** Modais e diálogos nativos pelo `core/ui.js` (`ui.showModal`, `ui.showConfirmModal`). Utilização obrigatória de Skeleton Loaders (ex: `ui.renderPacientesSkeleton()`) para preencher estados vazios durante carregamento ou fetch de API.
- **APIs e Estado:** Requisições através de `core/api.js`.

## 5. TESTES E QUALIDADE

- **Padrão de Qualidade:** Linting básico e validações com AST (Acorn) para rastrear aderência no Javascript.
- **Testes Unitários:** Baseados em suítes locais executando Node, mantendo a filosofia comprovada na Etapa 02 (`backend/test/etapa02_estabilizacao.test.js`): ambiente limpo utilizando mocks completos para Oracle e LDAP e injetores (DOM simulado). A suíte deve evitar que instâncias de serviço conectem-se na vida real para prover velocidade e independência.

## 6. GERENCIAMENTO DE ESTADO E DEPENDÊNCIAS

- **Credenciais:** Chaves de API, segredos e conexões devem ser lidos unicamente das variáveis de ambiente (`process.env`), devidamente validadas na inicialização do servidor.
- **Bancos e Cache:** Arquivos não devem ser usados para rastrear sessão ou estado perene se existirem dependências distribuídas disponíveis e seguras, para não romper a escalabilidade se instâncias múltiplas fossem adotadas.

## 7. PENDÊNCIAS DE ESTABILIZAÇÃO (ACHADOS ANTERIORES)

As seguintes lacunas devem ser corrigidas *antes* da criação de novas features:

1. **Bug no `configCache.js`:** Corrigir a dupla declaração de `perfilTemAcessoModulo`. A segunda sobrecreve a primeira (via *hoisting*), adotando uma comparação restritiva com `===` que conflita com as regras de *case-insensitive* (`toLowerCase`), quebrando avaliações legítimas.
2. **Oracle Connections:** Mover a requisição de conexão (`await db.getConnection()`) para **após** as validações de input para eliminar vazamentos imediatos constatados nos seguintes locais:
   - `recepcaoRepository.js` (linha 1583)
   - `recepcaoRepository.js` (linha 1047)
   - `setorService.js` (linha 41)
3. **Vazamento e Endpoints Expostos:**
   - Desativar o proxy aberto do `/api/painel/audio`, dado que a funcionalidade Text-to-Speech (TTS) foi migrada de fato para a API nativa do browser (`window.speechSynthesis`).
   - Bloquear e sanear acessos a relatórios sem autenticação.
4. **Higiene de Repositório Git:** Adicionar ao `.gitignore` e deletar do histórico (quando possível) arquivos com credenciais e bases de teste expostos:
   - `test-tasy.js`, `test-db-cancel.js` (contendo credenciais textuais Oracle).
   - Bancos SQLite estáticos vazando logs do repositório: `auth.sqlite`, `config.db`, `policy-cache.json`.

## 8. PLANO DE IMPLEMENTAÇÃO E MÓDULO PILOTO

A reestruturação será conduzida de forma gradual para manter as funcionalidades em produção inalteradas.

- **Fase 1: Remediações (Semanas 1-2)**
  - Focar nas pendências de estabilização listadas no tópico 7.
  - Implementar o padrão rigoroso no `core/api.js` e em `/version` para atestar a estabilidade sem expor o restante.
- **Fase 2: Adoção Base do Core Frontend (Semanas 3-4)**
  - Substituir comportamentos não conformes em rotas comuns (`alert()`, `confirm()`) pela biblioteca visual nativa em ES modules.
- **Fase 3: Módulo Piloto - `Dashboard` (Semana 5)**
  - O **Dashboard** atuará como o módulo piloto.
  - **Justificativa:** É focado fundamentalmente em leitura e cruzamento de dados agregados, sem possuir os cenários pesados de mutabilidade concorrente ou transações múltiplas encontrados no `Livro` ou na `Passagem`. Será perfeito para atestar que os novos envelopes (Status Code HTTP x JSON Error), os Skeletons do Frontend e a estrutura controlada do pool de conexão com o Oracle operam adequadamente em um cenário controlado.
- **Fase 4: Expansão (Semana 6+)**
  - Implementar progressivamente os padrões nos módulos `Registros`, `Escala`, `Livro` e `Passagem`.
