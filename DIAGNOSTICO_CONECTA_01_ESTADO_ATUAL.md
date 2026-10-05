# DIAGNÓSTICO CONECTA HEAL — 01 · ESTADO ATUAL

**Projeto:** Conecta HEAL Assistencial 2.0 (CONECTA_MODULAR)  
**Diretório Raiz:** `/media/SAAS/SAAS/CONECTA_MODULAR`  
**Data da Auditoria:** 2026-10-01  
**Escopo:** Auditoria inicial estática e de inspeção local (somente leitura). Nenhum código existente, configuração ou dependência foi modificado. Nenhuma escrita em banco de dados ou serviço externo foi executada.  
**Branch:** `master` · **Último Commit:** `c2bd0c0` (`fix(infra): restaurar funcionamento do Conecta 2.0...`)

---

## Sumário Executivo

O **Conecta HEAL Assistencial 2.0** é uma aplicação hospitalar em produção/homologação de porte médio (~48.900 linhas de código JS, HTML e CSS). Trata-se de um sistema **funcional e conectado a serviços reais**: os módulos operam com consultas e gravações diretas no banco de dados Oracle/TASY via modo Thick (`oracledb`), persistência de sessões e filas em Redis 7, e controle local de parametrizações em SQLite (`auth.sqlite/config.db`). Não foram encontrados mocks de banco nem dados clínicos fictícios.

Entretanto, a auditoria identificou vulnerabilidades e inconformidades relevantes nas camadas de **autorização, integridade de conexões, disciplina de testes e governança de infraestrutura**:

1. **Bypass de Autorização Crítico no LDAP (`ldapService.js:216-220`):** Quando a busca de grupos no Active Directory não retorna registros (por exemplo, em falha transitória do AD), dois nomes de usuário literais recebem automaticamente o grupo `API_CONECTA_ADMIN`, obtendo privilégio administrativo total sobre ~72 rotas sensíveis do sistema.
2. **Exposição de Dados Identificáveis de Pacientes no Painel TV (`painel/routes.js:9-14`, `routes.js:72`):** As rotas do painel de senhas do saguão são montadas sem middleware de autenticação, expondo publicamente na rede interna o nome completo de pacientes chamados via `GET /painel/:id/estado`, além de proxy irrestrito para TTS externo.
3. **Duplicação da Função Central de Autorização (`configCache.js:725` e `:764`):** A função `perfilTemAcessoModulo` está declarada duas vezes no mesmo arquivo. Em JavaScript, a segunda sobrescreve a primeira, transformando o tratamento *case-insensitive* e de *trim* em código morto e tornando a checagem estrita (*case-sensitive*).
4. **Vazamento Crítico de Conexão Oracle (`dashboardRepository.js:41-52`):** `getConnection()` é chamado e, logo em seguida, uma validação de parâmetro lança exceção *fora* do bloco `try/finally`. A conexão não é liberada para o pool, permitindo exaustão de conexões com poucas requisições inválidas.
5. **Falso Alarme Permanente na Interface (`utils.js:138` vs `routes.js:28`):** O frontend consulta `/api/ping`, mas o backend expõe `/api/version`. A falha 404 faz com que o rodapé da aplicação permaneça permanentemente em estado "offline / Serviço temporariamente indisponível", treinando os operadores a ignorar alertas visuais.
6. **Cobertura Ilusória de Testes Automatizados:** A suíte de 41 testes (`npm test`) cobre primordialmente validações utilitárias de entrada. Não existe teste unitário cobrindo autorização, matriz de permissões ou operações Oracle. Além disso, a inicialização do cache (`configCache.load()`) executa migrações DDL/DML em SQLite no momento da leitura; quando executado em diretório sem permissão de escrita, falha silenciosamente e esvazia o cache em memória (gerando 8 falhas em testes locais).

---

## 1. VISÃO GERAL

### 1.1 Estrutura de Diretórios, Tecnologias e Versões Declaradas

O projeto está organizado na raiz `/media/SAAS/SAAS/CONECTA_MODULAR`:

```
CONECTA_MODULAR/
├── backend/
│   ├── server.js                          # Entry point Express (350 linhas)
│   ├── src/
│   │   ├── routes.js                      # Roteador central da API (75 linhas)
│   │   ├── core/                          # Infraestrutura compartilhada
│   │   │   ├── config/                    # configCache, ldap, redisClient, modulos
│   │   │   ├── database/                  # Pool Oracle (index.js), auditDatabase (SQLite)
│   │   │   ├── middlewares/               # authMiddleware, errorHandler, responseHandler, correlationId
│   │   │   ├── errors/                    # AppError.js
│   │   │   └── utils/                     # logger, auditLogger, acesso, parseBoolean
│   │   └── modules/                       # 12 módulos de domínio backend
│   └── test/                              # 11 arquivos de teste Node.js nativos
├── frontend/
│   ├── index.html                         # SPA principal do Conecta Assistencial (1.966 linhas)
│   ├── admin.html                         # Painel Administrativo de Perfis/Configurações (5.376 linhas)
│   ├── painel.html                        # Interface de TV para chamada de senhas (112 linhas)
│   ├── builder.html                       # Conecta Studio / construtor de telas (319 linhas)
│   ├── src/
│   │   ├── main.js                        # Ponto de entrada do frontend SPA
│   │   ├── core/                          # api, auth, router, state, moduleLoader, ui, draft, utils
│   │   └── modules/                       # 8 módulos de interface do usuário
│   ├── css/
│   │   ├── style.css                      # Folha de estilo monolítica principal (9.011 linhas)
│   │   ├── main.css, builder.css, skeleton.css
│   │   └── modules/                       # 8 folhas de estilo de domínio (6 vazias com 0 bytes)
│   └── js/builder.js                      # Lógica do Conecta Studio (2.019 linhas)
├── auth.sqlite/
│   └── config.db                          # Banco SQLite com 15 tabelas de configuração e auditoria
├── data/
│   └── policy-cache.json                  # Cache de políticas de autorização em disco
├── instantclient-files/                   # Binários do Oracle Instant Client 19c (~234 MB)
├── docker-compose.yml                     # Orquestração dos serviços node (3020) e redis (6379)
├── Dockerfile                             # Container node:24-alpine com Oracle Thick mode
├── docker-entrypoint.sh                   # Normalização de permissões de volume e su-exec node
├── ecosystem.config.js                    # Configuração PM2 para execução bare-metal
├── run.sh                                 # Script de execução local com caminhos absolutos
├── package.json, package-lock.json        # Metadados e dependências Node.js
├── README.md, ARQUITETURA_E_PADROES.md    # Documentação de arquitetura e padrões
├── DESIGN_SYSTEM.md, AUDITORIA_PRE_PRODUCAO.md # Diretrizes de design e auditoria prévia
└── fix-*.js, test-*.js                    # 11 scripts ad-hoc não versionados na raiz
```

#### Tecnologias e Versões Declaradas (`package.json`)

| Componente | Especificação Declarada | Observações / Divergências |
|---|---|---|
| Nome do Pacote | `passagem-plantao` | Não reflete o nome oficial Conecta HEAL 2.0 |
| Versão | `2.2.1` | Alinhada em `routes.js:33` e `index.html` |
| Runtime | Node.js (imagem `node:24-alpine` no Dockerfile) | Comentário no topo do Dockerfile ainda cita Node 18 |
| Framework Backend | Express `^4.18.2` | Padrão CommonJS |
| Driver Oracle | `oracledb ^6.6.0` (instalado `6.10.0`) | Configurado em modo Thick com Instant Client 19c |
| Banco de Configuração | `sqlite3 ^6.0.1` | Arquivo `auth.sqlite/config.db` (WAL) |
| Cache & Sessão | `redis ^4.6.13`, `connect-redis ^7.1.1` | Redis 7 Alpine no Compose |
| Rate Limiting | `express-rate-limit ^7.1.4`, `rate-limit-redis ^4.2.0` | 20 req/15min em `/login` |
| Autenticação Corporativa | `ldapjs ^3.0.7` | Integração Active Directory (porta 389) |
| Segurança HTTP | `helmet ^7.1.0` | CSP, HSTS e CORP desabilitados em `server.js:74-78` |
| Geração de Documentos | `exceljs ^4.4.0`, `pdfkit ^0.19.1` | Exportação de auditorias e espelhos |
| Process Manager | `pm2 ^7.0.4` | Usado via `ecosystem.config.js` |
| Frontend | Vanilla JavaScript (ES Modules nativos) | Sem bundler (Vite/Webpack), sem framework (React/Vue) |

### 1.2 Organização de Frontend e Backend

- **Backend:** Arquitetura em camadas com separação em Domain-Driven Design (DDD):
  - Camada de Transporte/Roteamento: `backend/src/routes.js` e `backend/src/modules/*/routes.js`.
  - Camada de Controle: `*Controller.js`.
  - Camada de Serviço (Regras de Negócio): `*Service.js`.
  - Camada de Acesso a Dados: `*Repository.js` (queries Oracle parametrizadas).
  - Camada Transversal (`core/`): middlewares (`authMiddleware`, `errorHandler`, `responseHandler`, `correlationIdMiddleware`), banco (`index.js`), configuração em cache (`configCache.js`), e logging estruturado (`logger.js`, `auditLogger.js`).
- **Frontend:** Single Page Application (SPA) em ES Modules:
  - `frontend/index.html`: Shell da aplicação contendo modais e workspaces.
  - `frontend/src/main.js`: Ponto de entrada, boot do ciclo de vida, listeners globais e verificação de sessão.
  - `frontend/src/core/`: 7 utilitários transversais (`api.js`, `auth.js`, `draft.js`, `moduleLoader.js`, `router.js`, `state.js`, `ui.js`, `utils.js`).
  - `frontend/src/modules/`: 8 módulos isolados carregados sob demanda via dynamic `import()`.
  - Interfaces auxiliares dedicadas: `admin.html` (painel administrativo), `painel.html` (TV de atendimento) e `builder.html` (Studio).

### 1.3 Pontos de Entrada e Comandos

Declarados em `package.json`:
- `npm start`: Inicia o servidor via `node backend/server.js`.
- `npm run dev`: Inicia em modo observador nativo `node --watch backend/server.js`.
- `npm test`: Executa os testes nativos com `node --test backend/test/*.test.js backend/src/modules/auth/*.test.js`.
- `npm run test:sso`: Executa testes específicos de SSO.
- `npm run db:init`: Executa `node scripts/init-config-db.js` para recriação do SQLite.
- `npm run prod:start | stop | restart | logs`: Comandos de gerenciamento bare-metal via PM2.

*Nota:* Não existem scripts de `build`, `lint`, `format` ou `typecheck` definidos no `package.json`.

### 1.4 Estado do Git

- **Branch Atual:** `master` (sincronizada com `origin/master`).
- **Último Commit:** `c2bd0c0` (`fix(infra): restaurar funcionamento do Conecta 2.0 removendo CSP/HSTS no HTTP e ativando Thick mode com libaio`).
- **Remote Origin:** Aponta para servidor GitLab interno (`git.heal.br`), contendo credencial de usuário embutida na URL:
  `http://pedro.cesario:***@git.heal.br/pedro.cesario/CONECTA-MODULAR.git` (registrado como achado de segurança, credencial mascarada).
- **Modificações de Conteúdo no Working Tree (17 arquivos):**
  - Configurações e bancos: `docker-compose.yml`, `auth.sqlite/config.db`, `data/policy-cache.json`.
  - Backend: `dashboardRepository.js`, `painelController.js`, `recepcaoController.js`, `recepcaoRepository.js`, `recepcaoService.js`, `routes.js`, `tasyReportsClient.js`, `configCache.js`.
  - Frontend: `index.html`, `painel.html`, `painel.css`, `recepcao.css`, `painel.js`, `recepcao.js`.
- **Arquivos Não Rastreados (Untracked - 14 arquivos):**
  - Documentos e artefatos: `DIAGNOSTICO_CONECTA_01_ESTADO_ATUAL - OpenCode.md`, `PDFReport-41ab49ed-daa0-45a7-8d6f-4121685901e9.pdf`.
  - Testes: `backend/test/audit.test.js`, `backend/test/internacao_senha.test.js`.
  - Scripts de manutenção direta na raiz: `fix-hoje.js`, `fix-js.js`, `fix-js2.js`, `fix-modal.js`, `fix-query.js`, `fix-syntax.js`, `fix-ui.js`, `test-cols.js`, `test-db-cancel.js`, `test-db.js`, `test-tasy.js`.
- **Modificações de Permissão (FileMode):** 36 arquivos aparecem com `mode change 100644 => 100755` devido à ação prévia do `docker-entrypoint.sh` ao normalizar permissões de bind mount no container.

---

## 2. MÓDULOS

Classificação adotada:
- **INTEGRADO:** Conecta-se a serviços reais (Oracle, Redis, LDAP) com queries e regras ativas.
- **PARCIAL:** Integrado ao backend real, mas com inconsistências de código, chamadas a métodos inexistentes ou brechas de integridade.
- **SIMULADO:** Utiliza dados estáticos, mockados ou gerados artificialmente em memória.
- **NÃO VERIFICADO:** Rota ou tela presente, mas comportamento não auditável em tempo de execução sem interação externa.

### 2.1 Passagem de Plantão (`passagem`)
- **Finalidade:** Registro de anotações e cuidados críticos de enfermagem por paciente, lançamento em lote por setor, histórico e assinatura digital do plantão.
- **Telas / Rotas Frontend:** Workspace `#workspace-passagem` em `frontend/index.html`; módulo `frontend/src/modules/passagem/passagem.js` (1.118 linhas).
- **Endpoints Backend:**
  - `POST /api/lote/draft`, `GET /api/lote/draft`, `DELETE /api/lote/draft` (rascunhos rápidos em Redis).
  - `POST /api/salvar` (gravação em lote de ocorrências).
  - `GET /api/passagens/anteriores`, `GET /api/passagens/setores-historico`.
- **Serviços / Integrações:** Tabela Oracle `OCORRENCIA` (`ocorrenciaService.js`, `ocorrenciaRepository.js`); rascunhos assíncronos no Redis (`sess:` / draft engine).
- **Autenticação & Permissões:** `requirePermission('passagem')`, `requirePermission('passagem', 'lancar_nova_passagem')`.
- **Estado Observado:** **INTEGRADO**.
- **Evidências:** Inserções e consultas reais em `OCORRENCIA` via `ocorrenciaRepository.js:15-180`; checkboxes dinâmicos carregados do SQLite (`configCache.getActivePassagemCheckboxes()`).

### 2.2 Dashboard de Leitos de Internação (`dashboard`)
- **Finalidade:** Visão gráfica de ocupação dos leitos hospitalares por setor, status de prescrição, medicações suspensas, materiais e alta médica.
- **Telas / Rotas Frontend:** Workspace `#workspace-dashboard` em `frontend/index.html`; `frontend/src/modules/dashboard/dashboard.js` (1.475 linhas).
- **Endpoints Backend:**
  - `GET /api/dashboard/setores`
  - `GET /api/dashboard/pacientes`
  - `GET /api/dashboard/internacao`
  - `GET /api/dashboard/internacao/detalhes/:nrAtendimento`
- **Serviços / Integrações:** Views e tabelas Oracle `atendimento_paciente_v`, `paciente_internado_atual_v`, `cpoe_material`, `cpoe_procedimento`. Cache de setores em memória (`configCache`).
- **Autenticação & Permissões:** `requireAuth` na montagem central de `/api/dashboard`. Validações manuais em `dashboardController.js`.
- **Estado Observado:** **PARCIAL** (Funcional, porém com vazamento crítico de conexão Oracle).
- **Evidências:** `dashboardRepository.js:41-52` chama `getConnection()` e executa validação que lança erro fora do `try`, vazando a conexão quando `cdSetor` é inválido. Pré-aquecimento em runtime dos setores 68, 28, 34, 59 e 83 confirmado nos logs do container.

### 2.3 Dashboard P.A. & Regulação de Vagas PSI (`dashboard_pa`)
- **Finalidade:** Acompanhamento da fila do Pronto Atendimento, tempo de espera, regulação de internação psiquiátrica e transição para leito.
- **Telas / Rotas Frontend:** Integrado ao módulo `frontend/src/modules/dashboard/dashboard.js` e modais em `index.html`.
- **Endpoints Backend:** Sub-rotas sob `/api/dashboard/internacao` e `POST /api/dashboard/internacao/acao`.
- **Serviços / Integrações:** Tabelas Oracle `GESTAO_VAGA`, `GESTAO_VAGA_HIST`, `PACIENTE_SENHA_FILA`.
- **Autenticação & Permissões:** `requireAuth` na rota agregadora.
- **Estado Observado:** **INTEGRADO**.
- **Evidências:** Regra de negócio em `dashboardRepository.js:200-350` cancela senha anterior e gera nova senha na fila configurada (Fila 18 - PA - INTERNAÇÃO).

### 2.4 Livro Administrativo de Enfermagem (`livro`)
- **Finalidade:** Montagem da equipe de enfermagem do plantão, alocação de técnicos, cobertura de pátio, circulante, procedimentos de ECT e espelho do livro.
- **Telas / Rotas Frontend:** Workspace `#workspace-livro` em `frontend/index.html`; `frontend/src/modules/livro/livro.js` (2.794 linhas — maior arquivo do frontend).
- **Endpoints Backend:** `POST /api/livro-administrativo`, `GET /api/livro-administrativo`.
- **Serviços / Integrações:** Tabela Oracle `OCORRENCIA` com perfil administrativo de enfermagem.
- **Autenticação & Permissões:** `requirePermission('livro')`.
- **Estado Observado:** **PARCIAL**.
- **Evidências:** `livro.js:14` chama `auth.validarPerfil()`, que não é exportado por `frontend/src/core/auth.js`. O erro é latente porque a função não é invocada no fluxo padrão atual, mas quebrará com `TypeError` caso seja executada.

### 2.5 Gestão de Escalas (`escala`)
- **Finalidade:** Visualização e edição da grade semanal de profissionais de Psicologia e Enfermagem, publicação atômica e versionamento.
- **Telas / Rotas Frontend:** Workspace `#workspace-escala` em `frontend/index.html`; `frontend/src/modules/escala/escala.js` (684 linhas).
- **Endpoints Backend:**
  - `GET/PUT /api/escala-ativa/`
  - `GET /api/escala-ativa/periodo`, `/patio-circulante-global`, `/versoes`, `/versao`, `/diff`
  - `POST /api/escala-psicologia/publicar`, `GET /api/escala-psicologia/liberadas`
  - `POST /api/escala-tecnica`, `GET /api/escala-tecnica`, `GET /api/escala-tecnica/todas`
- **Serviços / Integrações:** Tabelas Oracle `CONECTA_ESCALA_ATIVA` e `CONECTA_ESCALA_LOG`.
- **Autenticação & Permissões:** `requireAuth` em `/escala-ativa`; `requirePermission('escala', 'editar_publicar_escala')` nas publicações.
- **Estado Observado:** **PARCIAL**.
- **Evidências:**
  - `escala.js:332` e `:673`: Dois event listeners conflitantes registrados no botão `#btn-escala-limpar`, disparando ações e mensagens contraditórias ao mesmo clique.
  - `escala.js:8`: Importa `showJustificativaModal` diretamente de `../livro/livro.js`, forçando o download imediato de 2.794 linhas e anulando o lazy loading.
  - `escala.js:640`: Uso de `window.prompt` em desacordo com o Design System.

### 2.6 Registros & Demanda Espontânea (`registros`)
- **Finalidade:** Busca rápida de pessoas físicas por CPF/Nome/CNS e registro de atendimentos de demanda espontânea.
- **Telas / Rotas Frontend:** Workspace `#workspace-registros` em `frontend/index.html`; `frontend/src/modules/registros/registros.js` (826 linhas).
- **Endpoints Backend:** `GET /api/registros/tipos`, `GET/POST /api/registros/pessoas`, `GET/PUT /api/registros/pessoas/:id`, `POST /api/registros/`, `GET /api/registros/historico`.
- **Serviços / Integrações:** Tabelas Oracle `PESSOA_FISICA`, `PESSOA_FISICA_HISTORICO`, `VALOR_DOMINIO`.
- **Autenticação & Permissões:** `requireAuth` na montagem central de `/api/registros`.
- **Estado Observado:** **INTEGRADO**.
- **Evidências:** Consultas e inserções em `registroRepository.js:20-220`.

### 2.7 Auditorias Assistenciais (`auditorias`)
- **Finalidade:** Auditoria observacional dos 5 momentos de Higiene de Mãos (OMS) e checklist de Processos Assistenciais (metas de segurança, identificação do paciente, quedas).
- **Telas / Rotas Frontend:** Workspace `#workspace-auditorias` em `frontend/index.html`; `frontend/src/modules/auditorias/auditorias.js` (1.087 linhas).
- **Endpoints Backend:** 17 rotas sob `/api/auditorias` (incluindo exportação `/xlsx` e `/pdf`).
- **Serviços / Integrações:** Tabelas Oracle `CONECTA_AUD_NISA`, `CONECTA_AUD_NISA_PROF`, `CONECTA_AUD_PROCESSOS`; SQLite `auditDatabase.js`. Exportação com bibliotecas `exceljs` e `pdfkit`.
- **Autenticação & Permissões:** `requireAuth` na rota raiz de auditorias.
- **Estado Observado:** **PARCIAL**.
- **Evidências:** `auditoriaRepository.js:26` e `:45` possuem `cd_setor_atendimento: 48` chumbado no bind de busca e validação de avaliadores.

### 2.8 Recepção e Acolhimento (`recepcao`)
- **Finalidade:** Gestão completa do fluxo de recepção: filas de espera, chamada e rechamada de senhas por guichê, cadastro/edição de pessoa física, abertura de atendimento âncora, seleção de convênios/categorias, emissão de relatórios TASY (ex: guias TISS SP/SADT 70125, boletim de emergência) e anexo de documentos GED.
- **Telas / Rotas Frontend:** Workspace `#workspace-recepcao` em `frontend/index.html`; `frontend/src/modules/recepcao/recepcao.js` (1.570 linhas).
- **Endpoints Backend:** 21 rotas sob `/api/recepcao`.
- **Serviços / Integrações:** Tabelas Oracle `PESSOA_FISICA`, `ATENDIMENTO_PACIENTE`, `PACIENTE_SENHA_FILA`, `CONTA_PACIENTE`, `DOCUMENTO_PACIENTE`. Integração HTTP com TasyAppServer via `tasyReportsClient.js` (405 linhas).
- **Autenticação & Permissões:** O roteador `/api/recepcao` é montado em `routes.js:71` **sem** `requireAuth`, mas todas as suas rotas internas invocam `requirePermission` (`reqRec`).
- **Estado Observado:** **INTEGRADO COM RESSALVAS**.
- **Evidências:** Emissão real de relatórios via procedure Oracle `TISS_GERAR_W_GUIA_SPSADT` e HTTP no TasyAppServer. Ressalvas: execução de SQL dinâmico sem whitelist em `recepcaoRepository.js:1071`, descarte de `cdMotivo` no cancelamento de atendimento (`recepcaoRepository.js:1702-1721`), e uso de método HTTP `GET` para ação com efeito colateral em `/relatorios/:id/gerar`.

### 2.9 Painel Conecta TV (`painel` / `painel_senhas`)
- **Finalidade:** Exibição contínua em TVs de sala de espera e triagem das últimas senhas chamadas, alerta sonoro, síntese de voz (TTS) e atualização em tempo real via Server-Sent Events (SSE).
- **Telas / Rotas Frontend:** `frontend/painel.html` (112 linhas), `frontend/src/modules/painel/painel.js` (610 linhas), `frontend/src/modules/painel/painel_senhas.js` (171 linhas).
- **Endpoints Backend:** `GET /api/painel/audio`, `GET /api/painel/detectar-maquina`, `GET /api/painel/minha-tv`, `GET /api/painel/:id/estado`, `GET /api/painel/:id/stream`.
- **Serviços / Integrações:** Tabela Oracle `PACIENTE_SENHA_FILA`; SSE via `painelEventsService.js`; proxy de áudio TTS via Google Translate.
- **Autenticação & Permissões:** **TOTALMENTE PÚBLICO** (declarado em comentário em `painel/routes.js:9` como intencional para TVs do saguão).
- **Estado Observado:** **INTEGRADO COM EXPOSIÇÃO DE DADOS PESSOAIS**.
- **Evidências:** `painelController.js:70,215,223` retorna o nome completo do paciente (`COALESCE(psf.nm_paciente, pf.nm_social, pf.nm_pessoa_fisica)`) na resposta pública desautenticada de `GET /api/painel/:id/estado`.

### 2.10 Painel Administrativo (`admin`)
- **Finalidade:** Gestão centralizada de perfis, módulos, permissões dinâmicas, setores permitidos, checkboxes da passagem, filas do Dashboard P.A., mapeamento IP/máquina para guichê, painéis de TV, relatórios TASY, auditoria LGPD e telemetria de infraestrutura.
- **Telas / Rotas Frontend:** `frontend/admin.html` (5.376 linhas); `frontend/builder.html` e `frontend/js/builder.js`.
- **Endpoints Backend:** ~72 endpoints sob `/api/admin`.
- **Serviços / Integrações:** SQLite `auth.sqlite/config.db` (15 tabelas).
- **Autenticação & Permissões:** `requireAuth` + `requireAdmin` aplicados em `routes.js:62`.
- **Estado Observado:** **PARCIAL**.
- **Evidências:** Funcional, mas a rota `/api/passagem/checkboxes` em `routes.js:50` utiliza diretamente `adminController.listarCheckboxesAtivos` protegida apenas por `requireAuth`, sem `requireAdmin`. Além disso, no Studio, falhas de rede no salvamento exibem feedback de falso sucesso local (`builder.js:2005`).

### 2.11 Módulos Auxiliares de Apoio (`usuarios` e `setores`)
- **Finalidade:** Listagem de profissionais de enfermagem, técnicos, psicólogos e setores ativos de internação e livro.
- **Endpoints Backend:** `/api/tecnicos`, `/api/enfermeiros`, `/api/profissionais-psicologia`, `/api/setores/*`.
- **Serviços / Integrações:** Tabelas Oracle `PESSOA_FISICA`, `USUARIO`, `SETOR_ATENDIMENTO`.
- **Autenticação & Permissões:** Rotas internas protegidas com `requireAuth`.
- **Estado Observado:** **INTEGRADO**.

---

## 3. BACKEND

### 3.1 Organização de Rotas, Controllers, Serviços e Repositórios

A arquitetura do backend segue uma estrutura clara de separação em quatro camadas:
1. **Roteador (`routes.js` e `modules/*/routes.js`):** Intercepta a requisição HTTP, aplica middlewares de autenticação/autorização e direciona ao controller.
2. **Controller (`*Controller.js`):** Extrai dados de `req.body`, `req.params`, `req.query` e `req.session.usuario`, invoca o service e retorna a resposta via helper ou JSON padronizado.
3. **Service (`*Service.js`):** Implementa fluxos de negócio, orquestração de transações e validações de regras operacionais.
4. **Repository (`*Repository.js`):** Isola as instruções SQL, gerencia a obtenção e devolução de conexões do pool Oracle e mapeia os resultados.

*Exceções identificadas:*
- O módulo `painel` não possui repositório próprio; suas queries SQL são executadas diretamente dentro de `painelController.js:51-82`.
- `recepcaoRepository.js` possui 1.727 linhas, concentrando regras de negócios sobre controle de duplicidade de senhas, validações de convênio e emissão de guias TISS que deveriam residir na camada de serviço.

### 3.2 Regras de Negócio e Consultas SQL

- **Localização:** Predominantemente nos repositórios (`*Repository.js`).
- **Parametrização:** A grande maioria das queries utiliza binds nomeados (`:cd_setor`, `:nr_atendimento`), prevenindo injeção de SQL tradicional.
- **Exceção Crítica de SQL Dinâmico (`recepcaoRepository.js:1061-1072`):**
  A consulta do relatório é lida da coluna `relatorio.ds_sql` e executada diretamente via `conn.execute(sql, { nr_atendimento: nAtend })` sem whitelist de comandos ou sanitização.

### 3.3 Validação de Entrada, Respostas de API e Tratamento de Erros

- **Validação de Entrada:** É realizada manualmente com checagens imperativas (`if (!cdSetor) ...`). Não há uso de bibliotecas de validação de esquema estruturado (como Joi, Zod ou Yup).
- **Padronização de Resposta:** `backend/src/core/middlewares/responseHandler.js` fornece o envelope `{ success: true, data: ..., message: ... }`.
- **Tratamento de Exceções:** `backend/src/core/middlewares/errorHandler.js` intercepta erros não tratados, mapeia instâncias de `AppError` e evita vazamento de stacktraces em produção.
- **Rastreabilidade:** `backend/src/core/middlewares/correlationIdMiddleware.js` gera ou propaga o cabeçalho `X-Request-Id`, inserindo-o nos logs de acesso e de erro.

### 3.4 Conexões Oracle, Pools, Transações e Liberação de Recursos

O gerenciamento de banco de dados reside em `backend/src/core/database/index.js`:
- **Modo do Driver:** Thick Mode ativado explicitamente via detecção de `libclntsh.so.19.1` em diretórios candidatos.
- **Configuração Global de Commit:** `oracledb.autoCommit = false` (linha 4). As transações exigem commit explícito ou opção `{ autoCommit: true }` no método `execute`.
- **Dimensionamento do Pool:** Mínimo de 3 e máximo de 15 conexões (`DB_POOL_MIN`, `DB_POOL_MAX`), com incremento de 2 e timeout de fila de 10 segundos.
- **Timeout de Chamada:** Configurado globalmente via `oracledb.callTimeout = 30000` (30s).
- **Vazamento de Conexão Confirmado:**
  Em `dashboardRepository.js:41-52`, a chamada `await getConnection()` precede validações que lançam `throw new Error('Setor inválido')` fora do bloco `try/finally`. Se o parâmetro for inválido, a conexão nunca é fechada e permanece presa, reduzindo a capacidade do pool.
- **Omissão de Campo em Operação DML:**
  Em `recepcaoRepository.js:1702-1723`, a função `cancelarAtendimento(nrAtendimento, usuario, cdMotivo)` recebe `cdMotivo`, mas o comando SQL de atualização omite a coluna correspondente, descartando o motivo do cancelamento sem registrá-lo no banco.

### 3.5 Logs, Auditoria, Cache e Tarefas Agendadas

- **Logs:** `core/utils/logger.js` provê log estruturado; `server.js:31-38` registra tempo de resposta e correlation ID de cada requisição.
- **Trilha de Auditoria:** `auditLogger.js` e `auditDatabase.js` gravam eventos na tabela `conecta_audit_trail` do SQLite (usuário, ação, recurso, IP, data/hora).
- **Cache:** `configCache.js` (1.210 linhas) mantém em memória perfis, permissões, setores e mapeamento de guichês a partir do SQLite, com cópia serializada em `data/policy-cache.json`.
- **Tarefas Agendadas (Cron):** **Ausentes**. Não há cron jobs, workers em background ou `setInterval` de rotinas de limpeza. Toda operação é reativa a requisições HTTP, exceto o pré-aquecimento inicial de cache no boot (`server.js:293-296`).

### 3.6 Integrações Externas

| Sistema / Serviço | Localização no Código | Mecanismo | Protocolo / Porta |
|---|---|---|---|
| Oracle TASY HML | `core/database/index.js` | Driver nativo Thick via pool | SQL*Net / TCP 1521 |
| Active Directory / LDAP | `modules/auth/ldapService.js` | `ldapjs` com bind administrativo | LDAP / TCP 389 |
| Redis Cache / Sessões | `core/config/redisClient.js` | `node-redis` v4 com reconexão | Redis / TCP 6379 |
| TasyAppServer (Relatórios) | `modules/recepcao/tasyReportsClient.js` | HTTP client (token/basic) | HTTP REST |
| Google Translate TTS | `modules/painel/painelController.js` | Proxy HTTP streaming de MP3 | HTTPS externo |

### 3.7 Duplicações e Diferenças de Padrão

- **Duplicação de `perfilTemAcessoModulo`:** Declarada na linha 725 (versão com tratamento *case-insensitive* e `trim`) e redeclarada na linha 764 (versão estrita *case-sensitive*) de `configCache.js`. A segunda sobrescreve a primeira.
- **Inconsistência na Montagem de Rotas:** Os módulos `usuarios`, `ocorrencias`, `recepcao` e `painel` são montados em `routes.js` sem o middleware `requireAuth`. Embora `recepcao`, `usuarios` e `ocorrencias` protejam suas rotas internamente, a ausência de um padrão unificado no nível superior aumenta o risco de endpoints desprotegidos.
- **Erros de Sintaxe de Importação (Typos `.//`):** Encontrados imports com barra dupla (`.//`) em diversos arquivos (ex: `authController.js:3,6,8,9`). Embora resolvidos pelo Node.js, evidenciam falta de pipeline automatizado de linting.

---

## 4. FRONTEND

### 4.1 Organização de Páginas, Componentes e Serviços

O frontend opera como uma aplicação SPA estática servida pelo backend Node.js (`server.js:152-186`), dividida em:
- `index.html`: Interface operacional única para Passagem, Dashboard, Livro, Escala, Auditorias e Registros.
- `src/main.js`: Ponto de inicialização que gerencia transições de tela e escuta eventos de clique na navegação.
- `src/core/moduleLoader.js`: Realiza importação dinâmica assíncrona (`import(`./modules/${name}/${name}.js`)`) ao trocar de modo de trabalho.

*Falha no Cache Busting:*
O versionamento estático em `server.js:169` utiliza regex procurando `\?v=[^"'\s]*`. Se algum `<script>` ou recurso não incluir previamente o parâmetro `?v=`, o hash de versão não é injetado, podendo causar problemas de cache em navegadores de postos de enfermagem.

### 4.2 Biblioteca Visual, Estilos e Componentes Compartilhados

- **Design System:** Documentado em `DESIGN_SYSTEM.md`, baseado em tokens de cores CSS (`--slate-*`, `--primary`, `--green-600`).
- **Folhas de Estilo:**
  - `style.css`: Arquivo monolítico de 9.011 linhas contendo quase todas as declarações CSS do sistema.
  - `main.css`: Importa as folhas de estilo dos módulos via `@import url('modules/*.css')`.
  - **Falha na Modularização de CSS:** Das 8 folhas dentro de `frontend/css/modules/`, **6 estão com 0 bytes** (`auditorias.css`, `dashboard.css`, `escalas.css`, `livro.css`, `passagem.css`, `registros.css`). Toda a estilização real dessas telas foi acumulada dentro do `style.css`.
- **Skeleton Screens:** Implementados em `css/modules/skeleton.css` (242 linhas) para transições visuais de carregamento.

### 4.3 Comunicação com a API e Gerenciamento de Estado

- **Cliente HTTP (`core/api.js`):** Wrapper de `fetch` que injeta o cabeçalho `X-Request-Id`. Entretanto, ao receber status `401 Unauthorized`, **não realiza redirecionamento global automático** nem limpa o estado da sessão de forma centralizada; a tratativa depende de cada módulo individualmente.
- **Estado Global Centralizado (`core/state.js`):** Objeto único reativo exportado contendo dados de usuário, setores carregados, pacientes, rascunhos e contexto de perfil.
- **Duplicação de Funções Utilitárias:** Módulos de tela reimplementam helpers como `escapeHtml`, formatação de data e clientes de toast em vez de consumir os métodos já centralizados em `core/utils.js` e `core/ui.js`.
- **Requisições Redundantes de Sessão:** `registros.js:826` e `auditorias.js:1087` acionam `setTimeout(refreshAccess, 250)`, gerando 2 a 4 chamadas extras a `/api/me` e `/api/modulos` a cada carga de módulo.

### 4.4 Estados de Carregamento, Erro, Vazio e Sucesso

- Módulos mais recentes (Recepção e Painel) adotam skeleton loaders, modais de confirmação e banners de vazio estruturados.
- Módulos mais antigos mantêm chamadas legadas a `window.prompt` (`escala.js:640`) e `alert()`, gerando experiência heterogênea.

### 4.5 Regras de Negócio Chumbadas no Frontend

Constatou-se a presença de identificadores de setor, fila e classificação diretamente no código JavaScript do frontend:
- `recepcao.js:1337`: Fila de destino de internação fixada como `nr_fila_destino: 18`.
- `escala.js:191, 589, 638`: Setor fixado como `cd_setor = 4`.
- `recepcao.js:1203, 1330`: Setor 39 e convênio 3 fixados.
- `painel.js:7`: Painel padrão `recepcao_principal`.

Esses valores deveriam ser obtidos via `configCache` e configuráveis pela tela de administração.

### 4.6 Bugs Confirmados no Frontend

| Código | Descrição do Bug | Arquivo e Linha | Evidência e Comportamento |
|---|---|---|---|
| **F-1** | Endpoint de Ping Inexistente | `frontend/src/core/utils.js:138` | Chama `/api/ping`. O backend define apenas `/api/version`. O catch dispara sempre, travando o status visual em "offline" com mensagem "Serviço temporariamente indisponível". |
| **F-2** | Conflito de Listeners no Botão Limpar | `frontend/src/modules/escala/escala.js:332` e `:673` | Dois listeners escutam o mesmo `#btn-escala-limpar`: um descarta alterações pendentes da semana e outro limpa o formulário de psicologia com mensagem "Formulário limpo". Ambos rodam juntos. |
| **F-3** | Invocação de Método Inexistente | `frontend/src/modules/livro/livro.js:14` | Executa `auth.validarPerfil()`, porém `core/auth.js` não exporta essa função. (Erro latente). |
| **F-4** | Quebra de Padrão com `window.prompt` | `frontend/src/modules/escala/escala.js:640` | Utiliza prompt nativo do navegador para coletar justificativa, em conflito com o Design System. |
| **F-5** | Feedback Enganoso no Conecta Studio | `frontend/js/builder.js:2005-2009` | Se a requisição POST de salvar tela falhar (401, 500 ou rede), exibe botão verde "Salvo Localmente!", mascarando o erro para o usuário. |
| **F-6** | Quebra do Lazy Loading | `frontend/src/modules/escala/escala.js:8` | `import { showJustificativaModal } from '../livro/livro.js';` força o download do módulo `livro.js` inteiro (2.794 linhas) ao abrir a tela de Escala. |

---

## 5. AUTENTICAÇÃO E CONFIGURAÇÕES

### 5.1 Fluxo de Login, Sessão e Logout

1. **Login (`POST /api/login`):** Recebe `username` e `password`. Passa por rate limiting de 20 tentativas por 15 minutos (`server.js:99-105`).
2. **Validação LDAP:** `authController.js` chama `ldapService.authenticate(username, password)`.
3. **Mapeamento de Usuário e Grupos:** Busca o usuário no Oracle TASY (`usuarioRepository.findByUsername`). Os grupos retornados do Active Directory são comparados com a tabela `perfis` do SQLite (`configCache.getPerfisFromGroups`).
4. **Armazenamento de Sessão:** A sessão é gravada no Redis com chave `sess:<session_id>` e TTL de 12 horas (`SESSION_TTL_HOURS`).
5. **Cookie:** Nome `connect.sid`, atributos `httpOnly: true`, `sameSite: 'lax'`, `secure: false` (conforme variável `COOKIE_SECURE`).
6. **Logout (`POST /api/logout`):** Destrói a sessão no Redis e limpa o cookie no cliente.

### 5.2 Integração LDAP e Controle de Acesso

- O arquivo `backend/src/modules/auth/ldapService.js` conecta-se ao Active Directory hospitalar (`ldap://192.168.1.4:389`) e efetua busca de atributos (`sAMAccountName`, `cn`).
- **Achado Crítico C-1:** As linhas 216-220 contêm um bypass estático no retorno da busca de grupos do AD:
  ```javascript
  if (groups.length === 0 && (safeUsername.toLowerCase() === 'pedro.cesario' || safeUsername.toLowerCase() === 'pedro.davi')) {
     groups.push('API_CONECTA_ADMIN');
     groups.push('API_CONECTA_ASSISTENCIAL_ENF');
  }
  ```
  Se o servidor AD falhar na enumeração de grupos, esses dois usuários ganham privilégio de administrador automaticamente.
- **Middleware `requireAdmin` (`authMiddleware.js:11-28`):** Valida exclusivamente se o array `usuario.grupos_ad` contém o grupo configurado em `ADMIN_AD_GROUP` (padrão `API_CONECTA_ADMIN`).

### 5.3 Configurações Administráveis e Persistência

- Todas as configurações dinâmicas residem no SQLite `auth.sqlite/config.db`:
  - `perfis`, `modulos`, `perfil_modulos`, `perfil_permissoes`, `perfil_modulo_setores`.
  - `configuracoes_sistema`, `configuracoes_dashboard_pa`, `passagem_checkboxes`.
  - `paineis_tv`, `maquinas_guiches`, `relatorios_tasy`, `studio_pages`.
  - `conecta_audit_trail`, `config_migrations`.
- **Risco de Versionamento:** O arquivo binário `auth.sqlite/config.db` está versionado no repositório Git, armazenando inclusive registros da trilha de auditoria (`conecta_audit_trail`). Da mesma forma, `data/policy-cache.json` permanece rastreado pelo Git.

### 5.4 Separação entre Homologação e Produção

- O arquivo `.env` (não versionado) define as variáveis de ambiente.
- A flag `DB_AUTO_MIGRATE` e `NODE_ENV` controlam se DDLs são executados no Oracle no momento da subida da aplicação (`database/index.js:135`).
- Não foram encontrados arquivos de pipeline de CI/CD (ex: `.gitlab-ci.yml`, `Jenkinsfile`) no repositório.

---

## 6. INFRAESTRUTURA

### 6.1 Dockerfile e Docker Compose

- **Dockerfile (`Dockerfile`):**
  - Base `node:24-alpine`.
  - Instala utilitários de compilação C/C++ e dependências nativas: `python3`, `make`, `g++`, `sqlite-dev`, `libaio`, `curl`, `libc6-compat`, `libnsl`, `su-exec`.
  - Copia o diretório `instantclient-files` para `/opt/oracle/instantclient/` e recria links simbólicos essenciais (`libclntsh.so`).
  - Utiliza `docker-entrypoint.sh` para ajustar permissões de pastas montadas e executa o processo como usuário desprivilegiado `node` via `su-exec`.
- **Docker Compose (`docker-compose.yml`):**
  - Orquestra dois serviços: `node` (porta mapeada `3020:3020`) e `redis` (porta 6379 interna).
  - Configura volumes com **bind mount do código-fonte completo** (`./backend`, `./frontend`, `./auth.sqlite`, `./data`). Em ambiente produtivo, o bind mount anula a imutabilidade do container e permite alterações acidentais de arquivos em execução.
  - `node` possui `depends_on: redis: condition: service_healthy`.

### 6.2 Disponibilização do Oracle Instant Client

- O Oracle Instant Client 19c está incluído diretamente no repositório no diretório `instantclient-files/` (~234 MB).
- Isso onera o repositório Git, aumenta o tráfego de rede na clonagem e traz implicações de compliance e licença proprietária de redistribuição da Oracle.

### 6.3 Dependências para Subida do Ambiente

Para inicializar a aplicação, são estritamente necessários:
1. Conectividade de rede com o Oracle TASY em `192.168.1.21:1521/tasyhml`.
2. Conectividade de rede com o Active Directory em `192.168.1.4:389`.
3. Instância do Redis ativa (gerenciada pelo compose).
4. Arquivo `.env` configurado e binário `auth.sqlite/config.db` acessível com permissão de escrita.

*Não há modo mock ou ambiente offline isolado para desenvolvimento sem acesso à rede hospitalar.*

### 6.4 Health Checks e Verificação de Estado em Runtime

- `GET /health/liveness`: Verifica apenas se o processo Node.js está respondendo.
- `GET /health` e `GET /health/readiness`: Realizam teste de ping no Redis (`isReady`) e executam query de verificação na conexão Oracle. Retorna status 503 caso algum esteja indisponível.
- **Validação de Runtime Realizada na Auditoria:**
  ```bash
  curl -s http://localhost:3020/health/readiness
  # Resposta: {"status":"UP","timestamp":"2026-10-01T15:29:10.566Z","services":{"redis":"UP","oracle":"UP"}}
  ```
  Os serviços Redis e Oracle estão operacionais e respondendo com HTTP 200 no container atual.

---

## 7. VERIFICAÇÕES EXISTENTES

### 7.1 Inventário de Testes e Ferramentas

| Verificação | Ferramenta / Configuração | Status Observado | Detalhes |
|---|---|---|---|
| Testes Automatizados | `node:test` nativo (`npm test`) | **Executável (com falhas)** | 41 testes, 24 suítes: 33 passaram, 8 falharam. |
| Linter | `.eslintrc.json` (formato legado) | **Não executável** | Sem ESLint nas dependências; ESLint 9+ exige `eslint.config.js`. |
| Verificação de Tipos | Nenhuma | **Inexistente** | Sem TypeScript ou `checkJs`. |
| Verificação de Sintaxe | `node --check` | **Executável (100% OK)** | Todos os arquivos backend e frontend passaram na análise de sintaxe. |
| Validador Acorn AST | Script em `ARQUITETURA_E_PADROES.md` | **Não executável** | Pacote `acorn` não instalado em `node_modules`. |

### 7.2 Análise do Resultado de `npm test`

A execução de `npm test` produziu:
- **Total de Testes:** 41
- **Suítes:** 24
- **Passaram:** 33
- **Falharam:** 8
- **Duração:** ~8,3 segundos

#### Diagnóstico Técnico das 8 Falhas: Diferenciação entre Código e Ambiente
Das 8 falhas observadas, a grande maioria decorre de **acoplamento entre a leitura do cache e operações de escrita DDL/DML em SQLite**:
1. `configCache.load()` invoca `ensureAccessSchema()`, que tenta executar `CREATE TABLE`, `INSERT` e migrações no banco `auth.sqlite/config.db`.
2. Como a pasta `auth.sqlite` pertence ao usuário `matrix` (`drwxr-xr-x`), quando o teste é rodado por outro usuário (ex: `sdk2`), o SQLite falha com `SQLITE_READONLY: attempt to write a readonly database`.
3. Essa falha interrompe o carregamento dos perfis em memória (`perfis: 0`), causando falhas em cascata em:
   - `acesso.test.js:29` (`validarPerfil` não encontra perfis carregados).
   - `admin_pilares.test.js:18, 31, 66` (falha na contagem de relatórios e erro de escrita).
   - `auditLogger.test.js:6` (falha de escrita no banco de auditoria).
   - `checkboxes.test.js:23` (falha de escrita ao criar checkbox temporário).
   - `painel.test.js:19, 26` (nenhum painel de TV carregado na memória).

*Limitação da Suíte de Testes:*
Nenhum dos 41 testes valida permissões de acesso, autorização via `requireAdmin`, validação da matriz de perfis ou chamadas com dados reais no Oracle. A suíte é incapaz de detectar falhas de autorização como o bypass C-1 ou o vazamento de conexão A-2.

---

## 8. ACHADOS E PENDÊNCIAS

### Prioridade Crítica

#### C-1 · Bypass de Autorização no LDAP Concede Acesso Administrativo a Nomes Fixos
- **Problema:** Em caso de falha no retorno de grupos do Active Directory, dois usernames específicos recebem forçadamente os grupos `API_CONECTA_ADMIN` e `API_CONECTA_ASSISTENCIAL_ENF`.
- **Evidência:** `backend/src/modules/auth/ldapService.js:216-220`:
  ```javascript
  if (groups.length === 0 && (safeUsername.toLowerCase() === 'pedro.cesario' || safeUsername.toLowerCase() === 'pedro.davi')) {
     groups.push('API_CONECTA_ADMIN');
     groups.push('API_CONECTA_ASSISTENCIAL_ENF');
  }
  ```
- **Impacto:** Elevação indevida de privilégio em cenário de falha de infraestrutura. Permite controle administrativo total sobre ~72 rotas de gestão de credenciais, perfis e relatórios.
- **Direção Sugerida:** Remover o bloco condicional. Garantir a atribuição de permissões exclusivamente através de grupos gerenciados no Active Directory. Se houver falha de comunicação com o AD, a requisição deve ser abortada com erro e alerta de monitoramento.
- **O que Falta Verificar:** Confirmar junto ao administrador de rede se os usuários já possuem os respectivos grupos configurados no Active Directory corporativo.

#### C-2 · Endpoints Públicos do Painel TV Devolvem Nome Completo de Pacientes sem Autenticação
- **Problema:** A rota `/api/painel` é montada sem `requireAuth` e o endpoint `GET /api/painel/:id/estado` inclui o nome completo do paciente na resposta JSON pública.
- **Evidência:**
  - `backend/src/routes.js:72`: `router.use('/painel', painelRoutes);`
  - `backend/src/modules/painel/routes.js:10-14`: Ausência de middlewares de proteção.
  - `backend/src/modules/painel/painelController.js:70, 215, 223`:
    ```javascript
    COALESCE(psf.nm_paciente, pf.nm_social, pf.nm_pessoa_fisica) AS nm_paciente
    ```
- **Impacto:** Exposição de dados pessoais de saúde (PHI) para qualquer dispositivo conectado na rede local do hospital, em desacordo com as diretrizes da LGPD (Lei 13.709/2018).
- **Direção Sugerida:** Restringir os dados públicos do painel apenas à sigla da senha e guichê de atendimento. Caso a exibição do nome na tela seja indispensável, exibir apenas o primeiro nome ou implementar autenticação por token de dispositivo para as TVs do saguão.
- **O que Falta Verificar:** Verificar se as TVs operam em rede segmentada (VLAN exclusiva) e qual o requisito assistencial mínimo de identificação do paciente na tela.

---

### Prioridade Alta

#### A-1 · Função `perfilTemAcessoModulo` Duplicada com Sobrescrita Estrita (*Case-Sensitive*)
- **Problema:** Declaração duplicada da mesma função no escopo do módulo `configCache.js`. A segunda declaração prevalece e descarta a normalização *case-insensitive*.
- **Evidência:** `backend/src/core/config/configCache.js`:
  - Linha 725: Primeira versão com `trim().toLowerCase()`.
  - Linha 764: Segunda versão sem normalização:
    ```javascript
    function perfilTemAcessoModulo(perfilId, moduloId) {
      if (!perfilId || !moduloId) return false;
      return cache.perfilModulos.some(pm => pm.perfil_id === perfilId && pm.modulo_id === moduloId);
    }
    ```
- **Impacto:** Se o perfil do usuário ou o ID do módulo apresentar diferença de caixa alta/baixa, o acesso será negado indevidamente para usuários legítimos.
- **Direção Sugerida:** Excluir a função duplicada na linha 764 e preservar a versão das linhas 725-733. Adicionar testes unitários cobrindo variações de caixa.
- **O que Falta Verificar:** Auditar na base SQLite se os IDs de módulos e perfis estão padronizados em letras minúsculas.

#### A-2 · Vazamento Crítico de Conexão Oracle no Repositório do Dashboard
- **Problema:** `getConnection()` é chamado e a validação de parâmetros lança exceção antes da abertura do bloco `try/finally`.
- **Evidência:** `backend/src/modules/dashboard/dashboardRepository.js:41-52`:
  ```javascript
  const conn = await getConnection();
  const setorNum = Number(cdSetor);
  if (!Number.isInteger(setorNum) || setorNum <= 0) {
    throw new Error('Setor inválido'); // Fora do try
  }
  try { ... } finally { await conn.close(); }
  ```
- **Impacto:** Conexões permanecem abertas indefinidamente ao receberem chamadas com setor inválido, esgotando o limite do pool (máximo 15 conexões) e provocando negação de serviço no dashboard.
- **Direção Sugerida:** Mover a validação de parâmetros para a camada de controller/service ou posicionar `await getConnection()` estritamente dentro do bloco `try`.
- **O que Falta Verificar:** Realizar varredura automatizada em todos os demais repositórios em busca de padrões similares de aquisição de conexão fora do `try`.

#### A-3 · Exposição da Matriz Global de Permissões para Qualquer Usuário Autenticado
- **Problema:** A rota `GET /api/modulos` retorna a totalidade dos módulos cadastrados e todos os perfis com acesso a cada um, sem filtrar pelo perfil do requisitante.
- **Evidência:** `backend/src/routes.js:43-46` e `backend/src/core/config/configCache.js:969-978` (`getAllModulosWithPermissoes`).
- **Impacto:** Permite que qualquer usuário autenticado (inclusive de menor privilégio) mapeie a topologia completa de acessos do hospital.
- **Direção Sugerida:** Filtrar a resposta de `/api/modulos` pelo perfil ativo do usuário autenticado (`req.session.usuario.perfilAtivo`).
- **O que Falta Verificar:** Mapear o consumo de `/api/modulos` no frontend para garantir que telas administrativas continuem funcionando caso utilizem rota específica.

#### A-4 · Execução de DDLs e Migrações Durante a Inicialização de Leitura do Cache
- **Problema:** A função `configCache.load()` executa `ensureAccessSchema()`, realizando comandos `CREATE TABLE`, `INSERT` e `DELETE` em SQLite a cada boot.
- **Evidência:** `backend/src/core/config/configCache.js:50-130`.
- **Impacto:** Falhas em ambientes com arquivos montados em modo somente-leitura ou usuários sem permissão de escrita no diretório derrubam o carregamento de perfis em memória.
- **Direção Sugerida:** Separar a etapa de migração de banco de dados (`npm run db:init` / script de migração) da rotina de leitura de cache da aplicação.
- **O que Falta Verificar:** Validar a integridade das tabelas atuais no banco `auth.sqlite/config.db`.

---

### Prioridade Média

#### M-1 · Descarte Silencioso do Código do Motivo de Cancelamento de Atendimento
- **Problema:** A assinatura do repositório recebe `cdMotivo`, mas o comando SQL não o utiliza na atualização.
- **Evidência:** `backend/src/modules/recepcao/recepcaoRepository.js:1702-1721`.
- **Impacto:** Perda de rastreabilidade do cancelamento do atendimento no sistema TASY.
- **Direção Sugerida:** Incluir a coluna correspondente (ex: `cd_motivo_cancelamento`) no comando `UPDATE` e no bind de parâmetros.
- **O que Falta Verificar:** Consultar no dicionário de dados do TASY qual é a coluna oficial para motivo de cancelamento em `ATENDIMENTO_PACIENTE`.

#### M-2 · Execução Direta de Instrução SQL Dinâmica sem Sanitização
- **Problema:** Query SQL recuperada da coluna `relatorio.ds_sql` é executada diretamente via `conn.execute(sql, ...)`.
- **Evidência:** `backend/src/modules/recepcao/recepcaoRepository.js:1061-1072`.
- **Impacto:** Risco de execução de comandos SQL não homologados caso a tabela `relatorio` seja manipulada externamente.
- **Direção Sugerida:** Criar uma lista permitida (whitelist) de sequenciais de relatórios autorizados ou fixar consultas em código.
- **O que Falta Verificar:** Qual processo ou perfil possui permissão de escrita na tabela `relatorio` no Oracle.

#### M-3 · Rota de Ação com Efeito Colateral Exposta como Método HTTP GET
- **Problema:** Geração de relatórios com integração externa e emissão de PDF exposta via método `GET`.
- **Evidência:** `backend/src/modules/recepcao/routes.js:36`:
  ```javascript
  router.get('/relatorios/:id/gerar', reqRec('emitir_relatorio'), recepcaoController.gerarRelatorioAtendimento);
  ```
- **Impacto:** Violação de idempotência. Pré-carregamentos de navegadores ou cliques acidentais disparam chamadas externas e emissão de documentos.
- **Direção Sugerida:** Alterar o endpoint para método `POST`.
- **O que Falta Verificar:** Ajustar as chamadas correspondentes no módulo `frontend/src/modules/recepcao/recepcao.js`.

#### M-4 · Endpoint Inexistente `/api/ping` Mantém Falso Indicador de Offline na Interface
- **Problema:** `frontend/src/core/utils.js:138` chama `/api/ping`, mas o backend expõe `/api/version` (`routes.js:28`).
- **Evidência:** Falha 404 confirmada em runtime via `curl http://localhost:3020/api/ping`.
- **Impacto:** O rodapé da aplicação exibe permanentemente "Serviço temporariamente indisponível", gerando descrédito dos usuários nos alertas visuais.
- **Direção Sugerida:** Ajustar a chamada no frontend para `/api/version` ou criar alias `/api/ping` no backend.
- **O que Falta Verificar:** Confirmar campos esperados pelo frontend na resposta (`version`, `showTestBar`).

#### M-5 · Setor 48 Fixado no Repositório de Auditorias
- **Problema:** Setor 48 está inserido como bind literal na listagem e validação de avaliadores.
- **Evidência:** `backend/src/modules/auditorias/auditoriaRepository.js:26` e `:45`.
- **Impacto:** Impossibilita o uso do módulo de auditorias por setores diferentes do 48.
- **Direção Sugerida:** Parametrizar o setor com base no contexto do usuário ou seleção em tela.
- **O que Falta Verificar:** Qual é a abrangência planejada para as auditorias de higiene de mãos.

#### M-6 · Feedback de Sucesso Fictício no Conecta Studio
- **Problema:** Em caso de erro na requisição de salvar tela, a interface exibe botão verde "Salvo Localmente!".
- **Evidência:** `frontend/js/builder.js:2005-2009`.
- **Impacto:** O usuário acredita que a página foi persistida com segurança no servidor, correndo risco de perda de trabalho.
- **Direção Sugerida:** Exibir toast explícito de erro HTTP e destacar que o salvamento ocorreu apenas no cache local do navegador.
- **O que Falta Verificar:** Se o Conecta Studio está sendo utilizado ativamente em produção.

---

### Prioridade Baixa

#### B-1 · Conflito de Listeners no Botão Limpar de Escalas
- **Problema:** Dois listeners escutam o mesmo `#btn-escala-limpar` em `frontend/src/modules/escala/escala.js:332` e `:673`.
- **Impacto:** Conflito de ações e mensagens de feedback contraditórias ao operador.
- **Direção Sugerida:** Unificar os tratamentos em um único listener contextual.

#### B-2 · Quebra de Isolamento do Lazy Loading entre Módulos
- **Problema:** `escala.js:8` importa `showJustificativaModal` diretamente de `../livro/livro.js`.
- **Impacto:** Download desnecessário de 2.794 linhas ao carregar a tela de Escala.
- **Direção Sugerida:** Mover a função modal para `frontend/src/core/ui.js`.

#### B-3 · Modularização Incompleta de Folhas de Estilo CSS
- **Problema:** 6 das 8 folhas de estilo em `frontend/css/modules/` estão com 0 bytes, enquanto `style.css` concentra 9.011 linhas.
- **Impacto:** Dificuldade de manutenção visual e risco constante de regressão de layout.
- **Direção Sugerida:** Distribuir as classes por domínio conforme planejado na arquitetura.

#### B-4 · Scripts Ad-hoc Não Versionados e Credenciais Expostas na Raiz
- **Problema:** 11 scripts soltos na raiz (`fix-*.js`, `test-*.js`). O arquivo `test-tasy.js` contém credenciais Oracle em texto claro.
- **Evidência:** `test-tasy.js:6` com senha e usuário `tasy`.
- **Impacto:** Risco de segurança e poluição do diretório operacional.
- **Direção Sugerida:** Remover scripts temporários da raiz, adicioná-los ao `.gitignore` e rotacionar as senhas expostas.

#### B-5 · Cabeçalhos de Segurança Desativados e Cookie Não Seguro
- **Problema:** `server.js:74-78` desativa CSP, HSTS e CORP; cookie configurado com `secure: false`.
- **Impacto:** Cookie trafega em claro sob tráfego HTTP na rede interna; maior vulnerabilidade a ataques de injeção de script (XSS).
- **Direção Sugerida:** Reativar CSP com regras adequadas e configurar `COOKIE_SECURE=true` atrás de terminação HTTPS / proxy reverso.

#### B-6 · Endpoint `/metrics` Permite Autenticação via Query String
- **Problema:** `server.js:237` aceita o token de métricas via `req.query.token`.
- **Impacto:** Exposição de tokens em logs de acesso HTTP e histórico de navegadores.
- **Direção Sugerida:** Exigir autenticação unicamente pelo cabeçalho `X-Metrics-Token`.

---

## 9. RESUMO DOS PRINCIPAIS ACHADOS

| ID | Prioridade | Categoria | Descrição Sintética | Arquivo Principal |
|---|---|---|---|---|
| **C-1** | Crítica | Segurança / Autenticação | Bypass estático no LDAP concede admin a usernames literais em caso de falha do AD | `backend/src/modules/auth/ldapService.js` |
| **C-2** | Crítica | Privacidade / LGPD | Rota pública do painel de TV expõe nomes completos de pacientes sem controle de acesso | `backend/src/modules/painel/painelController.js` |
| **A-1** | Alta | Autorização / Acesso | Declaração duplicada de `perfilTemAcessoModulo` anula versão case-insensitive | `backend/src/core/config/configCache.js` |
| **A-2** | Alta | Disponibilidade / Banco | Vazamento de conexão Oracle por lançamento de exceção antes do bloco `try` | `backend/src/modules/dashboard/dashboardRepository.js` |
| **A-3** | Alta | Segurança / Exposição | `/api/modulos` expõe matriz de permissões do hospital para qualquer usuário logado | `backend/src/routes.js` |
| **A-4** | Alta | Arquitetura / Persistência | Execução de migrações DDL/DML durante leitura de cache no boot da aplicação | `backend/src/core/config/configCache.js` |
| **M-1** | Média | Integridade de Dados | `cdMotivo` de cancelamento de atendimento é descartado na query SQL | `backend/src/modules/recepcao/recepcaoRepository.js` |
| **M-2** | Média | Segurança / SQL | Execução de consulta SQL dinâmica lida da tabela `relatorio` sem whitelist | `backend/src/modules/recepcao/recepcaoRepository.js` |
| **M-3** | Média | Padrões de API | Rota `/relatorios/:id/gerar` com efeitos colaterais e escrita exposta via HTTP GET | `backend/src/modules/recepcao/routes.js` |
| **M-4** | Média | Frontend / UX | `/api/ping` inexistente trava rodapé em "offline" com falso alarme permanente | `frontend/src/core/utils.js` |
| **M-5** | Média | Negócio / Dados | Setor 48 fixado nos binds de busca e validação de avaliadores de auditoria | `backend/src/modules/auditorias/auditoriaRepository.js` |
| **M-6** | Média | Frontend / UX | Falso feedback de "Salvo Localmente!" mascara erros de salvamento no Studio | `frontend/js/builder.js` |
| **B-1** | Baixa | Frontend / UX | Dois event listeners conflitantes no botão `#btn-escala-limpar` | `frontend/src/modules/escala/escala.js` |
| **B-2** | Baixa | Performance / Frontend | Acoplamento de `escala.js` importando `livro.js` quebra o lazy loading | `frontend/src/modules/escala/escala.js` |
| **B-3** | Baixa | Frontend / CSS | 6 folhas de CSS modulares com 0 bytes; estilos concentrados em monólito de 9.011 linhas | `frontend/css/style.css` |
| **B-4** | Baixa | Higiene de Código | Scripts temporários na raiz com credenciais Oracle em texto claro | `test-tasy.js` |
| **B-5** | Baixa | Infraestrutura | CSP e HSTS desativados globalmente; sessões configuradas com `secure: false` | `backend/server.js` |
| **B-6** | Baixa | Segurança | Endpoint `/metrics` aceita token de autenticação via query string | `backend/server.js` |

---

## 10. LISTA DOS ARQUIVOS INSPECIONADOS

### Documentação e Configuração da Raiz
- `README.md`
- `ARQUITETURA_E_PADROES.md`
- `DESIGN_SYSTEM.md`
- `AUDITORIA_PRE_PRODUCAO.md`
- `package.json`
- `package-lock.json`
- `.eslintrc.json`
- `.gitignore`
- `.env` e `.env.example`
- `docker-compose.yml`
- `Dockerfile`
- `docker-entrypoint.sh`
- `ecosystem.config.js`
- `run.sh`
- `test-tasy.js`, `test-db.js`, `test-db-cancel.js`, `test-cols.js`
- `fix-syntax.js`, `fix-query.js`, `fix-modal.js`, `fix-js.js`, `fix-js2.js`, `fix-ui.js`, `fix-hoje.js`

### Backend — Núcleo (`backend/src/core/`)
- `backend/server.js`
- `backend/src/routes.js`
- `backend/src/core/config/configCache.js`
- `backend/src/core/config/redisClient.js`
- `backend/src/core/config/modulos.js`
- `backend/src/core/database/index.js`
- `backend/src/core/database/auditDatabase.js`
- `backend/src/core/middlewares/authMiddleware.js`
- `backend/src/core/middlewares/errorHandler.js`
- `backend/src/core/middlewares/responseHandler.js`
- `backend/src/core/middlewares/correlationIdMiddleware.js`
- `backend/src/core/errors/AppError.js`
- `backend/src/core/utils/acesso.js`
- `backend/src/core/utils/logger.js`
- `backend/src/core/utils/auditLogger.js`
- `backend/src/core/utils/parseBoolean.js`

### Backend — Módulos (`backend/src/modules/`)
- `auth/`: `routes.js`, `authController.js`, `ldapService.js`, `usuarioRepository.js`, `perfilRepository.js`, `policyClientService.js`, `nativeSsoController.js`, `nativeSsoService.js`
- `dashboard/`: `routes.js`, `dashboardController.js`, `dashboardService.js`, `dashboardRepository.js`
- `recepcao/`: `routes.js`, `recepcaoController.js`, `recepcaoService.js`, `recepcaoRepository.js`, `tasyReportsClient.js`
- `painel/`: `routes.js`, `painelController.js`, `painelEventsService.js`
- `admin/`: `routes.js`, `adminController.js`
- `auditorias/`: `routes.js`, `auditoriaController.js`, `auditoriaService.js`, `auditoriaRepository.js`, `auditoriaExportService.js`
- `ocorrencias/`: `routes.js`, `ocorrenciaController.js`, `ocorrenciaService.js`
- `escalas/`: `routes.js`, `escalaAtivaController.js`, `escalaAtivaService.js`, `escalaAtivaRepository.js`
- `registros/`: `routes.js`, `registroController.js`, `registroService.js`, `registroRepository.js`
- `pacientes/`: `routes.js`, `pacienteController.js`, `pacienteService.js`, `pacienteRepository.js`
- `setores/`: `routes.js`, `setorController.js`, `setorService.js`, `setorRepository.js`
- `usuarios/`: `routes.js`, `usuarioController.js`, `usuarioService.js`, `usuarioRepository.js`

### Frontend — Estrutura e Módulos
- Páginas HTML: `frontend/index.html`, `frontend/admin.html`, `frontend/painel.html`, `frontend/builder.html`
- Ponto de entrada: `frontend/src/main.js`
- Core: `api.js`, `auth.js`, `draft.js`, `moduleLoader.js`, `router.js`, `state.js`, `ui.js`, `utils.js`
- Módulos:
  - `passagem/passagem.js`
  - `dashboard/dashboard.js`
  - `livro/livro.js`
  - `escala/escala.js`
  - `registros/registros.js`
  - `auditorias/auditorias.js`
  - `recepcao/recepcao.js`
  - `painel/painel.js`, `painel/painel_senhas.js`
  - `builder/builder.js`
- Estilos: `css/style.css`, `css/main.css`, `css/builder.css`, `css/skeleton.css`, e folhas em `css/modules/`

### Testes Inspecionados
- `backend/test/acesso.test.js`
- `backend/test/admin_pilares.test.js`
- `backend/test/auditLogger.test.js`
- `backend/test/audit.test.js`
- `backend/test/checkboxes.test.js`
- `backend/test/correlationId.test.js`
- `backend/test/infra.test.js`
- `backend/test/internacao_senha.test.js`
- `backend/test/painel.test.js`
- `backend/test/recepcao.test.js`
- `backend/test/utils.test.js`
- `backend/src/modules/auth/nativeSsoService.test.js`
- `backend/src/modules/auth/nativeSsoController.test.js`

---

## 11. LISTA DAS VERIFICAÇÕES EXECUTADAS

1. **Inspeção de Integridade do Repositório Git:** Executados `git status`, `git diff --stat`, `git log -n 5` e `git remote -v`. Confirmou-se a branch `master` e os arquivos alterados e não rastreados.
2. **Auditoria de Hashes de Arquivos Sensíveis:** Verificação de SHA-256 do arquivo `auth.sqlite/config.db` antes e depois das consultas (`a4d2c979a8de714229ca28e460fd6cae233aa68c1a14c042ea9d98ecdf9e5f7e`), atestando ausência de mutação.
3. **Validação de Sintaxe JavaScript (`node --check`):**
   - Executado sobre todos os arquivos do backend (`backend/server.js`, `backend/src/**/*.js`). Resultado: 100% íntegro.
   - Executado sobre todos os arquivos do frontend (`frontend/src/**/*.js`). Resultado: 100% íntegro.
4. **Execução da Suíte Nativa de Testes (`npm test`):**
   - 41 testes executados via `node --test`.
   - Resultado: 33 passaram e 8 falharam (identificadas causas de isolamento de diretório SQLite/permissão do usuário).
5. **Inspeção de Configuração Docker Compose:** Análise detalhada de `docker-compose.yml` e checagem de variáveis de ambiente do serviço Redis (`REDIS_PASSWORD`).
6. **Smoke Tests HTTP em Runtime Local (somente leitura):**
   - `GET /health/readiness` em `http://localhost:3020`: Retornou HTTP 200 com status `UP` para Redis e Oracle.
   - `GET /api/version`: Retornou HTTP 200 com `{ ok: true, version: "2.2.1", showTestBar: false }`.
   - `GET /api/ping`: Retornou HTTP 404 (evidência do bug F-1).
   - `GET /api/modulos` sem credenciais: Retornou HTTP 401.
   - `GET /api/recepcao/filas` sem credenciais: Retornou HTTP 401.
   - `GET /api/painel/minha-tv` e `GET /api/painel/recepcao_principal/estado` sem credenciais: Retornaram HTTP 200 (evidência da ausência de autenticação C-2).
7. **Varredura Estática de Padrões de Código:**
   - Busca de referências `/ping` em todo o backend: 0 ocorrências encontradas.
   - Busca de chamadas `validarPerfil` no frontend: confirmada ausência de export em `core/auth.js`.
   - Busca de declarações de `perfilTemAcessoModulo` em `configCache.js`: confirmadas 2 ocorrências com sobrescrita.

---

## 12. DÚVIDAS QUE DEPENDEM DE RESPOSTA DO RESPONSÁVEL

1. **Bypass LDAP (C-1):** Os usuários `pedro.cesario` e `pedro.davi` já possuem o grupo `API_CONECTA_ADMIN` devidamente atribuído no Active Directory corporativo? Podemos remover o fallback com segurança?
2. **Exposição de Dados no Painel TV (C-2):** Há exigência legal/assistencial de exibir o nome completo do paciente na TV do saguão? As TVs estão isoladas em VLAN própria sem acesso direto por estações de trabalho de visitantes?
3. **Cancelamento de Atendimento (M-1):** Qual é a coluna e tabela correta no Oracle TASY para gravação do código do motivo do cancelamento (`cdMotivo`)?
4. **Setor 48 em Auditorias (M-5):** O setor 48 é a única unidade que realiza auditoria de higiene de mãos, ou o sistema precisa listar avaliadores conforme o setor selecionado dinamicamente?
5. **SQL Dinâmico de Relatórios (M-2):** A tabela `relatorio` no Oracle é alimentada unicamente por equipe interna controlada de TI ou recebe dados via importações de terceiros?
6. **Identificadores Fixos no Frontend:** Os identificadores de setor (4 e 39) e a fila 18 (PA - Internação) são imutáveis por definição institucional ou devem ser cadastrados na tela administrativa?
7. **Política de Segurança de Cookies e Rede (B-5):** O ambiente hospitalar dispõe de terminação TLS/HTTPS através de proxy reverso (Nginx/Traefik) para que possamos ativar cookies `Secure`, HSTS e CSP?
8. **Scripts Ad-hoc na Raiz (B-4):** Os 11 arquivos de script `fix-*.js` e `test-*.js` na raiz podem ser arquivados em pasta protegida e excluídos da raiz de execução?

---

## 13. LIMITAÇÕES DA AUDITORIA

1. **Auditoria Estritamente Local e Somente Leitura:** Em conformidade com as regras operacionais, nenhuma escrita foi realizada nos bancos de dados (Oracle, SQLite) nem no Active Directory.
2. **Sem Interação Humana de Ponta a Ponta:** Não foram executados fluxos clínicos reais com abertura de fichas de pacientes ou impressão física de relatórios no TasyAppServer.
3. **Ambiente Externo Não Auditado:** O servidor Active Directory (`192.168.1.4`) e o banco de dados Oracle (`192.168.1.21`) foram inspecionados apenas quanto à sua conectividade através dos logs e healthchecks; suas configurações internas de rede, backups e infraestrutura de hardware não fizeram parte do escopo.
4. **Testes Unitários sem Acesso a Dados Reais:** A suíte de testes existente opera sem tocar no banco Oracle; a execução bem-sucedida dos testes unitários não garante a validade de schemas ou integridade referencial no banco hospitalar.
5. **Análise de Vulnerabilidade de Dependências:** Não foi executado `npm audit` com conexão externa para evitar alterações no lockfile ou dependências.

---

## 14. CONFIRMAÇÃO DE NÃO-MUTAÇÃO

Declara-se que:
- **Nenhum arquivo existente do projeto foi alterado, editado ou excluído durante esta auditoria.**
- O arquivo binário `auth.sqlite/config.db` manteve o hash SHA-256 rigorosamente idêntico antes e após as verificações.
- Nenhuma dependência foi instalada, removida ou atualizada no `node_modules` ou `package.json`.
- Apenas este relatório formal (`DIAGNOSTICO_CONECTA_01_ESTADO_ATUAL.md`) foi gerado como entregável do processo de inspeção.

---
*Relatório de Auditoria Inicial Conecta HEAL 2.0 — Equipe de Engenharia e Arquitetura.*
