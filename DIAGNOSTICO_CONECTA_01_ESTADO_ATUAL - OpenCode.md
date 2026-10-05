# DIAGNÓSTICO CONECTA HEAL — 01 · ESTADO ATUAL

**Projeto:** Conecta HEAL / CONECTA_MODULAR
**Raiz:** `/media/SAAS/SAAS/CONECTA_MODULAR`
**Data da auditoria:** 2026-10-01
**Escopo:** auditoria inicial, somente leitura. Nenhum código, configuração ou dependência foi alterado.
**Branch:** `master` · **Último commit:** `c2bd0c0 fix(infra): restaurar funcionamento do Conecta 2.0...`

---

## Sumário executivo

Aplicação **funcional e majoritariamente real**, sem dados simulados: os 8 módulos de domínio leem e
escrevem no Oracle/TASY de verdade. O que não está saudável são **as bordas de segurança e a disciplina
de engenharia**, não o núcleo funcional.

Três achados exigem ação antes de qualquer evolução:

1. **Bypass de autorização no LDAP** que concede grupo administrativo a dois usernames literais
   (`ldapService.js:216-220`). É o achado mais grave: um "fallback" que produz elevação de privilégio.
2. **Endpoints públicos do painel TV** (`painel/routes.js:10-14`, montado sem `requireAuth` em
   `routes.js:72`) devolvem **nome e data de nascimento de paciente** sem autenticação.
3. **Duplicação de `perfilTemAcessoModulo`** (`configCache.js:724` e `:763`) — a função que decide
   acesso a todos os módulos. Em JS a segunda declaração prevalece, tornando a primeira código morto.

Sobre testes: os 41 testes passam, mas cobrem essencialmente validação de entrada. **Não existe nenhum
teste sobre autorização** — justamente onde estão os três achados acima.

---

## 1. VISÃO GERAL

### 1.1 Tecnologias e versões declaradas

Declarado em `package.json`:

| Item | Valor |
|---|---|
| Nome do pacote | `passagem-plantao` (nome **não** corresponde ao projeto) |
| Versão | `2.2.1` |
| Runtime | Node.js (`backend/server.js`); imagem `node:24-alpine` no `Dockerfile:17` |
| Framework | Express `^4.18.2` |
| Banco primário | `oracledb ^6.6.0` (Oracle/TASY), modo **Thick** |
| Banco de configuração | `sqlite3 ^6.0.1` (`auth.sqlite/config.db`) |
| Sessão / cache | `express-session ^1.17.3` + `connect-redis ^7.1.1`, `redis ^4.6.13` |
| Rate limiting | `express-rate-limit ^7.1.4` + `rate-limit-redis ^4.2.0` |
| LDAP | `ldapjs ^3.0.7` |
| Segurança HTTP | `helmet ^7.1.0` (com CSP e HSTS **desabilitados**) |
| Relatórios | `exceljs ^4.4.0`, `pdfkit ^0.19.1` |
| Frontend | **JavaScript vanilla com ES Modules**, sem framework, sem bundler, sem build |

**Divergência a registrar:** o comentário do `Dockerfile:5` diz "Node.js 18 Alpine", mas a linha 17 usa
`node:24-alpine`. O `Dockerfile` também declara `EXPOSE 3006` / `ENV PORT=3006`, enquanto o
`docker-compose.yml` publica `3020` e sobrescreve `PORT=3020`. A porta efetiva depende do compose, não
da imagem.

### 1.2 Estrutura de diretórios

```
CONECTA_MODULAR/
├── backend/
│   ├── server.js                 # entry point (349 linhas)
│   ├── src/
│   │   ├── routes.js             # agregador de rotas (74 linhas)
│   │   ├── core/
│   │   │   ├── config/           # configCache, ldap, redisClient, modulos, nativeSso, especialidades
│   │   │   ├── database/         # index.js (pool Oracle), auditDatabase.js (SQLite)
│   │   │   ├── middlewares/      # authMiddleware, errorHandler, responseHandler, correlationId
│   │   │   ├── errors/           # AppError.js
│   │   │   └── utils/            # logger, auditLogger, acesso, parseBoolean
│   │   └── modules/              # 12 módulos de domínio
│   └── test/                     # 11 arquivos de teste
├── frontend/
│   ├── index.html                # app principal (1966 linhas)
│   ├── admin.html                # painel administrativo (5376 linhas)
│   ├── painel.html               # TV do saguão (112 linhas)
│   ├── builder.html              # Studio/builder (319 linhas)
│   ├── src/
│   │   ├── main.js               # entry point do app
│   │   ├── core/                 # api, auth, router, state, moduleLoader, ui, draft, utils
│   │   └── modules/              # 8 módulos de UI
│   ├── css/
│   │   ├── style.css             # 9011 linhas — folha monolítica principal
│   │   ├── builder.css, main.css, skeleton.css, style.css
│   │   └── modules/              # 8 folhas "por módulo" (6 delas vazias)
│   └── js/builder.js             # Studio (2018 linhas)
├── auth.sqlite/config.db         # 15 tabelas de configuração (versionado no Git)
├── data/policy-cache.json        # cache de política (versionado apesar de `data/` estar no .gitignore)
├── instantclient-files/          # Oracle Instant Client 19c (~234 MB)
├── Dockerfile, docker-compose.yml, ecosystem.config.js
├── .env, .env.example            # .env não versionado
├── README.md, ARQUITETURA_E_PADROES.md, DESIGN_SYSTEM.md, AUDITORIA_PRE_PRODUCAO.md
└── fix-*.js, test-*.js           # 13 arquivos soltos na raiz, não versionados
```

**Total:** ~48.900 linhas JS/HTML/CSS.

### 1.3 Comandos

De `package.json`:

| Comando | O que faz |
|---|---|
| `npm start` | `node backend/server.js` |
| `npm run dev` | `node --watch backend/server.js` |
| `npm test` | `node --test backend/test/*.test.js backend/src/modules/auth/*.test.js` |
| `npm run test:sso` | só os testes de SSO nativo |
| `npm run db:init` | `node scripts/init-config-db.js` |
| `npm run prod:start\|stop\|restart\|logs` | PM2 via `ecosystem.config.js` |

**Não existe script de build** — coerente com não haver bundler. Também **não existe** `lint`,
`typecheck` nem `format` no `package.json`.

### 1.4 Estado do Git

```
Branch: master
Último commit: c2bd0c0
Working tree: 14 não rastreados + 17 modificados de conteúdo
```

> Nota sobre a contagem: `git status` sem `-c core.fileMode=false` mostra 53 modificados, dos quais 36
> são apenas `mode change 100644 => 100755` com `mtime` de agosto/setembro — artefato do diretório
> `drwxrwxrwx` / bind mounts, **não** de esta auditoria. A contagem de conteúdo real é 17.

Modificados: `docker-compose.yml`, `auth.sqlite/config.db`, `data/policy-cache.json`, 5 arquivos backend
(dashboard, painel, recepcao), 6 arquivos frontend (`index.html`, `painel.html`, 2 CSS, 2 JS).

Não rastreados: `backend/test/audit.test.js`, `backend/test/internacao_senha.test.js`, `PDFReport-*.pdf`
e 11 arquivos de script na raiz (`fix-hoje.js`, `fix-js.js`, `fix-js2.js`, `fix-modal.js`, `fix-query.js`,
`fix-syntax.js`, `fix-ui.js`, `test-cols.js`, `test-db-cancel.js`, `test-tasy.js`).

Observações:

- **`auth.sqlite/config.db` está versionado** e contém tabela `conecta_audit_trail` e
  `configuracoes_sistema`. Banco com trilha de auditoria em controle de versão é anomalia.
- **`data/` está no `.gitignore`, mas `data/policy-cache.json` está rastreado** — `git check-ignore`
  não retorna nada para o arquivo. O ignore só vale para arquivos ainda não rastreados.
- **`test-tasy.js` na raiz contém credenciais Oracle em texto claro** e um caminho absoluto de Instant
  Client. Não está versionado, mas está no disco em diretório com permissão `drwxrwxrwx`.
- **`git remote` embute usuário e senha na URL** do repositório GitLab. Não reproduzidos aqui.
- Verificado por `sha256sum` antes e depois: `auth.sqlite/config.db` **não foi modificado** por esta
  auditoria.

### 1.5 Instruções do repositório

**Não existe `AGENTS.md`** (nem `CLAUDE.md`, `GEMINI.md`, `.cursorrules` ou `walkthrough.md`) no
repositório. `.agents/` existe mas está vazio. A instrução oficial está em:

- `README.md` §7 "Diretrizes para IAs & Desenvolvedores" (linhas 363-370), que aponta para:
- `ARQUITETURA_E_PADROES.md` (165 linhas) — regras de importação, gerenciamento de estado, validação AST.
- `DESIGN_SYSTEM.md` (160 linhas) — tokens, tipografia, modais, skeletons.

Ambos existem e foram lidos. `AUDITORIA_PRE_PRODUCAO.md` (354 linhas, 03/09) é um documento de
auditoria anterior, **não** documentação de arquitetura.

---

## 2. MÓDULOS

Classificação: **INTEGRADO** = consome backend real com SQL real; **PARCIAL** = integrado com falhas ou
lacunas; **NÃO VERIFICADO** = não foi possível confirmar em runtime.

### 2.1 `passagem` — Passagem de Plantão
**Finalidade:** registro de ocorrências de enfermagem e assinatura de passagem por lote/setor.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/passagem/passagem.js` (1118 linhas) |
| Rotas | `/lote/draft` (POST/GET/DELETE), `/salvar` (POST), `/passagens/anteriores`, `/passagens/setores-historico` |
| Permissões | `passagem`, `passagem:lancar_nova_passagem` |
| Serviços | Oracle `OCORRENCIA`; drafts em Redis |
| Estado | **INTEGRADO** — `ocorrenciaService.js` grava em `OCORRENCIA`; checkboxes vêm de `configCache` |

### 2.2 `dashboard` — Dashboard de Pacientes (Leitos)
**Finalidade:** ocupação de leitos ePatients por setor/turno.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/dashboard/dashboard.js` (1475 linhas) |
| Rotas | `GET /dashboard/setores`, `/pacientes`, `/internacao`, `/internacao/detalhes/:nrAtendimento`, `POST /internacao/acao` |
| Consultas | views `atendimento_paciente_v`, `GESTAO_VAGA`, `GESTAO_VAGA_HIST`, `paciente_senha_fila` |
| Cache | pré-aquecimento por setor (`DASHBOARD_CACHE_PREWARM_SETORES`), confirmado em runtime nos logs |
| Estado | **INTEGRADO COM FALHAS** — vazamento de conexão (achado A-2) e `autoCommit` enganoso (A-3) |

### 2.3 `dashboard_pa` — Dashboard P.A. (Internação)
**Finalidade:** aprovar/internar paciente e gerar nova senha na fila de internação.

| Camada | Evidência |
|---|---|
| Rotas | sub-rotas de `/dashboard/internacao` acima |
| Regra de negócio | `dashboardRepository.js` encerra senha anterior e gera nova na fila configurada (18 - PA - INTERNAÇÃO) |
| Estado | **INTEGRADO** — validado em runtime: container subiu e logou pré-aquecimento dos setores 68/28/34/59/83 |

### 2.4 `livro` — Livro Administrativo
**Finalidade:** registro administrativo do setor.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/livro/livro.js` (2793 linhas — maior arquivo do frontend) |
| Rotas | `POST/GET /livro-administrativo` |
| Estado | **PARCIAL** — chama `auth.validarPerfil()`, que não existe em `core/auth.js` (achado F-3, latente) |

### 2.5 `escala` — Gestão de Escalas
**Finalidade:** escalas de psicologia e técnica, com publicação e versionamento.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/escala/escala.js` (683 linhas) |
| Rotas | `/escala-ativa/` (GET/PUT), `/periodo`, `/patio-circulante-global`, `/versoes`, `/versao`, `/diff`; `/escala-psicologia/publicar`, `/escala-tecnica` |
| Tabelas | `CONECTA_ESCALA_ATIVA`, `CONECTA_ESCALA_LOG` |
| DDL | `initTables()` em `escalaAtivaRepository.js`, acionado no startup fora de produção |
| Estado | **PARCIAL** — dois handlers conflitantes no mesmo botão (achado F-2) e `window.prompt` (F-4) |

### 2.6 `registros` — Registros & Demanda Espontânea
**Finalidade:** cadastro e histórico de pessoas físicas para demanda espontânea.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/registros/registros.js` (826 linhas) |
| Rotas | `/registros/tipos`, `/pessoas` (GET/POST), `/pessoas/:id` (GET/PUT), `/registros/` (POST), `/historico` |
| Consultas | `PESSOA_FISICA`, `PESSOA_FISICA_HISTORICO` |
| Estado | **INTEGRADO** |

### 2.7 `auditorias` — Auditorias Assistenciais
**Finalidade:** auditoria de higiene das mãos e de processos assistenciais, com exportação XLSX/PDF.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/auditorias/auditorias.js` (1087 linhas) |
| Rotas | 17 endpoints sob `/auditorias` (higiene-maos e processos, incluindo `/xlsx` e `/pdf`) |
| Persistência | `backend/src/core/database/auditDatabase.js` + `conecta_audit_trail` no SQLite |
| Estado | **PARCIAL** — `auditoriaRepository.js:21-26` fixa setor `48` no filtro de avaliadores (achado M-7) |

### 2.8 `recepcao` — Recepção e Acolhimento
**Finalidade:** fila de senhas, busca de paciente, abertura de atendimento, convênios, GED e relatórios.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/src/modules/recepcao/recepcao.js` (1570 linhas) |
| Rotas | 21 endpoints sob `/recepcao` (filas, senhas, pessoas, convênios, atendimentos, relatórios, GED) |
| Integração | `tasyReportsClient.js` (405 linhas) — autentica no TasyAppServer para gerar relatórios |
| Consultas | `PESSOA`, `ATENDIMENTO`, `PACIENTE_SENHA_FILA`, `GED`, `CONTA_PACIENTE` |
| Estado | **INTEGRADO COM RESSALVAS** — SQL dinâmico sem whitelist (M-2), `cdMotivo` descartado (M-1), `GET` com efeito colateral (M-5) |

**Observação de segurança:** este módulo é montado **sem** `requireAuth` em `routes.js:71`. As rotas
internas aplicam `requirePermission`, o que mitiga o risco, mas o padrão diverge de todos os outros.

### 2.9 `painel_senhas` / `painel` — Painel Conecta TV
**Finalidade:** exibição de senhas na TV do saguão, com TTS e streaming SSE.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/painel.html` + `frontend/src/modules/painel/painel.js` (610 linhas); `painel_senhas.js` (171 linhas) |
| Rotas | `GET /painel/audio`, `/detectar-maquina`, `/minha-tv`, `/:id/estado`, `/:id/stream` |
| Proteção | **NENHUMA** — `painel/routes.js:10-14` sem middleware; montagem em `routes.js:72` sem `requireAuth` |
| Integração | TTS via Google TranslateTranslate (`painelController.js:251-276`), sem rate limit |
| Estado | **INTEGRADO, COM EXPOSIÇÃO DE DADO SENSÍVEL** — ver achado C-2 |

O comentário no código (`painel/routes.js:9`) declara que é intencional: "não exigem login para exibir
na TV do saguão". A decisão é coerente com o uso, mas aimplementação devolve PHI além do necessário.

### 2.10 `admin` — Painel Administrativo
**Finalidade:** administração de perfis, módulos, permissões, configurações, painéis TV, guichês,
relatórios Tasy, auditoria e diagnóstico de infraestrutura.

| Camada | Evidência |
|---|---|
| Frontend | `frontend/admin.html` (5376 linhas) + `frontend/builder.html` + `frontend/js/builder.js` |
| Rotas | ~72 endpoints sob `/api/admin`, todos com `requireAuth` + `requireAdmin` (`routes.js:62`) |
| Persistência | SQLite `auth.sqlite/config.db` — 15 tabelas |
| Estado | **PARCIAL** — alias na raiz executa controller de admin sem `requireAdmin` (achado A-5) |

Tabelas do `config.db` (confirmadas por introspecção): `perfis`, `modulos`, `perfil_permissoes`,
`perfil_modulos`, `perfil_modulo_setores`, `permissoes`(via `perfil_permissoes`), `configuracoes_sistema`,
`configuracoes_dashboard_pa`, `passagem_checkboxes`, `paineis_tv`, `maquinas_guiches`,
`relatorios_tasy`, `studio_pages`, `conecta_audit_trail`, `config_migrations`.

### 2.11 `usuarios` e `setores` — Consultas de apoio
**Finalidade:** listar técnicos, enfermeiros, profissionais de psicologia e setores.

Montados na raiz **sem** `requireAuth` (`routes.js:64`, `63`), mas todas as rotas internas aplicam
`requireAuth`. Estado **INTEGRADO** (`pessoa_fisica`, `profissional`, `setor_atendimento`).

---

## 3. BACKEND

### 3.1 Organização

Padrão consistente em 4 camadas nos módulos de domínio: `routes.js` → `xController.js` →
`xService.js` → `xRepository.js`. Exceção: `painel` usa `painelController.js` + `painelEventsService.js`
sem service/repository separados.

Ponto de entrada `backend/server.js:260` monta `app.use('/api', routes)`.

### 3.2 Onde estão as regras de negócio e o SQL

- **SQL:** concentrado em `*Repository.js` — separação respeitada na maioria dos módulos.
- **Regras de negócio:** `*Service.js` e, em alguns casos, dentro dos controllers.
- **Exceção relevante:** `dashboardRepository.js` contém lógica de negócio de internação junto com as
  queries, e `recepcaoRepository.js` (1725 linhas) concentra SQL, estoque de senhas e decisão de fila.

### 3.3 Validação de entrada, respostas e erros

- `core/middlewares/responseHandler.js` padroniza o envelope `{ success, data, message }`.
- `core/middlewares/errorHandler.js` centraliza tratamento de erro.
- `core/errors/AppError.js` para erros de domínio.
- `core/middlewares/correlationIdMiddleware.js` propaga ID de correlação nos logs.
- **Validação de entrada é majoritariamente manual e dispersa**, não há biblioteca de schema
  ( Joi/Zod/Ajv). Ex.: `pacienteController.js:50-52` valida perfil com `if (!validarPerfil(...))`.

### 3.4 Oracle, pools, transações e liberação de recursos

`core/database/index.js` centraliza o pool:

- Detecção Thick/Thin procurando `libclntsh.so.19.1` em 5 caminhos candidatos (linhas 7-13).
- `oracledb.autoCommit = false` global (linha 4) — **transações exigem `commit()` explícito**.
- `callTimeout` configurável por `DB_CALL_TIMEOUT` (padrão 30s).
- `getConnection()`, `closePool()`, `reconnectPool()` (usado pelo Admin para trocar conexão em runtime).
- `initEscalaAtivaTables()` roda DDL no startup **quando `NODE_ENV !== 'production'`** (linha 133).

**Achados de transacionalidade:**

| Local | Problema |
|---|---|
| `dashboardRepository.js:41-52` | `getConnection()` e `throw` de validação **fora** do `try` → conexão não liberada |
| `ocorrenciaService.js:464-474` | `{ autoCommit: true }` passado como 3º argumento de `execute()` — **não é opção válida** em node-oracledb; sem `commit()`, o `close()` descarta a transação |
| `recepcaoRepository.js:1701-1723` | mesmo padrão no cancelamento de atendimento / estoque de senhas |

Este último ponto merece atenção especial: com `autoCommit=false` global, um `execute` que grava e um
`close()` sem `commit()` resulta em **rollback silencioso**. Requer validação em homologação com dados
reais (ver Pendências).

### 3.5 Logs, auditoria, cache e tarefas agendadas

- **Logs:** `core/utils/logger.js` + access log em `server.js:31-38` com duração e correlation ID.
- **Auditoria:** `core/utils/auditLogger.js` + `core/database/auditDatabase.js` → `conecta_audit_trail`.
  README §3 declara conformidade LGPD com trilha de auditoria.
- **Cache:** `core/config/configCache.js` (1208 linhas) carrega perfis/módulos/permissões do SQLite na
  startup; `data/policy-cache.json` materializa o cache em disco. Dashboard tem cache próprio com TTL e
  stale-while-revalidate.
- **Tarefas agendadas:** **não encontradas**. Não há cron, agenda, `setInterval` de negócio ou worker
  dedicado. O pré-aquecimento de cache só ocorre no startup (`server.js:293-296`).
  **Não verificado** se há rotina de limpeza de senhas antigas ou sessões fora do processo.

### 3.6 Integrações externas

| Integração | Local | Observação |
|---|---|---|
| Oracle TasyAppServer | `recepcao/tasyReportsClient.js` | OAuth/client credentials; gera relatórios |
| LDAP/AD | `auth/ldapService.js` (368 linhas) | Real, com bypass (achado C-1) |
| Google Translate TTS | `painelController.js:251-276` | Proxy sem rate limit nem allowlist |
| Policy service | `auth/policyClientService.js` | Consome serviço externo de políticas |
| Validador TasyManager | `TASY_TOKEN_VALIDATOR_URL` | Valida token de médico |

### 3.7 Duplicações e diferenças de padrão

- **`perfilTemAcessoModulo` declarado duas vezes** (`configCache.js:724` e `:763`) — achado A-1.
- **22 imports com typo `.//`** (ex.: `authController.js:3,6,8,9`, `dashboardService.js:1`) — resolve
  igual, mas indica revisão insuficiente.
- **Montagem de rotas inconsistente:** `usuarios`, `ocorrencias`, `recepcao` e `painel` sem `requireAuth`
  no mount; os demais com.
- **`dashboard`** não usa middleware no router — a validação está manual em `dashboardController.js:4-38`.

---

## 4. FRONTEND

### 4.1 Organização

ES Modules nativos, sem build. `main.js` orquestra; `core/` tem infraestrutura compartilhada;
`modules/` tem 8 módulos carregados sob demanda por `core/moduleLoader.js` via `import()` dinâmico.

Páginas: `index.html` (app), `admin.html` (admin), `painel.html` (TV), `builder.html` (Studio).
Todas servidas estaticamente por `server.js:178-186` ou pelo rewrite de `server.js:152-175`.

**Problema no cache busting:** `server.js:169` injeta a versão nos query strings apenas por regex
`/\?v=[^"'\s]*/g`. Se um `<script>` não tiver `?v=`, ele não é versionado — a proteção é parcial e
dependente de disciplina manual de escrita.

### 4.2 Biblioteca visual e estilos

**Não há biblioteca de componentes.** Bootstrap é referenciado como global no `.eslintrc.json` e
`index.html` o referencia, mas o CSS real é próprio.

- **Tokens:** `--slate-50`…`--slate-900` em `style.css:21-30`, usados 42× em JS.
- **Duas escalas de cor simultâneas:** tokens `--slate-*` e valores Tailwind hardcoded inline
  (`#0284c7`, `#ef4444`, `#d97706` em `registros.js:254,297-318` e `main.css:66-69`).
- **Modularização de CSS fracassou:** `css/modules/` tem 8 folhas, **6 vazias**. Todo o estilo real está
  em `style.css` (9011 linhas). `auditorias.css` está vazia enquanto `registros.js` depende das classes
  `auditoria-*`.
- `main.css:7-12` ainda importa as 6 folhas vazias.

### 4.3 Comunicação com API e estado

- `core/api.js`: wrapper de `fetch`. **No 401 não redireciona para login nem limpa `session_active`** —
  a navegação de volta ao login depende do fluxo de cada módulo.
- `core/state.js`: estado global único exportado. `core/router.js` resolve hash → módulo.
- **Duplicação de infraestrutura (4× cada):** `escapeHtml`, cliente HTTP, helper de toast e
  formatação de data estão replicados em módulos em vez de consolidados em `core/`.
- `registros.js:826` e `auditorias.js:1087` chamam `setTimeout(refreshAccess, 250)` já executado por
  `auth.js:16,52` → 2-4 requisições extras a `/api/me` e `/api/modulos` por carga de página.

### 4.4 Estados de carregamento, erro, vazio e sucesso

Há骨架 skeleton (`css/modules/skeleton.css`, 242 linhas) e `core/ui.js` com toast e modal. O tratamento é
**desuniforme**: módulos mais antigos (livro, passagem) usam `window.prompt` e `alert`; os mais novos
(recepção, painel) usam modal e skeleton.

### 4.5 Formulários, validações, filtros e responsividade

- **Validação no frontend:** presente, mas **há regra de negócio no cliente**. Ex.: `recepcao.js:1337`
  define `nr_fila_destino: 18` e `escala.js:191,589,638` fixa `cd_setor=4`. Esses valores deveriam vir
  de configuração, não estar literais no JS.
- **Responsividade:** `style.css` tem 44 media queries (base boa). **`builder.css` tem 0** e
  **`recepcao.css` tem 0** → Studio e Recepção não têm responsividade própria. A sidebar responde por JS
  (`ui.js:216-218`, breakpoint 1366px).

### 4.6 Dados simulados, URLs fixas

Verificação negativa: **não foram encontrados** pacientes fictícios, `Math.random()` como ID, nem
`setTimeout` fingindo latência. O backend também não tem mock de banco — todos usam o pool real.
As simulações encontradas são apenas **fallbacks de configuração**.

**URLs e IPs fixos no frontend:** `recepcao.js:1393` referencia `192.168.1.25` diretamente, embora exista
variável `tasy_reports_url`. `index.html:1939` tem link SharePoint literal.

### 4.7 Segurança do frontend

- **`innerHTML` com dados do servidor** é o padrão de renderização em `recepcao.js`, `registros.js`,
  `painel.js` e `auditorias.js`. Há `escapeHtml` replicado, mas a aplicação manual é frágil —
  qualquer campo novo sem escape é XSS. Não foi possível confirmar, por inspeção, cobertura de todos os
  campos.
- Cards clicáveis com `<div style="cursor:pointer">` sem `role="button"`, `tabindex` ou handler de
  teclado: `registros.js:251`, `recepcao.js:926`.
- Foco não é movido para dentro do modal nem devolvido ao fechar (`ui.js:32-103`).

### 4.8 Bugs confirmados no frontend

| # | Bug | Evidência |
|---|---|---|
| F-1 | **`/api/ping` não existe.** `utils.js:138` chama `api.get('/api/ping')`; o backend define `/version` (`routes.js:28`) e **zero rotas** `ping`. O `catch` sempre dispara → rodapé de versão nunca preenchido e `system-status` fica permanentemente `offline` com "Serviço temporariamente indisponível", apesar de tudo estar saudável. | `frontend/src/core/utils.js:138` |
| F-2 | **Dois handlers conflitantes em `#btn-escala-limpar`.** `escala.js:332-347` descarta publicação pendente; `escala.js:673-679` limpa itens e mostra "Formulário limpo". Ambos no escopo de topo → executam juntos num clique, com mensagens contraditórias. | `frontend/src/modules/escala/escala.js:332,673` |
| F-3 | **`auth.validarPerfil` inexistente.** `livro.js:14` chama `auth.validarPerfil(...)`; não há export `validar*` em `core/auth.js`. **Latente**: a função nunca é chamada, então o `TypeError` não dispara hoje. | `frontend/src/modules/livro/livro.js:14` |
| F-4 | `window.prompt` no fluxo de escala, enquanto o mesmo requisito usa modal em `escala.js:338,361`. | `frontend/src/modules/escala/escala.js:640` |
| F-5 | **Falha de persistência mascarada no Studio.** Se `POST /api/admin/studio/pages/:id` falhar, o botão mostra "Salvo Localmente!" por 2,2s, sem toast. O usuário acredita que salvou no servidor. | `frontend/js/builder.js:2002-2015` |
| F-6 | **Acoplamento que anula lazy loading:** `escala.js:8` importa `showJustificativaModal` de `../livro/livro.js`. Abrir Escala carrega o Livro inteiro (2793 linhas), contradizendo o comentário de `moduleLoader.js:3` ("~60%"). | `frontend/src/modules/escala/escala.js:8` |

---

## 5. AUTENTICAÇÃO E CONFIGURAÇÕES

### 5.1 Fluxo de login, sessão e logout

1. `POST /api/login` → rate limit dedicado (20/15min por IP+usuário, `server.js:99-105`).
2. `authController.js` autentica no LDAP, busca o usuário no **TASY** (`usuarioRepository.findByUsername`),
   mapeia grupos AD para perfis e monta a sessão.
3. `atualizarContextoPerfilAtivo()` calcula `permissoesAtivas` e `setoresPassagemPermitidos` a cada
   requisição de contexto.
4. Sessão em Redis (`server.js:136`), TTL de `SESSION_TTL_HOURS` (12h padrão).
5. Cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure` conforme `COOKIE_SECURE` (default `false`).
6. Logout em `POST /api/logout`.

**Estado:** session-only. Não há refresh token nem extensão de sessão.

**Risco de exposição:** `COOKIE_SECURE=false` (confirmado em `docker compose config`) Combined com
`hsts: false` e `csp: false` (`server.js:74-78`) significa que o cookie trafega em claro se acessado por
HTTP. O commit `c2bd0c0` desabilitou CSP/HSTS deliberadamente para "restaurar funcionamento" em HTTP de
intranet — decisão consciente, com custo de segurança a registrar.

### 5.2 LDAP e controle de acesso

- `auth/ldapService.js` (368 linhas) faz bind, autentica e busca grupos via `ldapjs`.
- `requireAdmin` (`authMiddleware.js:11-28`) confia **exclusivamente** em `grupos_ad` da sessão,
  comparando com `ADMIN_AD_GROUP` (default `API_CONECTA_ADMIN`).
- `requirePermission` (`authMiddleware.js:30-51`) delega a `validarModuloPermissao` (`core/utils/acesso.js`).
- Perfis, módulos e permissões vêm do SQLite via `configCache`, administráveis pelo painel Admin.

**Achado crítico C-1** (detalhado em §8).

### 5.3 Configurações administráveis

~72 endpoints em `/api/admin` cobrem: perfis, módulos, permissões, setores e checkboxes da passagem,
cache, grupos LDAP, perfis Tasy, filas e config do Dashboard P.A., config de sistema, agendas/procedimentos
ECT, sessões, audit trail, páginas do Studio, teste de Oracle/LDAP/Tasy Reports, painéis TV, mapeamento
máquina→guichê, relatórios Tasy e telemetria.

### 5.4 Onde credenciais e configurações são persistidas

| Dado | Onde |
|---|---|
| Perfis, módulos, permissões | SQLite `auth.sqlite/config.db` |
| Configuração de sistema | `configuracoes_sistema` (SQLite) |
| Config do Dashboard P.A. | `configuracoes_dashboard_pa` (SQLite) |
| Cache de política | `data/policy-cache.json` (**versionado no Git**) |
| Trilha de auditoria | `conecta_audit_trail` (SQLite, **versionado no Git**) |
| Senhas do Oracle/LDAP/Tasy | `.env` (não versionado) e painel Admin via `reconnectPool` |

### 5.5 Separação entre homologação e produção

- `.env` e `.env.example` existem; `.env` está corretamente no `.gitignore`.
- **`DB_AUTO_MIGRATE` e `NODE_ENV` controlam DDL no startup** — divergência正面 entre ambientes.
- **Não existe config de differentiate produção.** `.env.example` documenta o conjunto de variáveis, e o
  `docker-compose.yml` é o mesmo para qualquer ambiente.
- **Não verificado:** se existe pipeline de deploy separando HML e PRD. Não há arquivos de CI/CD no
  repositório.

---

## 6. INFRAESTRUTURA

### 6.1 Dockerfiles e Compose

`Dockerfile`:
- Base `node:24-alpine` (comentário desatualizado dizendo 18).
- Instala `python3 make g++ sqlite-dev libaio curl unzip libc6-compat libnsl su-exec`.
- Copia `instantclient-files` para `/opt/oracle/instantclient` e recria symlinks quebrados
  (necessário porque os `.so` vieram de Windows).
- Roda como `USER node`, mas o entrypoint volta a `root` para normalizar permissões de bind mount e
  reduz privilégio via `su-exec` antes de iniciar a API — padrão correto.
- `CMD ["node", "backend/server.js"]`.

`docker-compose.yml`:
- Serviços `node` (porta 3020) e `redis`.
- `depends_on: redis: condition: service_healthy`.
- 4 bind mounts: `./auth.sqlite`, `./data`, `./frontend`, `./backend` — **o código-fonte está montado
  dentro do container em produção**, o que anula o `COPY` da imagem e permite edição em runtime.

### 6.2 Oracle Instant Client

Disponibilizado por **cópia dos binários** no repositório (`instantclient-files/`, ~234 MB, incluindo
`libocciei.so` de 130 MB). O `Dockerfile:43-52` remove symlinks quebrados e recria os necessários.

Isso é um problema de:
// tamanho do repositório e do contexto de build; e licença — o Instant Client da Oracle é
distribuído sob licença própria que **proíbe redistribuição** em alguns usos.

O `docker-entrypoint.sh` e `database/index.js`Detectam Thick mode procurando `libclntsh.so.19.1`.

### 6.3 Dependências para iniciar

Node 24, Oracle acessível em `192.168.1.21:1521/tasyhml`, LDAP em `192.168.1.4:389`, Redis (compose),
`.env` populado, `auth.sqlite/config.db` existente, `instantclient-files/` presente.

**Oracle e LDAP são dependências de rede externas e obrigatórias.** Não há mock local para
desenvolvimento offline.

### 6.4 Health checks, persistência e atualização

- `GET /health/liveness` — só verifica o processo.
- `GET /health` e `/health/readiness` — verificam Redis (`isReady`) e Oracle (conexão real). Retorna 503
  se qualquer um falhar.
- `GET /metrics` — protegido por `METRICS_TOKEN` via header ou **query string** (`server.js:238`);
  token em query string aparece em logs e histórico.

**Confirmado em runtime nesta auditoria:**

```
conecta-modular-node | Up (healthy) | 0.0.0.0:3020->3020
conecta-modular-redis | Up (healthy)
GET /health/readiness → 200 {"status":"UP","services":{"redis":"UP","oracle":"UP"}}
```

Detalhe de infraestrutura já corrigido **antes** desta auditoria (na sessão anterior): o healthcheck do
Redis referenciava `$REDIS_PASSWORD`, variável nunca injetada no container do Redis, o que mantinha o
serviço `unhealthy` permanentemente e impedia o `node` de sair do estado `Created` (4 semanas). Corrigido
em `docker-compose.yml`. Registrado aqui porque afeta a reprodutibilidade do ambiente.

**Persistência:** Redis com volume `redis_data` e `--appendonly yes`. SQLite por bind mount do arquivo
`.db` — **sem diretório de backup** definido. `auth.sqlite/config.db` versionado no Git é o único
"backup" existente.

### 6.5 Acoplamentos que afetam manutenção

| Acoplamento | Impacto |
|---|---|
| Bind mount de `./backend` e `./frontend` no compose | código editável em produção; imagem não é imutável |
| `escala.js` importa de `livro.js` | lazy loading anulado (F-6) |
| `registros.js` usa classes definidas em `auditorias.css` (vazio) | estilo não declarado |
| `recepcao` e `painel` montados sem `requireAuth` | padrão de segurança diferente dos demais |
| Instant Client no repositório | build lento, contexto grande, questão de licença |
| `database/index.js` faz fallback Thin/Thick por varredura de filesystem | comportamento diferente em dev e Docker |

---

## 7. VERIFICAÇÕES EXISTENTES

### 7.1 Inventário

| Verificação | Available | Resultado |
|---|---|---|
| Testes unitários | Sim — `npm test` | **41 testes, 41 passando, 0 falhando** (~8,3s) |
| Lint | Parcial — `.eslintrc.json` existe | **Não executável.** ESLint 10 requer `eslint.config.*`; o projeto usa `.eslintrc.json`. Não há script no `package.json`. |
| Type check | Não | Não há TypeScript. `checkJs` não configurado. |
| Build | Não aplicável | Sem bundler. |
| Validação de compose | Sim — `docker compose config -q` | **OK** |
| Smoke test HTTP | Sim | `GET /health/readiness` → 200 |

### 7.2 O que os testes cobrem

24 suítes em 11 arquivos: `acesso`, `admin_pilares`, `auditLogger`, `audit`, `checkboxes`,
`correlationId`, `infra`, `internacao_senha`, `painel`, `recepcao`, `utils`, `nativeSsoService`,
`nativeSsoController`.

Cobertura real: validação de entrada de pessoa física, cadastro, abertura de atendimento, categorias e
convênios, `parseBoolean`, resolução de mapeamento máquina→guichê.

### 7.3 Limitações das verificações

1. **Zero testes de autorização.** `validarModuloPermissao`, `requireAdmin`, `perfilTemAcessoModulo` e
   `configCache.getPerfisFromGroups` **não têm teste**. É exatamente onde estão os achados C-1, A-1, A-4 e
   A-5.
2. **Falha de dependência confundida com resultado.** Durante `npm test`, o log mostra
   `DPI-1047: Cannot locate a 64-bit Oracle Client library: libnnz19.so` e
   `[Oracle] Connect: :1521/`. Os testes **passam** porque não tocam no banco — mas o teste **não
   detectaria** uma falha de conexão real. Registrar: os 41/41 são válidos, mas não cobrem o caminho
   Oracle.
3. **`npm test` conecta ao Instant Client local** (`instantclient-files/`), o que torna a suíte
   dependente do ambiente de desenvolvimento.
4. **Lint não roda.** Requer migração de `.eslintrc.json` para `eslint.config.*` (ESLint 9+). Escopo do
   lint também é apenas `browser`/`sourceType: script` — não cobre o backend Node.

### 7.4 Verificações não executadas (e por quê)

| Verificação | Motivo |
|---|---|
| Testes de integração contra Oracle/Tasy | Exige escrita/leitura em banco de homologação — vedado pelo escopo |
| Testes de integração contra LDAP | Idem |
| Teste do fluxo de TTS / Google Translate | Chamada externa |
| `npm install` / atualização de dependências | Vedado explicitamente |
| Análise de vulnerabilidades (`npm audit`) | Requer rede e pode alterar lockfile |

---

## 8. ACHADOS E PENDÊNCIAS

### CRÍTICA

#### C-1 · Bypass de autorização LDAP concede perfil administrativo a usernames literais
**Problema:** se a busca de grupos no AD retornar vazio, dois usernames fixos recebem
automaticamente `API_CONECTA_ADMIN` e `API_CONECTA_ASSISTENCIAL_ENF`.

**Evidência:** `backend/src/modules/auth/ldapService.js:216-220`
```js
// Bypass temporário seguro de fallback caso ainda falhe o AD do hospital ou se o mock do admin for necessário
if (groups.length === 0 && (safeUsername.toLowerCase() === 'pedro.cesario'
                         || safeUsername.toLowerCase() === 'pedro.davi')) {
   groups.push('API_CONECTA_ADMIN');
   groups.push('API_CONECTA_ASSISTENCIAL_ENF');
}
```

**Impacto:** `requireAdmin` (`authMiddleware.js:11-28`) confia **exclusivamente** em `grupos_ad`. Uma
falha no AD — exatamente a condição que dispara o bypass — transforma esses dois usuários em
administradores plenos, com acesso aos ~72 endpoints de admin, incluindo escrita em Oracle e
reconfiguração de credenciais. O comentário no código admite ser um mock. É elevação de privilégio por
fallback, o padrão mais frágil possível: **falha de infraestrutura vira falha de segurança**.

**Direção:** remover o bloco. Se houver necessidade operacional de acesso de emergência, criar um grupo
real no AD e um procedimento de runbook, nunca um username no código. Adicionar alerta explícito quando
`grupos.length === 0` para que a falha do AD fique visível.

**Falta verificar:** se esses dois usuários já têm `API_CONECTA_ADMIN` no AD. Se tiverem, o bypass é
redundante e a remoção é segura. Se não tiverem, remover quebra o acesso de administração — precisa de
plano de migração no AD antes.

---

#### C-2 · Endpoints públicos do painel TV devolvem dados identificáveis de paciente
**Problema:** cinco endpoints do painel são montados sem `requireAuth` e `GET /painel/:id/estado` retorna
nome do paciente, data de nascimento e idade.

**Evidência:**
- `backend/src/routes.js:72` — `router.use('/painel', painelRoutes);` sem `requireAuth`.
- `backend/src/modules/painel/routes.js:10-14` — sem nenhum middleware, com comentário
  "não exigem login para exibir na TV do saguão".
- `backend/src/modules/painel/painelController.js:51-74` — monta o payload com PHI.

**Impacto:** qualquer dispositivo na rede da intranet pode enumerar nome e nascimento de pacientes.
Somado a `GET /painel/audio`, que faz proxy para o TTS do Google sem rate limit, há também risco de
abuso de cota do serviço externo. Em contexto LGPD (que o próprio README declara), é exposição de dado
sensível sem controle de acesso.

**Direção:** decidir o mínimo necessário para a TV. A TV precisa de senha e nome do paciente chamado, não
de data de nascimento nem de idade. Remover esses campos do payload público. Para autenticação da TV,
preferir token de dispositivo de longa duração por painel (gerado no Admin) a sessão de usuário — evita
que a TV exija login diário. Adicionar rate limit em `/painel/audio`.

**Falta verificar:** se as TVs do hospital estão em rede segmentada/vLAN dedicada. Se sim, o risco é
menor, mas o controle por token continua sendo o controle correto.

---

### ALTA

#### A-1 · `perfilTemAcessoModulo` declarado duas vezes — a versão case-insensitive é código morto
**Problema:** a função tem duas declarações no mesmo escopo. Em JavaScript a **última** prevalece.

**Evidência:** `backend/src/core/config/configCache.js:724` (case-insensitive, correta) e `:763`
(case-sensitive, prevalece). `requirePermission` depende dela para **todos** os módulos.

**Impacto:** o acesso passa a exigir correspondência exata de casing entre o perfil na sessão e o ID no
banco. Qualquer divergência de caixa gera **negação de acesso inesperada** — usuário legítimo impedido
de operar. Como a autorização é central, um erro aqui atinge todos os módulos.

**Direção:** remover a duplicata, mantendo uma única versão (preferencialmente case-insensitive).
Adicionar teste unitário que valide o comportamento com casing divergente — hoje não existe teste para
esta função.

**Falta verificar:** qual das duas versões está efetivamente em produção no container. O container foi
recriado durante esta sessão, então o código atual está em vigor; mas é preciso confirmar se o ambiente
de homologação em uso executa a mesma revisão.

---

#### A-2 · Vazamento de conexão Oracle por validação fora do `try`
**Problema:** `getConnection()` é chamado, a validação lança, e o `finally` que fecha a conexão nunca é
alcançado.

**Evidência:** `backend/src/modules/dashboard/dashboardRepository.js:41-52`
```js
const conn = await getConnection();
const setorNum = Number(cdSetor);
if (!Number.isInteger(setorNum) || setorNum <= 0) {
  throw new Error('Setor inválido');   // ← fora do try
}
try { ... } finally { await conn.close(); }
```

**Impacto:** cada requisição com `cd_setor` inválido consome uma conexão do pool (min 3, max 15) sem
devolvê-la. Com repetição suficiente, esgota o pool e derruba o Dashboard. É um vetor de negação de
serviço trivial — basta enviar `cd_setor=abc` em laço.

**Direção:** mover a validação para antes de `getConnection()`, ou abrir o `try` imediatamente após a
aquisição.

**Falta verificar:** se o mesmo padrão `getConnection()` → validação → `throw` → `try` aparece em outros
repositórios. A auditoria encontrou este caso; uma varredura sistemática por todos os `getConnection()`
é necessária.

---

#### A-3 · `autoCommit` passado como opção de `execute()` é silenciosamente ignorado
**Problema:** `autoCommit` é propriedade da conexão/pool, não uma opção do método `execute`. Com
`oracledb.autoCommit = false` global (`database/index.js:4`), um `execute` que grava seguido de `close()`
sem `commit()` **descarta a transação**.

**Evidência:**
- `backend/src/modules/ocorrencias/ocorrenciaService.js:464-474` — grava em `OCORRENCIA`
- `backend/src/modules/recepcao/recepcaoRepository.js:1701-1723` — estoque/cancelamento de senha

**Impacto:** potencial **perda silenciosa de dados**. Gravações de ocorrência de enfermagem e de
atendimento de recepção podem ser revertidas sem erro visível. Precisa de confirmação em ambiente real
antes de dimensionar — pode já estar ocorrendo em produção.

**Direção:** substituir por `await conn.commit()` explícito antes do `close()`. Auditar todos os
`execute` de escrita no projeto em busca do mesmo padrão e padronizar numa função helper de transação.

**Falta verificar:** se `pool.execute` (usado em outros pontos) tem o mesmo problema. Este é o achado com
maior potencial de dano operacional e **deve ser validado com dados reais em homologação primeiro**.

---

#### A-4 · `GET /api/modulos` expõe a matriz completa de permissões a qualquer autenticado
**Problema:** retorna todos os módulos com, para cada um, quais perfis têm acesso. Não filtra pelo perfil
do usuário que fez a requisição.

**Evidência:** `backend/src/routes.js:43-46` + `backend/src/core/config/configCache.js:968-978`
(`getAllModulosWithPermissoes`).

**Impacto:** qualquer usuário logado, inclusive o de menor privilégio, obtém a topologia completa de
permissões e perfis. Facilita reconhecimento para elevação de privilégio.

**Direção:** filtrar por `usuario.perfilAtivo`. O frontend precisa apenas dos módulos do próprio perfil —
confirmar comparando o consumo em `core/auth.js` antes de mudar, para não quebrar a UI.

---

#### A-5 · Alias na raiz executa controller de admin sem `requireAdmin`
**Problema:** a rota `/api/passage m/checkboxes` é montada com apenas `requireAuth`, mas chama
`adminController.listarCheckboxesAtivos`, que não faz verificação de admin.

**Evidência:** `backend/src/routes.js:50` → `backend/src/modules/admin/adminController.js:517-525`
(mesma função de `admin/routes.js`, montada em `/admin` com `requireAdmin`).

**Impacto:** exposição de endpoint administrativo a qualquer autenticado. O impacto isolado é baixo — só
lista checkboxes ativos — mas estabelece precedente de que "está em adminController" não implica
proteção, o que é perigoso se o padrão for replicado.

**Direção:** adicionar `requireAdmin` na linha 50, ou mover o handler para um controller neutro.

---

### MÉDIA

#### M-1 · `cdMotivo` recebido e silenciosamente descartado no cancelamento
`recepcaoRepository.js:1701-1721` — a assinatura recebe `cdMotivo` mas a query não o utiliza. **Impacto:**
perda de informação de auditoria; motivo do cancelamento não fica registrado. **Falta verificar:** se
existe coluna de destino em `ATENDIMENTO` ou tabela de auditoria que deveria gravá-lo.

#### M-2 · SQL dinâmico lido do banco e executado sem whitelist
`recepcaoRepository.js:1060-1070` — lê `ds_sql` da tabela `relatorio` e executa direto via `conn.execute`.
**Impacto:** se um usuário com acesso de escrita ao banco inserir SQL arbitrário nessa tabela, ele será
executado com as permissões da aplicação. **Direção:** whitelist de `relatorio` por identificador
aprovado, ou parametrizar a consulta em vez de interpolá-la. **Falta verificar:** quem consegue escrever
em `relatorio` (via TasyAppServer?) e se essa tabela é alimentada por processo não confiável.

#### M-3 · Senha do Redis com fallback previsível no código
`core/config/redisClient.js:4-18` — `password: process.env.REDIS_PASSWORD || 'redis_pwd_default'`.
**Impacto:** se a variável não for definida em produção, o Redis sobe com senha trivial. **Direção:**
falhar explicitamente no startup se ausente, como já é feito com `SESSION_SECRET` (`server.js:127-131`).
Alinhar com o fix já aplicado no `docker-compose.yml`.

#### M-4 · DDL executado no startup fora de produção
`database/index.js:133-145` acionado por `server.js:291`. Condição:
`DB_AUTO_MIGRATE === 'true' || NODE_ENV !== 'production'`.
**Impacto:** ambientes de homologação executam `CREATE TABLE`/`CREATE SEQUENCE` no Oracle real a cada
startup. Risco de lock de DDL, e migração implícita fora de controle de versão. **Direção:** migrar
versionado (já existe `config_migrations` no SQLite — usar o mesmo padrão para Oracle). **Falta
verificar:** quais tabelas `initTables()` cria e se já existem no banco de homologação.

#### M-5 · `GET` com efeito colateral na geração de relatórios
`recepcao/routes.js:36` — `GET /recepcao/relatorios/:id/gerar` gera relatório no TasyAppServer.
**Impacto:** viola idempotência; vulnerável a CSRF via `<img src>`; pré-fetch de navegador dispara o
relatório. **Direção:** migrar para `POST`.

#### M-6 · Autorização acoplada a perfil hardcoded em vez de módulo
`pacientes/pacienteController.js:50-52` — `if (!validarPerfil(usuario, 'enfermagem'))` em vez de
`validarModuloPermissao(usuario, 'dashboard')`. **Impacto:** inconsistente com o restante; impede
configuração por módulo no Admin. **Direção:** alinhar ao padrão dos demais controllers.

#### M-7 · Setor `48` fixo no filtro de avaliadores
`auditorias/auditoriaRepository.js:21-26` — `cd_setor` fixo em 48 nos binds. **Impacto:** lista de
avaliadores sempre do mesmo setor. **Falta verificar:** se 48 é a unidade de auditoria pretendida no
hospital ou resíduo de desenvolvimento.

#### M-8 · Falha de persistência mascarada no Studio
`frontend/js/builder.js:2002-2015` — exibe "Salvo Localmente!" mesmo quando o POST falha. **Impacto:**
o usuário acredita que a tela foi salva no servidor quando não foi. Perda de trabalho. **Direção:** toast
de erro no 401/500 e differentiate sucesso local de sucesso no servidor.

#### M-9 `/api/ping` inexistente gera falso alarme permanente na UI
`frontend/src/core/utils.js:138` chama endpoint que não existe; `backend/src/routes.js:28` define
`/version`. **Impacto:** rodapé de versão vazio e `system-status` permanentemente `offline` com
"Serviço temporariamente indisponível", mesmo com todos os serviços saudáveis — treina a equipe a ignorar
alertas reais. **Direção:** corrigir para `/api/version` (o handler já retorna `ok`/`version`).

---

### BAIXA

#### B-1 · Dois handlers conflitantes em `#btn-escala-limpar`
`escala.js:332-347` e `:673-679`, ambos no escopo de topo do módulo → executam juntos num clique, um
descartando alteração pendente e o outro mostrando "Formulário limpo". **Impacto:** UX contraditória e
risco de perda de dados preenchidos. **Direção:** manter um handler.

#### B-2 · Importações com typo `.//` em 22 arquivos
Ex.: `authController.js:3,6,8,9`, `dashboardService.js:1`. **Impacto:** nenhum funcional, mas sinaliza
revisão insuficiente. **Direção:** corrigir em passagem.

#### B-3 · Duplicação de infraestrutura no frontend (4× cada)
`escapeHtml`, cliente HTTP, toast e formatação de data replicados por módulo em vez de em `core/`.
**Impacto:** correção em um lugar não alcança os outros — origem provável do F-1. **Direção:**
consolidar em `core/`.

#### B-4 · CSS modular não adotado
6 das 8 folhas em `css/modules/` estão vazias; `main.css:7-12` as importa. `auditorias.css` vazia
enquanto `registros.js` depende de classes `auditoria-*`. **Impacto:** estilo real concentrado em 9011
linhas monolíticas; `style.css` é gargalo de manutenção e de merge.

#### B-5 · Acoplamento que anula o lazy loading
`escala.js:8` importa `showJustificativaModal` de `livro.js` (2793 linhas), contradizendo
`moduleLoader.js:3`. **Direção:** mover a função para `core/ui.js`.

#### B-6 · 13 arquivos de script soltos na raiz, não versionados
`fix-*.js` (7), `test-*.js` (4), `PDFReport-*.pdf`. `test-tasy.js` **contém credenciais Oracle em texto
claro** (`oracledb.getConnection` com user/password) e caminho absoluto do Instant Client; diretório com
permissão `drwxrwxrwx`. **Direção:** mover para fora da raiz, para `.gitignore` explícito e para local
protegido. **Rotacionar a credencial exposta** se ela for de ambiente real.

#### B-7 · `auth.sqlite/config.db` e `data/policy-cache.json` versionados
Banco com trilha de auditoria em controle de versão. **Direção:** remover do versionamento e definir
procedimento de backup; versionar apenas o schema de migração.

#### B-8 · Ausência de tarefas agendadas
Nenhum cron, agenda ou worker encontrado. Cache pré-aquecido apenas no startup. **Falta verificar:**
se há rotina necessária de limpeza (senhas antigas, sessões, rascunhos de passagem) executada
manualmente. Dado o incidente de 10.276 senhas acumuladas, há indício de que a falta de rotina de
limpeza contribuiu para o problema.

#### B-9 · Cobertura de `escapeHtml` não verificável
`innerHTML` é o padrão de renderização com dados do servidor. Não foi possível confirmar, por inspeção,
que todo campo interpolado passa por escape. **Falta verificar:** auditoria linha a linha, ou
adoção de renderização por textContent.

#### B-10 · Acessibilidade inconsistente
`painel.html` e `builder.html` com zero `aria-*`/`role`/`<label>`. Cards clicáveis sem semântica nem
teclado (`registros.js:251`, `recepcao.js:926`). Foco não gerenciado em modais (`ui.js:32-103`).
Positivo: `index.html` tem 38 atributos `aria-*` e a sidebar tem `aria-expanded` com restauração de foco
(`ui.js:220-270`).

#### B-11 · Responsividade ausente em dois módulos
`builder.css` e `recepcao.css` com zero media queries; `style.css` tem 44. **Impacto:** Studio e
Recepção não se adaptam.

#### B-12 · Lint configurado mas não executável
`.eslintrc.json` usa formato legado; ESLint 9+ exige `eslint.config.*`. Sem script no `package.json`,
o lint nunca roda. Escopo também cobre só `browser`/`script` — **não pega o backend Node**.
**Impacto:** regra `no-undef` como `error` nunca foi aplicada.

#### B-13 · Regras de negócio no frontend
`recepcao.js:1337` (`nr_fila_destino: 18`), `escala.js:191,589,638` (`cd_setor=4`), `escala.js:387-388,
629-630` (`cd_modulo: 4`), `recepcao.js:1203,1330` (`setor 39`), `recepcao.js:1223` (convênio 3),
`recepcao.js:1244` (classificação 2), `painel.js:7` (`recepcao_principal`). **Impacto:** mudar a
organização do hospital exige editar JavaScript de frontend, não configuração. Alguns destes já são
administráveis no painel (fila do Dashboard P.A.) — verificar se o literal diverge do valor configurado.

#### B-14 · `COOKIE_SECURE=false` com HSTS e CSP desabilitados
`server.js:74-78` e `.env`. Commit `c2bd0c0` desabilitou CSP/HSTS deliberadamente para funcionar em HTTP
de intranet. **Impacto:** cookie de sessão trafega em claro; sem CSP, XSS tem impacto máximo.
**Direção:** decisão consciente, mas registrar formalmente o risco e a mitigação (rede dedicada). Se
houver HTTPS disponível no proxy, reabilitar.

#### B-15 · `/metrics` aceita token por query string
`server.js:238` — `req.query.token`. **Impacto:** o token aparece em logs de acesso, histórico de
browser e `Referer`. **Direção:** aceitar apenas header.

---

## 9. RESUMO DOS PRINCIPAIS ACHADOS

O projeto tem **maturidade funcional alta e maturidade de engenharia baixa**. O domínio está
efetivamente implementado contra Oracle/TASY real, sem mocks, com separação rõtulos-controller-service-
repository na maioria dos módulos, auditoria, cache, health checks e shutdown gracioso. Não é um
protótipo.

Os problemas estão concentrados em três frentes:

**1. Segurança de autorização (o mais grave).** O bypass C-1 é um caso didático: uma decisão tomada para
contornar indisponibilidade do AD converteu falha de infraestrutura em elevação de privilégio. Some-se a
ele a duplicação em A-1 (a função que decide acesso a tudo), a exposição da matriz de permissões (A-4) e
a rota de admin sem `requireAdmin` (A-5). O achado C-2 expõe PHI por endpoints sem autenticação. Não há
**nenhum teste** cobrindo essa camada.

**2. Transacionalidade (risco de dano real).** A-3 é o achado mais potencialmente destrutivo: um padrão
de `autoCommit` que o node-oracledb ignora, combinado com `autoCommit=false` global e `close()` sem
`commit()`, pode reverter gravações de ocorrências e atendimentos **sem erro visível**. Requer validação
com dados reais antes de qualquer outra ação corretiva.

**3. Disciplina de engenharia.** 41 testes que cobrem validação de entrada mas não autorização nem
transação; lint configurado e não executável; CSS modularizado e não adotado (6 folhas vazias);
infraestrutura duplicada 4× no frontend; regras de negócio com IDs de setor e fila literais no JS.

A infraestrutura had um problema operacional próprio — o deadlock de healthcheck que manteve o container
em `Created` por 4 semanas — corrigido antes desta auditoria e registrado em §6.4.

---

## 10. ARQUIVOS INSPECIONADOS

### Raiz
`.env.example` · `.eslintrc.json` · `.gitignore` · `Dockerfile` · `docker-compose.yml` ·
`docker-entrypoint.sh` · `ecosystem.config.js` · `package.json` · `README.md` ·
`ARQUITETURA_E_PADROES.md` · `DESIGN_SYSTEM.md` · `AUDITORIA_PRE_PRODUCAO.md` · `test-tasy.js` ·
`scripts/init-config-db.js`

### Backend — núcleo
`server.js` · `src/routes.js` · `src/core/config/configCache.js` ·
`src/core/config/redisClient.js` · `src/core/config/modulos.js` ·
`src/core/database/index.js` · `src/core/database/auditDatabase.js` ·
`src/core/middlewares/authMiddleware.js` · `src/core/middlewares/errorHandler.js` ·
`src/core/middlewares/responseHandler.js` · `src/core/middlewares/correlationIdMiddleware.js` ·
`src/core/utils/acesso.js` · `src/core/utils/auditLogger.js` · `src/core/utils/logger.js` ·
`src/core/utils/parseBoolean.js` · `src/core/errors/AppError.js`

### Backend — módulos
`auth/` (`routes`, `authController`, `ldapService`, `usuarioRepository`, `perfilRepository`,
`policyClientService`, `nativeSsoController`, `nativeSsoService`) ·
`dashboard/` (`routes`, `dashboardController`, `dashboardService`, `dashboardRepository`) ·
`recepcao/` (`routes`, `recepcaoController`, `recepcaoService`, `recepcaoRepository`,
`tasyReportsClient`) · `painel/` (`routes`, `painelController`, `painelEventsService`) ·
`admin/` (`routes`, `adminController`) · `auditorias/` (5 arquivos) · `ocorrencias/` (3 arquivos) ·
`escalas/` (4 arquivos) · `registros/` (4 arquivos) · `pacientes/` (4 arquivos) ·
`setores/` (4 arquivos) · `usuarios/` (4 arquivos)

### Backend — testes (13 arquivos)
`test/acesso` · `test/admin_pilares` · `test/auditLogger` · `test/audit` · `test/checkboxes` ·
`test/correlationId` · `test/infra` · `test/internacao_senha` · `test/painel` · `test/recepcao` ·
`test/utils` · `src/modules/auth/nativeSsoService.test.js` ·
`src/modules/auth/nativeSsoController.test.js`

### Frontend
`index.html` · `admin.html` · `painel.html` · `builder.html` · `js/builder.js` ·
`src/main.js` · `src/core/` (`api`, `auth`, `router`, `state`, `moduleLoader`, `ui`, `draft`, `utils`) ·
`src/modules/` (8 módulos) · `css/style.css` · `css/main.css` · `css/builder.css` ·
`css/skeleton.css` · `css/modules/` (8 folhas)

### Infraestrutura do host
`docker ps -a` · `docker inspect` (node, redis) · `docker logs` · `docker compose config` ·
healthcheck de `conecta-modular-redis` · `GET /health/readiness`

### Contexto
Walkthrough da sessão anterior (`/root/.gemini/antigravity-cli/brain/4044084c3-.../walkthrough.md`) e
handoff do projeto `CONECTA_MODULAR`.

---

## 11. VERIFICAÇÕES EXECUTADAS

| # | Verificação | Resultado |
|---|---|---|
| 1 | `npm test` | **41/41 passando**, 24 suítes, ~8,3s. Logs de `DPI-1047` aparecem mas não afetam o resultado (testes não acessam Oracle). |
| 2 | `docker compose config -q` | OK — YAML válido. |
| 3 | `docker compose config` (expandido) | Confirmou `REDIS_PASSWORD` resolvida corretamente após o fix. |
| 4 | `docker ps -a` | `conecta-modular-node` e `conecta-modular-redis` **healthy**; porta 3020 publicada. |
| 5 | `curl /health/readiness` | **200** `{"status":"UP","services":{"redis":"UP","oracle":"UP"}}` |
| 6 | `docker logs conecta-modular-node` | Oracle Thick OK, Redis conectado, ConfigCache carregado (5 perfis/9 módulos/23 permissões), 5 setores pré-aquecidos. |
| 7 | `npx eslint frontend/src/core/utils.js` | **Falhou por configuração**, não por código — ESLint 10 exige `eslint.config.*`. Registrado como B-12. |
| 8 | `git status` / `git diff --stat` / `git log` | 14 não rastreados + 17 modificados de conteúdo. Metade das "modificações" de `git status` são apenas mudança de permissão (`100644=>100755`) com `mtime` de ago/set — pré-existentes. Nenhuma escrita. |
| 9 | `sha256sum auth.sqlite/config.db` (2x) | Hash idêntico — banco não tocado. |
| 10 | `git check-ignore data/policy-cache.json` | Não ignorado apesar de `data/` no `.gitignore` → B-7. |
| 11 | Introspecção SQLite de `config.db` | 15 tabelas enumeradas. |
| 12 | `grep -rn "/ping" backend/src` | **Zero resultados** → confirma F-1/M-9. |
| 13 | `grep validarPerfil frontend/src/core/auth.js` | **Zero resultados** → confirma F-3. |
| 14 | `grep "function perfilTemAcessoModulo"` | **2 ocorrências** (`:724`, `:763`) → confirma A-1. |
| 15 | Leitura de `painel/routes.js`, `ldapService.js:205-230`, `authMiddleware.js`, `database/index.js`, `dashboardRepository.js:35-60`, `moduleLoader.js` | Evidências primárias de C-1, C-2, A-1, A-2, M-4, B-5. |

---

## 12. DÚVIDAS QUE DEPENDEM DO RESPONSÁVEL

1. **C-1:** `pedro.cesario` e `pedro.davi` já possuem `API_CONECTA_ADMIN` no AD? Se sim, remover o bypass
   é seguro. Se não, qual o procedimento para criar o grupo no AD?
2. **C-2:** As TVs estão em VLAN/rede dedicada? Qual é o mínimo de dados que a tela precisa exibir?
3. **A-3:** Houve perda real de gravação em `OCORRENCIA` ou em atendimentos de recepção? A percepção
  Operations de "às vezes o registro não aparece" confirmaria o achado.
4. **M-8 / Studio:** "Salvo Localmente!" foi手段 de perda de trabalho já relatada?
5. **M-7:** Setor 48 é a unidade de auditoria correta no hospital?
6. **M-2:** Quem alimenta a tabela `relatorio` com `ds_sql`? É processo interno controlado?
7. **B-13:** A fila 18 (PA - INTERNAÇÃO) e os setores 4/39 são fixos por decisão clínica ou
   configuração que deveria ser administrável?
8. **B-14:** Existe HTTPS no proxy? O desligamento de CSP/HSTS foi decisão do responsável ou consequência
   do restauro de funcionamento?
9. **§5.5:** Existe pipeline de deploy separando homologação e produção? Não há arquivos de CI/CD no
   repositório.
10. **B-8:** Existe rotina manual de limpeza de senhas acumuladas? O incidente de 10.276 senhas sugere
    ausência.
11. **Escopo:** o versionamento em Git do SQLite de configuração é intencional (backup portátil) ou
    herança não revisada?
12. **B-6:** A credencial Oracle exposta em `test-tasy.js` é de ambiente real? Precisa rotação?

---

## 13. LIMITAÇÕES DA AUDITORIA

1. **Análise predominantemente estática.** Não houve exercício do fluxo com usuário real, exceto o
   health check. O comportamento em homologação não foi verificado.
2. **Sem acesso a dados.** Nenhuma query de escrita ou leitura em Oracle foi executada, por vedação do
   escopo. Conclusões sobre SQL vêm da leitura do código.
3. **Escopo do container:** a auditoria cobriu `docker-compose.yml`, `Dockerfile` e o estado atual dos
   containers `conecta-modular-node` e `conecta-modular-redis`. **Não** foram auditados: o proxy
   (nginx/IIS — não identificado no repositório), o `ecosystem.config.js` em detalhe, o
   `docker-entrypoint.sh`, nem a configuração do PM2 em produção.
4. **Não foram auditados** os demais ~25 containers do host (projetos Heal, Conecta Assistencial,
   biblioteca-heal, n8n, importador-contabil). Alguns estão parados há semanas — pode haver o mesmo
   padrão de healthcheck bloqueando start.
5. **Cobertura de XSS não confirmada.** `innerHTML` é o padrão; a auditoria identificou o risco mas não
   fez revisão linha a linha de todos os campos interpolados.
6. **Testes não cobrem o caminho Oracle.** A suíte passa sem tocar no banco; falhas de conexão ou de
   SQL **não seriam detectadas** por ela.
7. **Módulos `painel_senhas` e `builder`** foram inspecionados, mas o Studio não teve verificação
   funcional (salvar página, publicar).
8. **Histórico Git não analisado** em profundidade — apenas log e status. Não se verificou autoria dos
   13 arquivos não rastreados nem se contêm segredo além do achado B-6.
9. **Verificações de vulnerabilidade de dependências não executadas** (`npm audit` exigiria rede e
   acesso a advisory DB).
10. **Não é uma revisão de arquitetura.** Este documento mapeia o estado atual. Nenhuma conclusão sobre
    adequação arquitetural, Patterns ou tecnologia foi feita — conforme solicitado, não se propõe
    reescrita antes do mapeamento.

**Cobertura:** a auditoria cobriu a totalidade do código de aplicação do repositório
(backend, frontend, infraestrutura, testes e documentação). Ficaram **fora** apenas itens de ambiente
externo ao repositório, listados no ponto 3 e 4.

---

## 14. CONFIRMAÇÃO

**Nenhum arquivo existente foi alterado nesta auditoria.**

A única criação é este relatório, `DIAGNOSTICO_CONECTA_01_ESTADO_ATUAL.md`.

Verificações de não-mutação realizadas:

- `sha256sum auth.sqlite/config.db` idêntico antes e depois:
  `9a1e7171...1bb313`.
- Nenhum comando de escrita em banco (Oracle, LDAP, SQLite) foi executado. As verificações de
  `docker compose` foram de leitura (`config`, `config -q`). A re-criação dos containers foi
  **decidida e autorizada na sessão anterior**, fora do escopo desta auditoria.
- Nenhuma dependência do projeto foi instalada ou atualizada. O `npx eslint` tentou obter o ESLint 10
  (ausente do projeto), **falhou antes de produzir efeito** e o `node_modules/` está inalterado.
- Nenhum `npm install`, `npm update` ou alteração de lockfile.

Estado do working tree ao final, com `core.fileMode=false` (contagem de conteúdo real):

```
14 não rastreados (??)   → 13 pré-existentes + este relatório
17 modificados (M)       → 16 pré-existentes + docker-compose.yml (fix da sessão anterior)
 config.db sha256:       inalterado
 Arquivos criados:       DIAGNOSTICO_CONECTA_01_ESTADO_ATUAL.md  (este relatório)
```

**Sobre as permissões de arquivo:** `git status` sem `-c core.fileMode=false` reporta **53 arquivos
modificados**, mas 36 deles são apenas `mode change 100644 => 100755`. Essas mudanças **não são desta
auditoria** — os `mtime` dessasPermissões são de 28/08, 03/09 e 04/09, anteriores a esta sessão, e o
diretório do projeto é `drwxrwxrwx`. São artefato do volume compartilhado / bind mount com permissões
flexíveis. Nenhum arquivo teve seu conteúdo alterado por esta auditoria.

---

*Auditoria inicial de estado atual. Nenhuma decisão de correção foi implementada. Achados propostos como
base para a etapa seguinte de revisão, não como mudanças autorizadas.*