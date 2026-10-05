# Diagnóstico Conecta HEAL — Etapa 02: Estabilização Inicial e Revalidação

**Data da Auditoria/Execução:** 01 de Outubro de 2026  
**Projeto:** Conecta HEAL 2.0 (Hospital Espírita André Luiz)  
**Escopo:** Correção cirúrgica de 3 problemas delimitados, criação de verificações automatizadas 100% isoladas e revalidação aprofundada de segurança, autorização e infraestrutura sem efeitos colaterais.

---

## 1. Registro da Base Git e Alterações Preexistentes

### 1.1 Estado do Repositório Git
- **Branch Atual:** `master`
- **Commit Base:** `c2bd0c002b56fc37b516cc67d894473c6e77c5d7`
- **Mensagem do Commit:** `fix(infra): restaurar funcionamento do Conecta 2.0 removendo CSP/HSTS no HTTP e ativando Thick mode com libaio`
- **Ambiente de Execução:** Linux (Host local com containers Docker `conecta-modular-node` e `conecta-modular-redis` em execução nas portas 3020 e 6379).

### 1.2 Alterações Preexistentes Preservadas
Foram identificadas e integralmente preservadas todas as alterações locais não comitadas presentes na árvore de trabalho (`working tree`), incluindo modificações do usuário em:
- Arquivos de banco e cache: `auth.sqlite/config.db`, `backend/src/core/database/auth.sqlite`, `data/policy-cache.json`.
- Módulos de domínio: `auditorias`, `dashboard`, `escalas`, `ocorrencias`, `pacientes`, `painel`, `recepcao`, `registros`, `setores`, `usuarios`.
- Camada de infraestrutura e frontend: `docker-compose.yml`, `frontend/index.html`, `frontend/painel.html`, `frontend/css/modules/*.css`.
- Testes preexistentes e scripts utilitários na raiz do projeto.

---

## 2. Achados Confirmados, Corrigidos e Mapeados

| Item | Problema Identificado | Status no Código | Ação Realizada |
| :--- | :--- | :--- | :--- |
| **1. Concessão Automática de Grupos (LDAP)** | Hardcoded bypass em `ldapService.js` (linhas 216–220) atribuía `API_CONECTA_ADMIN` e `API_CONECTA_ASSISTENCIAL_ENF` para `pedro.cesario` e `pedro.davi` quando `groups.length === 0`. | **Confirmado** | **Corrigido**. Trecho removido; injeção de dependência criada para testes unitários; retorno vazio mantido; ausência de privilégio garantida. |
| **2. Ciclo de Conexão Oracle (Dashboard)** | Em `dashboardRepository.js` (`findPacientesComStatus`), `getConnection()` era adquirido antes da validação do parâmetro `cdSetor`. Parâmetro inválido lançava erro fora do bloco `try/finally`, vazando a conexão do pool. | **Confirmado** | **Corrigido**. Validações de tipo e valor de `cdSetor` movidas para antes da chamada `getConnection()`. Injeção de mock adicionada para testes. |
| **3. Indicador de Disponibilidade / Versão** | Frontend em `utils.js` chamava `GET /api/ping`, enquanto o backend em `routes.js` expunha `GET /api/version`. Resultava em erro 404 permanente no rodapé e status offline no frontend. | **Confirmado** | **Corrigido**. Backend atualizado para suportar rota composta `['/version', '/ping']` e frontend atualizado para chamar `/api/version`. |
| **4. Padrões Semelhantes de Conexão Oracle** | Aquisição antecipada de conexão em outros repositórios antes de checagens em memória (`recepcaoRepository.js:1583`, `recepcaoRepository.js:1047`, `setorService.js:41`). | **Confirmado (Estático)** | **Mapeado**. Registrado formalmente para a próxima etapa, sem ampliação desnecessária do escopo atual. |

---

## 3. Detalhamento das Correções Realizadas

### 3.1 Correção 1: Remoção de Privilégio por Exceção no LDAP (`ldapService.js`)
- **Arquivo:** `backend/src/modules/auth/ldapService.js`
- **Problema:** Quando a consulta de grupos no Active Directory não encontrava grupos (`groups.length === 0`), havia uma condicional explícita que injetava `API_CONECTA_ADMIN` e `API_CONECTA_ASSISTENCIAL_ENF` caso o usuário fosse `pedro.cesario` ou `pedro.davi`.
- **Correção:**
  1. Remoção do bloco de bypass.
  2. Implementação das funções de controle `setCustomCreateClientForTest` e `resetCustomCreateClientForTest` para viabilizar testes unitários controlados sem necessidade de conexão com o Active Directory real.
  3. Com a remoção, usuários sem grupos no AD recebem array vazio `[]`, o que na camada de autenticação (`authController.js:verificarAcesso`) resulta em recusa legítima com HTTP 403 (`Acesso negado: perfil profissional ainda não habilitado`).

#### Diff Relevante (`ldapService.js`):
```diff
--- a/backend/src/modules/auth/ldapService.js
+++ b/backend/src/modules/auth/ldapService.js
@@ -11,7 +11,20 @@ function escapeLdapFilter(value) {
     .replace(/\//g, '\\2f');
 }
 
+let customCreateClient = null;
+function setCustomCreateClientForTest(fn) {
+  customCreateClient = fn;
+}
+function resetCustomCreateClientForTest() {
+  customCreateClient = null;
+}
+
 function createClient() {
+  if (customCreateClient) {
+    return customCreateClient();
+  }
   return new Promise((resolve, reject) => {
@@ -212,13 +225,6 @@ function searchUserGroups(client, safeUsername, resolve, reject) {
             }
           });
           res2.on('end', () => {
-            // Bypass temporário seguro de fallback caso ainda falhe o AD do hospital ou se o mock do admin for necessário
-            if (groups.length === 0 && (safeUsername.toLowerCase() === 'pedro.cesario' || safeUsername.toLowerCase() === 'pedro.davi')) {
-               groups.push('API_CONECTA_ADMIN');
-               groups.push('API_CONECTA_ASSISTENCIAL_ENF');
-            }
             client.unbind(() => {});
             resolve(groups);
           });
```

---

### 3.2 Correção 2: Ciclo de Vida de Conexão Oracle no Dashboard (`dashboardRepository.js`)
- **Arquivo:** `backend/src/modules/dashboard/dashboardRepository.js`
- **Problema:** A função `findPacientesComStatus(cdSetor, turno)` executava `const conn = await getConnection();` antes de validar se `setorNum` era um número inteiro positivo. Quando um valor inválido era fornecido (ex: `0`, `-1`, `"abc"`, `null`), o erro `Error('Setor inválido')` era disparado antes de entrar no bloco `try`, impedindo a execução do `conn.close()` no bloco `finally` e vazando conexões do pool Oracle até a exaustão (`NJS-500: connection request timeout`).
- **Correção:**
  1. A validação do setor (`Number.isInteger(setorNum) || setorNum <= 0`) e a resolução do turno (`getInicioPlantao(turno)`) foram posicionadas antes da aquisição da conexão.
  2. Implementação de hooks `setCustomGetConnectionForTest` e `resetCustomGetConnectionForTest` para viabilizar simulação de conexão em testes automatizados.
  3. Garantia de que qualquer erro durante ou após a aquisição feche a conexão no bloco `finally`.

#### Diff Relevante (`dashboardRepository.js`):
```diff
--- a/backend/src/modules/dashboard/dashboardRepository.js
+++ b/backend/src/modules/dashboard/dashboardRepository.js
@@ -49,15 +49,15 @@ async function findSetoresInternacao() {
 }
 
 async function findPacientesComStatus(cdSetor, turno) {
-  const conn = await getConnection();
   const setorNum = Number(cdSetor);
   const setorStr = String(cdSetor);
 
   if (!Number.isInteger(setorNum) || setorNum <= 0) {
     throw new Error('Setor inválido');
   }
 
   const dtInicioPlantao = getInicioPlantao(turno);
+  const conn = customGetConnection ? await customGetConnection() : await getConnection();
 
   try {
     const atendimentosResult = await conn.execute(
```

---

### 3.3 Correção 3: Indicador de Disponibilidade e Versão (`routes.js` e `utils.js`)
- **Arquivos:** `backend/src/routes.js` e `frontend/src/core/utils.js`
- **Problema:** O método `loadVersion()` no frontend realizava requisição para `GET /api/ping`. No backend, a rota correspondente estava registrada como `GET /version` (sob o prefixo `/api`, resultando em `/api/version`). O endpoint `/api/ping` retornava 404, fazendo com que o frontend caísse no bloco `catch`, adicionasse a classe CSS `.offline` no indicador do rodapé e exibisse "Serviço temporariamente indisponível", além de nunca exibir o número de versão `v2.2.1`.
- **Correção:**
  1. No backend (`backend/src/routes.js`), a rota foi alterada para `router.get(['/version', '/ping'], ...)`. Isso garante compatibilidade total com clientes antigos ou chamadas diretas a `/api/ping`.
  2. No frontend (`frontend/src/core/utils.js`), a chamada foi ajustada para o endpoint canônico `api.get('/api/version')`.
  3. O contrato de dados retornado `{ ok: true, version: string, showTestBar: boolean }` foi preservado.

#### Diff Relevante (`routes.js` e `utils.js`):
```diff
--- a/backend/src/routes.js
+++ b/backend/src/routes.js
@@ -24,8 +24,8 @@ const setorController = require('./modules/setores/setorController');
 const pacienteController = require('./modules/pacientes/pacienteController');
 
-// Versão da API e status
-router.get('/version', (req, res) => {
+// Versão da API e status (suporta /version e alias /ping)
+router.get(['/version', '/ping'], (req, res) => {
   let version = '1.0.0';
   let showTestBar = false;

--- a/frontend/src/core/utils.js
+++ b/frontend/src/core/utils.js
@@ -135,7 +135,7 @@ export function getMonday(dateString) {
 
 export async function loadVersion() {
   try {
-    const result = await api.get('/api/ping');
+    const result = await api.get('/api/version');
     const el = document.getElementById('app-version-footer');
     const status = document.getElementById('system-status');
```

---

## 4. Verificações Automatizadas e Garantia de Isolamento

### 4.1 Estratégia de Isolamento
Para cumprir rigorosamente as restrições operacionais:
1. **Sem Dependências Externas:** Os testes não realizam requisições de rede ao LDAP real (`heal.local`), não executam queries contra o Oracle (`192.168.1.21`), não escrevem no Redis (`sess:*` / `rl:*`) e não gravam nos bancos SQLite da aplicação (`auth.sqlite` / `config.db`).
2. **Injeção de Mocks em Memória:**
   - Para o LDAP: implementado cliente sintético baseado em `EventEmitter` do Node.js, emitindo eventos `'searchEntry'` e `'end'` em memória.
   - Para o Oracle: implementado mock de conexão com rastreamento estrito de ciclo de vida (`connectionAcquired`, `execute`, `connectionClosed`).
3. **Execução Isolada via Node Test Runner:**
   - Criado arquivo de teste exclusivo: `backend/test/etapa02_estabilizacao.test.js`.
   - Executado diretamente via runtime nativo do Node.js (`node:test` e `node:assert`).

### 4.2 Resultados Obtidos

```
Comando executado: node --test backend/test/etapa02_estabilizacao.test.js

▶ Etapa 02: LDAP Group Bypass Removal & Authentication Scenarios
  ✔ Cenário 1 - Credenciais inválidas: deve rejeitar com erro de credenciais (1.97ms)
  ✔ Cenário 2 - Falha de comunicação/conexão LDAP: deve rejeitar com erro de conexão (0.32ms)
  ✔ Cenário 3 - Autenticação válida com grupos vazios para pedro.cesario: NÃO deve conceder grupos de bypass (1.74ms)
  ✔ Cenário 4 - Autenticação válida com grupos vazios para pedro.davi: NÃO deve conceder grupos de bypass (0.53ms)
  ✔ Cenário 5 - Autenticação válida com grupos vazios para usuário comum: lista vazia preservada (0.79ms)
  ✔ Cenário 6 - Autenticação válida com grupos autorizados legítimos no AD: preserva grupos retornados (0.56ms)
✔ Etapa 02: LDAP Group Bypass Removal & Authentication Scenarios (7.38ms)

▶ Etapa 02: Oracle Connection Lifecycle in dashboardRepository.findPacientesComStatus
  ✔ Cenário 1 - Parâmetro inválido: NÃO adquire conexão do pool (0.74ms)
  ✔ Cenário 2 - Execução com sucesso: adquire e libera a conexão corretamente (0.37ms)
  ✔ Cenário 3 - Erro durante execução SQL: garante liberação da conexão no finally (0.27ms)
  ✔ Cenário 4 - Falha na aquisição da conexão: propaga erro sem chamar close (0.26ms)
✔ Etapa 02: Oracle Connection Lifecycle in dashboardRepository.findPacientesComStatus (2.00ms)

▶ Etapa 02: Availability Indicator Contract & States
  ✔ Contrato: Resposta de /api/version deve conter ok, version e showTestBar (0.29ms)
  ✔ Simulação do Frontend - Estado de Sucesso: remove classe offline e define texto de operação normal (0.14ms)
  ✔ Simulação do Frontend - Estado de Erro HTTP (ex: 500, 404): adiciona classe offline e define texto de indisponibilidade (0.11ms)
  ✔ Simulação do Frontend - Estado de Falha de Rede (Network Error / Timeout): adiciona classe offline (0.13ms)
✔ Etapa 02: Availability Indicator Contract & States (0.84ms)

Resumo: 14 testes executados, 3 suítes, 14 aprovados, 0 falhas, 0 pendências. Duração: 131ms.
```

---

## 5. Mapeamento Estático de Padrões Semelhantes de Conexão Oracle

Foi conduzida uma busca estática em todos os arquivos de repositório e serviços do backend para identificar locais onde `getConnection()` é chamado antes de validações em memória ou sem garantia integral de `conn.close()`:

1. **`backend/src/modules/recepcao/recepcaoRepository.js:1583` (`verificarDuplicidadePaciente`):**
   - **Comportamento Atual:** Adquire `conn = await getConnection();` antes de verificar se `cpf` ou `dtNascimento` foram informados. Quando ambos estão ausentes (`conds.length === 0`), o método fecha a conexão e retorna `{ duplicado: false }`, consumindo desnecessariamente uma conexão do pool.
   - **Recomendação para Etapa 03:** Mover a checagem `if (!cpf && !dtNascimento) return { duplicado: false };` para o início da função, antes de `getConnection()`.

2. **`backend/src/modules/recepcao/recepcaoRepository.js:1047` (`gerarRelatorioAtendimento`):**
   - **Comportamento Atual:** Adquire conexão antes de validar o formato dos parâmetros `cdRelatorio` e `nrAtendimento` via `parseInt`.
   - **Recomendação para Etapa 03:** Validar e sanitizar parâmetros antes de chamar o pool.

3. **`backend/src/modules/setores/setorService.js:41` (`buscarSetoresComEscalaLiberada`):**
   - **Comportamento Atual:** Executa `const conn = await getConnection();` antes de validar se a string `dataPlantao` está no formato esperado `YYYY-MM-DD`.
   - **Recomendação para Etapa 03:** Validar formato de data antes da abertura de conexão.

---

## 6. Revalidação Aprofundada dos Achados

### 6.A Painel TV e Serviço de Voz (TTS)
1. **Endpoints Públicos Identificados (`backend/src/modules/painel/routes.js`):**
   - `GET /api/painel/audio`: Proxy público de síntese de voz.
   - `GET /api/painel/detectar-maquina`: Retorna IP e identificação da máquina cliente.
   - `GET /api/painel/minha-tv`: Retorna os dados da TV configurada para o IP solicitante.
   - `GET /api/painel/:id/estado`: Retorna o estado completo das senhas da TV (última chamada e histórico).
   - `GET /api/painel/:id/stream`: Endpoint Server-Sent Events (SSE) para notificações em tempo real.
2. **Dados Retornados em `:id/estado` e `stream`:**
   - O payload inclui `nm_paciente` (obtido via `COALESCE(psf.nm_paciente, pf.nm_social, pf.nm_pessoa_fisica)`), `cd_senha_gerada`, `ds_guiche`, `ds_fila` e `hr_chamada`.
   - **Privacidade/LGPD:** Não são expostos dados clínicos, diagnósticos, CPF, data de nascimento ou idade. Contudo, o **nome completo** do paciente é retornado sem qualquer exigência de token ou autenticação.
3. **Origem e Destino do Texto do TTS:**
   - Na aplicação frontend (`frontend/src/modules/painel/painel.js:514`), o anúncio sonoro é realizado localmente no navegador via `window.speechSynthesis` nativo. A frase sintetizada é: `"Paciente, {nm_paciente}. Senha P, {numero}. {guiche}."`.
   - No backend, o endpoint `GET /api/painel/audio?texto=...` atua como um **proxy HTTP aberto** para o serviço externo do Google Translate (`https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=...`), gravando o arquivo em cache no disco local via MD5. Não há restrição de domínios, token de acesso ou rate limit específico por IP para esse endpoint.

### 6.B Matriz de Autorização e Controle de Acesso
1. **Endpoints Protegidos Exclusivamente por `requireAuth`:**
   - `GET /api/modulos`: Qualquer usuário logado pode consultar.
   - `GET /api/passagem/checkboxes`: Retorna todos os checkboxes ativos da passagem.
   - `GET /api/setores-internacao` e `GET /api/setores-livro`: Aliases de compatibilidade legada.
   - `GET /api/pacientes-setor/:cd_setor`: Retorna a lista de pacientes de um setor sem validar se o perfil do usuário logado tem autorização para aquele setor específico.
2. **Catálogo vs. Matriz Completa em `/api/modulos`:**
   - O endpoint `/api/modulos` chama `configCache.getAllModulosWithPermissoes()`, que mapeia todos os módulos do sistema e inclui a propriedade `perfisPermitidos` (lista de todos os perfis com acesso a cada módulo). Trata-se, portanto, da **matriz completa de permissões** do sistema, e não apenas do catálogo dos módulos aos quais o usuário logado possui acesso.
3. **Duplicidade de `perfilTemAcessoModulo` em `configCache.js`:**
   - **Versão 1 (linha 725):** Utiliza normalização defensiva (`trim().toLowerCase()`) tanto no `perfil_id` quanto no `modulo_id`.
   - **Versão 2 (linha 764):** Utiliza comparação estrita (`pm.perfil_id === perfilId && pm.modulo_id === moduloId`).
   - **Efeito no Runtime:** Devido ao mecanismo de *hoisting* de declarações de função em JavaScript no mesmo escopo, a Versão 2 (linha 764) sobrescreve completamente a Versão 1. No banco SQLite `config.db`, todos os identificadores foram cadastrados em caixa baixa; portanto, se algum chamador passar `'RECEPCAO'` ou `'Admin'`, a validação falhará incorretamente.
4. **Contrato dos Checkboxes da Passagem de Plantão:**
   - O endpoint `/api/passagem/checkboxes` é consumido por `frontend/src/modules/passagem/passagem.js:744` na função `carregarCheckboxesDinamicos()`. O retorno esperado é `{ success: true, data: [ { chave, label, categoria, icone } ] }`, mapeado para o array `CHECKBOX_INTERCORRENCIAS`. O módulo administrativo (`frontend/admin.html`) consome `/api/admin/passagem/checkboxes` para manutenção (CRUD e toggle).

### 6.C Emissão de Relatórios TASY (`/relatorios/:id/gerar`)
1. **Efeitos Reais do Endpoint:**
   - O endpoint `GET /recepcao/relatorios/:id/gerar` **não** executa DML (`INSERT`/`UPDATE`/`DELETE`) nem procedimentos armazenados (`procedures`/`packages`) no banco Oracle local do hospital.
   - Ele executa uma leitura em Oracle (`SELECT nr_interno_conta FROM conta_paciente WHERE nr_atendimento = :atend`) para recuperar o identificador da conta do atendimento.
   - Em seguida, monta um payload padronizado em JSON (`br.com.philips.tasy.dto.shared.report.ReportsParam`) e faz uma requisição HTTP REST contra a API oficial do Philips Tasy (`POST {tasyUrl}/resources/service/Report/generateReports`).
   - O TasyAppServer compila o relatório e devolve o fluxo binário do PDF, que o Conecta faz streaming diretamente para a janela do navegador.
2. **Autorização e Seleção do Relatório:**
   - A rota é protegida pelo middleware `requirePermission('recepcao', 'emitir_relatorio')`.
   - O identificador numérico `:id` é repassado ao TasyAppServer via parâmetro `code: parseInt(id, 10)`. Não há validação por lista branca (whitelist) no backend Conecta para restringir se o código solicitado pertence aos relatórios autorizados da instituição.

### 6.D Segredos e Persistência de Dados
1. **Credenciais Expostas no Código/Histórico:**
   - `test-tasy.js` e `test-db-cancel.js` (arquivos soltos não versionados na raiz do projeto): contêm credenciais em texto claro da conta `tasy` do banco de dados Oracle (`192.168.1.21:1521/tasyhml`).
   - `.git/config`: a URL do repositório remoto contém credenciais básicas embutidas em texto claro (`http://pedro.cesario:***@git.heal.br/...`).
2. **Arquivos de Estado e Banco Rastreados no Git:**
   - `auth.sqlite/config.db`: rastreado ativamente no repositório Git.
   - `backend/src/core/database/auth.sqlite`: rastreado ativamente no repositório Git.
   - `data/policy-cache.json`: rastreado ativamente no repositório Git.
3. **Arquivos WAL / SHM:**
   - Não foram encontrados arquivos `.sqlite-wal`, `.sqlite-shm`, `.db-wal` ou `.db-shm` ativos no disco durante esta inspeção.
4. **Recomendações (Para Execução em Etapas Futuras):**
   - Adicionar regras específicas no `.gitignore` para ignorar `*.sqlite`, `*.db`, `*.sqlite-wal`, `*.sqlite-shm`, `*.db-wal`, `*.db-shm`, `data/policy-cache.json` e `test-*.js`.
   - Remover os bancos do rastreamento do Git com `git rm --cached`, mantendo os arquivos locais.
   - Remover as credenciais embutidas na URL do remote Git institucional (`git remote set-url origin ...`).
   - Rotacionar as senhas do usuário Oracle `tasy` em ambiente de homologação após a limpeza dos scripts de teste.

---

## 7. Impactos para Implantação e Ações Administrativas Prévias

### 7.1 Impacto da Remoção do Bypass de Grupos LDAP
- **Usuários Afetados:** `pedro.cesario` e `pedro.davi`.
- **Comportamento Anterior:** Caso esses usuários estivessem no AD mas sem os grupos correspondentes atribuídos no atributo `memberOf`, o sistema automaticamente concedia os grupos `API_CONECTA_ADMIN` e `API_CONECTA_ASSISTENCIAL_ENF`.
- **Novo Comportamento:** Usuários sem os grupos no AD receberão erro HTTP 403 e a tela exibirá: *"Acesso negado: perfil profissional ainda não habilitado para a passagem de plantão"*.
- **Ação Obrigatória Antes do Deploy:**
  O administrador do Active Directory institucional (`heal.local`) deve verificar e incluir as contas `pedro.cesario` e `pedro.davi` nos grupos de segurança apropriados (`API_CONECTA_ADMIN` e/ou `API_CONECTA_ASSISTENCIAL_ENF` / `API_CONECTA_MEDICO`) antes que esta versão seja publicada em produção.

### 7.2 Validação Visual do Indicador de Disponibilidade em Homologação
Após o deploy da versão corrigida em ambiente de homologação:
1. Acessar a aplicação no navegador (ex: `http://192.168.1.18:3020/`).
2. Abrir o DevTools (F12) > aba **Console** e **Rede**.
3. Verificar a requisição para `/api/version`:
   - Deve retornar HTTP 200 com payload `{"ok":true,"version":"2.2.1","showTestBar":false}`.
4. Observar o rodapé da página:
   - O elemento de versão deve exibir `v2.2.1`.
   - O indicador de status do sistema (`#system-status`) deve estar com o ícone verde (sem a classe `.offline`).
   - O texto de status deve exibir *"Todos os serviços estão operando normalmente"*.
5. Simulação de falha:
   - Ao interromper temporariamente a conectividade de rede ou bloquear a rota no DevTools, o indicador deve alternar imediatamente para vermelho com a mensagem *"Serviço temporariamente indisponível"*.

> [!NOTE]
> O endpoint `/api/version` valida a disponibilidade HTTP da aplicação Node.js. Para monitorar a prontidão das dependências externas (Oracle Database e Redis), deve-se utilizar os endpoints de orquestração `/health` ou `/health/readiness`, que realizam sondagem ativa nos serviços integrados.

---

## 8. Confirmação de Integridade

- [x] **Containers e Serviços:** Nenhum container Docker foi reiniciado, recriado ou publicado.
- [x] **Bancos de Dados:** Nenhuma operação de escrita foi realizada no Oracle, Redis, LDAP ou nos arquivos SQLite da aplicação.
- [x] **Scripts de Manutenção:** Nenhum script de correção ou manutenção encontrado na raiz (`fix-*.js`, `test-*.js`) foi executado.
- [x] **Segredos e Credenciais:** Nenhuma credencial institucional ou grupo de segurança foi modificado.
- [x] **Alterações do Usuário:** Todas as modificações preexistentes na árvore do repositório foram integralmente respeitadas e preservadas.
