# Diagnóstico Conecta HEAL — Etapa 02.1: Fechamento da Estabilização da Base

**Data:** 01 de Outubro de 2026  
**Projeto:** Conecta HEAL 2.0 (Hospital Espírita André Luiz)  
**Escopo:** Fechamento das lacunas de evidência da Etapa 02, execução das funções reais nos testes unitários isolados, correção do indicador de disponibilidade no frontend, mapeamento estrito da visibilidade das alterações no ambiente Docker em execução e retificação técnica das conclusões sobre áudio/TTS.

---

## 1. Arquivos Alterados Nesta Etapa

| Arquivo | Natureza da Alteração | Justificativa |
| :--- | :--- | :--- |
| [`frontend/src/core/utils.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/frontend/src/core/utils.js) | Correção semântica e validação de envelope em `loadVersion()` | Substituição da mensagem enganosa *"Todos os serviços estão operando normalmente"* por *"Aplicação disponível"*; adição de validação explícita de `result.ok !== false`. |
| [`backend/src/core/utils/versionHandler.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/core/utils/versionHandler.js) | Criação de handler isolado | Desacopla a resolução dos metadados de versão (`package.json`) e o handler Express para viabilizar testes de contrato puros sem importar o roteador principal do backend (que carrega `redisClient`). |
| [`backend/src/routes.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/routes.js) | Delegação da rota `['/version', '/ping']` | Utiliza o `versionHandler` desacoplado, mantendo compatibilidade bidirecional com zero overhead. |
| [`backend/src/modules/dashboard/dashboardRepository.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/dashboard/dashboardRepository.js) | Preservação de erro no bloco `finally` em `findPacientesComStatus` | Garante que, caso `conn.close()` falhe durante o tratamento de um erro SQL primário, o erro de negócio/SQL seja preservado e propagado ao chamador, mantendo a falha de fechamento registrada nos logs. |
| [`backend/test/etapa02_estabilizacao.test.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/test/etapa02_estabilizacao.test.js) | Atualização e ampliação da suíte isolada | Executa as funções reais (`loadVersion`, `findPacientesComStatus`, `authController.login`, `versionHandler`), cobrindo 22 cenários em 4 suítes sem dependências externas. |

---

## 2. Diffs Relevantes das Alterações

### 2.1 Frontend — Indicador de Disponibilidade (`frontend/src/core/utils.js`)
```diff
--- a/frontend/src/core/utils.js
+++ b/frontend/src/core/utils.js
@@ -136,6 +136,10 @@ export function getMonday(dateString) {
 export async function loadVersion() {
   try {
     const result = await api.get('/api/version');
+    if (!result || result.ok === false) {
+      throw new Error('Resposta de versão incompatível');
+    }
+
     const el = document.getElementById('app-version-footer');
     const status = document.getElementById('system-status');
     const statusText = document.getElementById('system-status-text');
@@ -150,7 +154,7 @@ export async function loadVersion() {
     }
 
     status?.classList.remove('offline');
-    if (statusText) statusText.textContent = 'Todos os serviços estão operando normalmente';
+    if (statusText) statusText.textContent = 'Aplicação disponível';
   } catch (e) {
     document.getElementById('system-status')?.classList.add('offline');
     const statusText = document.getElementById('system-status-text');
```

### 2.2 Backend — Preservação de Erro e Tratamento no `finally` (`dashboardRepository.js`)
```diff
--- a/backend/src/modules/dashboard/dashboardRepository.js
+++ b/backend/src/modules/dashboard/dashboardRepository.js
@@ -58,6 +58,7 @@ async function findPacientesComStatus(cdSetor, turno) {
   const dtInicioPlantao = getInicioPlantao(turno);
   const conn = customGetConnection ? await customGetConnection() : await getConnection();
 
+  let sqlError = null;
   try {
     const atendimentosResult = await conn.execute(
       `SELECT a.nr_atendimento
@@ -312,8 +313,20 @@ async function findPacientesComStatus(cdSetor, turno) {
         NEWS_RESULTADO: news ? news.resultado : null,
       };
     });
+  } catch (err) {
+    sqlError = err;
+    throw err;
   } finally {
-    await conn.close();
+    if (conn) {
+      try {
+        await conn.close();
+      } catch (closeErr) {
+        console.error('[Dashboard] Erro ao fechar conexão Oracle:', closeErr.message);
+        if (!sqlError) {
+          throw closeErr;
+        }
+      }
+    }
   }
 }
```

### 2.3 Backend — Desacoplamento do Version Handler (`versionHandler.js` e `routes.js`)
```javascript
// backend/src/core/utils/versionHandler.js
const path = require('path');
const fs = require('fs');

function getVersionData() {
  let version = '1.0.0';
  let showTestBar = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../package.json'), 'utf8'));
    version = pkg.version || version;
    showTestBar = !!pkg.showTestBar;
  } catch {}
  return { ok: true, version, showTestBar };
}

function versionHandler(req, res) {
  res.json(getVersionData());
}

module.exports = { getVersionData, versionHandler };
```

```diff
--- a/backend/src/routes.js
+++ b/backend/src/routes.js
@@ -24,17 +24,10 @@ const adminRoutes = require('./modules/admin/routes');
 const setorController = require('./modules/setores/setorController');
 const pacienteController = require('./modules/pacientes/pacienteController');
 
+const { versionHandler } = require('./core/utils/versionHandler');
+
 // Versão da API e status (suporta /version e alias /ping)
-router.get(['/version', '/ping'], (req, res) => {
-  let version = '1.0.0';
-  let showTestBar = false;
-  try {
-    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
-    version = pkg.version || version;
-    showTestBar = !!pkg.showTestBar;
-  } catch {}
-  res.json({ ok: true, version, showTestBar });
-});
+router.get(['/version', '/ping'], versionHandler);
```

---

## 3. Testes Executados e Resultados Obtidos

Os testes foram executados com a suíte unitária isolada nativa do Node.js:
```bash
node --test backend/test/etapa02_estabilizacao.test.js
```

### 3.1 Saída Efetiva dos Testes
```
▶ Etapa 02.1: Frontend loadVersion Real Implementation
  ✔ Sucesso HTTP: atualiza versão, remove .offline e exibe "Aplicação disponível" (7.64ms)
  ✔ HTTP não exitoso (ex: 500, 404): adiciona .offline e exibe "Serviço temporariamente indisponível" (0.60ms)
  ✔ Resposta incompatível/inválida ({ ok: false } ou nulo): trata como falha e adiciona .offline (0.63ms)
  ✔ Falha de rede (Network Error / Timeout / Abort): adiciona .offline (0.44ms)
  ✔ Recuperação de falha para sucesso: transiciona de offline para online corretamente (0.44ms)
✔ Etapa 02.1: Frontend loadVersion Real Implementation (11.03ms)

▶ Etapa 02.1: Version & Ping Route Contract (Isolated)
  ✔ Contrato: versionHandler retorna ok, version e showTestBar compatíveis com package.json (0.35ms)
  ✔ Roteamento Express: router responde igualmente para /version e /ping sem dependências externas (1.34ms)
✔ Etapa 02.1: Version & Ping Route Contract (Isolated) (1.85ms)

▶ Etapa 02.1: LDAP Service & Real Controller Authentication Flow
  ✔ ldapService: credenciais inválidas rejeitam com erro (1.12ms)
  ✔ ldapService: falha de conexão rejeita com erro de comunicação (0.22ms)
  ✔ ldapService: erro durante a busca de grupos retorna lista vazia de forma segura (0.73ms)
  ✔ ldapService: busca sem grupos retorna lista vazia (sem bypass para pedro.cesario ou pedro.davi) (1.62ms)
  ✔ ldapService: busca com grupos legítimos retorna os nomes CN extraídos (0.57ms)
  ✔ Controller Flow: pedro.cesario com grupos vazios NÃO cria sessão e retorna HTTP 403 (82.44ms)
  ✔ Controller Flow: pedro.davi com grupos vazios NÃO cria sessão e retorna HTTP 403 (20.92ms)
  ✔ Controller Flow: credenciais inválidas retornam HTTP 401 e NÃO criam sessão (0.95ms)
  ✔ Controller Flow: falha de conexão LDAP retorna erro HTTP e NÃO cria sessão (0.44ms)
✔ Etapa 02.1: LDAP Service & Real Controller Authentication Flow (109.79ms)

▶ Etapa 02.1: Real findPacientesComStatus Connection Lifecycle & Error Preservation
  ✔ Entrada inválida: lança erro "Setor inválido" e NÃO adquire conexão (0.75ms)
  ✔ Sucesso: adquire conexão e fecha corretamente no finally (0.32ms)
  ✔ Erro SQL: libera conexão no finally e propaga o erro SQL original (0.22ms)
  ✔ Falha de aquisição de conexão: propaga erro original sem chamar close() (0.16ms)
  ✔ Comportamento quando close() falha durante erro SQL: preserva o erro SQL principal (NÃO mascara) (0.34ms)
  ✔ Comportamento quando close() falha em execução com sucesso: propaga a falha de fechamento (0.37ms)
✔ Etapa 02.1: Real findPacientesComStatus Connection Lifecycle & Error Preservation (2.43ms)

Total: 22 testes executados, 4 suítes, 22 aprovados, 0 falhas, 0 pendências. Duração: 318ms.
```

---

## 4. Indicação de Funções Reais Exercitadas e Evidências de Isolamento

### 4.1 Funções Reais Exercitadas nos Testes
1. **Frontend Real:** A função `loadVersion()` importada diretamente de [`frontend/src/core/utils.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/frontend/src/core/utils.js) foi executada contra instâncias reais da classe `api` de [`frontend/src/core/api.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/frontend/src/core/api.js) e um DOM simulado via `global.document`. Nenhuma lógica de negócio do frontend foi duplicada ou simulada internamente no teste.
2. **Backend Real — LDAP e Controller:** 
   - `ldapService.authenticate()` e `ldapService.getUserGroups()` reais de [`ldapService.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/auth/ldapService.js).
   - O fluxo completo de criação de sessão foi exercitado chamando diretamente a função controladora real `authController.login(req, res)` de [`authController.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/auth/authController.js).
3. **Backend Real — Repositório Oracle:** A função `findPacientesComStatus(cdSetor, turno)` real de [`dashboardRepository.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/dashboard/dashboardRepository.js) foi executada.
4. **Backend Real — Contrato de Rotas:** O middleware `versionHandler` real e a resolução de rota `router.get(['/version', '/ping'], ...)` foram exercitados via `express.Router()`.

### 4.2 Limitação Encontrada e Solução de Isolamento
- **Limitação Identificada:** Ao tentar importar o roteador raiz [`backend/src/routes.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/routes.js) diretamente nos testes, o Node carrega síncronamente `ocorrenciasRoutes` -> `ocorrenciaController` -> `core/config/redisClient`. O arquivo `redisClient.js` executa imediatamente `await redisClient.connect()` no momento do `require`, disparando tentativas de conexão TCP reais com o Redis (`172.18.0.2:6379`).
- **Ajuste Mínimo para Isolamento:** Extraiu-se a lógica da rota `/version` para [`backend/src/core/utils/versionHandler.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/core/utils/versionHandler.js). O arquivo de rotas apenas delega a execução para essa função, permitindo testar o contrato exato das rotas sem acoplar o carregamento de clientes de banco e cache.

### 4.3 Inspeção dos Hooks Globais de Teste
- **Exportação:** `setCustomCreateClientForTest` e `resetCustomCreateClientForTest` em `ldapService.js`; `setCustomGetConnectionForTest` e `resetCustomGetConnectionForTest` em `dashboardRepository.js`.
- **Limpeza Garantida:** Todos os blocos de teste utilizam `afterEach(() => { reset...(); })`. Mesmo em caso de falha de asserção, o runner do Node garante a execução do `afterEach`, impedindo contaminação entre testes.
- **Risco de Interferência:** Nulo durante execução sequencial no mesmo processo. As variáveis internas são mantidas em escopo de módulo e iniciam como `null`.
- **Ausência de Controle Externo:** Nenhum desses hooks está registrado em rotas Express, middlewares ou controladores HTTP. Eles não são invocáveis nem manipuláveis remotamente por requisições de clientes.

---

## 5. Inspeção do Indicador de Disponibilidade no Frontend

### 5.1 Semântica de Disponibilidade
- **Constatação:** O endpoint `/api/version` (e seu alias `/api/ping`) atesta estritamente a **disponibilidade do servidor HTTP Node.js** e retorna metadados de versão (`version`, `showTestBar`). Ele **não** realiza consultas ao Oracle nem ao Redis.
- **Correção Textual:** A mensagem do rodapé foi corrigida de *"Todos os serviços estão operando normalmente"* para *"Aplicação disponível"*. Isso evita transmitir a falsa impressão de que os bancos corporativos estão operacionais quando apenas o processo Node respondeu.
- **Prontidão de Dependências:** Caso a governança do projeto deseje monitorar o estado real de Oracle e Redis, devem ser utilizados os endpoints dedicados `/health` ou `/health/readiness`, que possuem sondas ativas de banco e cache.

### 5.2 Frequência Real de Atualização
- **Inspeção no Código:** A função `loadVersion()` é chamada exclusivamente no arquivo [`frontend/src/main.js:355`](file:///media/SAAS/SAAS/CONECTA_MODULAR/frontend/src/main.js#L355) dentro de `initApp()` durante o evento `DOMContentLoaded`.
- **Comportamento Observado:** **Não há polling, timer ou `setInterval` de verificação periódica.** O indicador é executado exatamente uma vez na inicialização da aplicação. Não há alternância dinâmica em tempo de execução sem recarregamento da página pelo usuário (`F5`).

---

## 6. Visibilidade das Edições no Ambiente em Execução

Com base na inspeção local de `docker-compose.yml`, `Dockerfile`, `docker-entrypoint.sh` e `sudo docker top conecta-modular-node`:

### 6.1 Mapeamento de Volumes e Processos
1. **Arquivos Editados no Host:** Modificações nos diretórios `/media/SAAS/SAAS/CONECTA_MODULAR/backend/` e `/media/SAAS/SAAS/CONECTA_MODULAR/frontend/`.
2. **Bind Mounts Ativos:** O `docker-compose.yml` mapeia explicitamente os volumes:
   - `./backend:/home/node/app/backend`
   - `./frontend:/home/node/app/frontend`
   - `./auth.sqlite:/home/node/app/auth.sqlite`
   - `./data:/home/node/app/data`
   Portanto, os arquivos no sistema de arquivos do container são idênticos e sincronizados em tempo real com o host.
3. **Código Backend Carregado em Memória:**
   - O comando em execução no container é `node backend/server.js` (PID 126695, iniciado às 12:16).
   - O Node.js compila e mantém módulos CommonJS em cache de memória (`require.cache`).
   - Não há `nodemon`, `pm2-watch` ou flag `node --watch` em execução no container de produção.
   - **Conclusão:** O processo backend em execução **continua executando o código anterior residente em memória**. As alterações de backend efetuadas no host estarão no disco do container, mas só surtirão efeito no runtime após um reinício do processo ou container.
4. **Arquivos Frontend Servidos aos Clientes:**
   - Em `backend/server.js:178`, o Express utiliza `express.static(path.join(__dirname, '../frontend'))`.
   - O `express.static` lê os arquivos estáticos diretamente do sistema de arquivos para cada requisição HTTP.
   - **Conclusão:** As alterações no frontend (como em `frontend/src/core/utils.js`) **são servidas imediatamente** para navegadores que carregarem os scripts estáticos, sem necessidade de reinicialização do container.

---

## 7. Retificação Técnica sobre Áudio, TV e TTS

Foi realizada uma busca estática exaustiva por todas as referências ao endpoint `/api/painel/audio`, função `gerarAudioVoz` e chamadas de áudio:

### 7.1 Consumo do Endpoint `/api/painel/audio`
- **Frontend Atual:** **Não consome o endpoint `/api/painel/audio`.** Não há nenhuma requisição para essa rota no frontend do Conecta HEAL.
- **Mecanismo Real de Fala:** O arquivo [`frontend/src/modules/painel/painel.js:518`](file:///media/SAAS/SAAS/CONECTA_MODULAR/frontend/src/modules/painel/painel.js#L518) utiliza estritamente o `window.speechSynthesis` nativo do navegador, instanciando um objeto `SpeechSynthesisUtterance`.
- **Seleção de Voz:** A função `selecionarMelhorVozMasculina()` filtra a lista `window.speechSynthesis.getVoices()` das vozes instaladas no cliente. Em navegadores que possuem vozes neurais instaladas na nuvem (como Microsoft Edge com vozes naturais), a síntese pode ser processada pelo provedor do navegador. Em sistemas operacionais com vozes locais, o processamento ocorre no próprio hardware da TV.

### 7.2 Natureza do Endpoint Backend `/api/painel/audio`
- **Destino Externo:** O endpoint possui destino fixo hardcoded para o serviço de TTS do Google:
  `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(texto)}`
- **Destino Arbitrário:** **Não é possível.** O código não aceita parâmetros de URL de destino nem realiza redirecionamento arbitrário. Não há vulnerabilidade de SSRF aberto para destinos arbitrários.
- **Ausência de Controles:** O endpoint é público, sem autenticação, sem rate limit e sem restrição de chamador. Qualquer cliente na rede que faça uma requisição HTTP direta com `?texto=...` faz com que o servidor repasse a string (truncada a 200 caracteres) ao Google Translate e salve um cache local em MP3.
- **Risco LGPD Atual:** Como o frontend Conecta não chama essa rota no fluxo padrão da TV, **nomes de pacientes não estão sendo transmitidos pelo Conecta para o Google Translate via `/api/painel/audio`**.

---

## 8. Verificação Administrativa de Grupos AD Pré-Implantação

Com a remoção definitiva do bypass de fallback em `ldapService.js`:
1. **Impacto:** Os usuários `pedro.cesario` e `pedro.davi` não mais recebem perfis administrativos ou assistenciais de forma automática caso o retorno do AD esteja vazio. Ao autenticarem com suas credenciais de rede, se a consulta de grupos não retornar os grupos exigidos, a aplicação responderá com **HTTP 403** (*"Acesso negado: perfil profissional ainda não habilitado para a passagem de plantão"*).
2. **Ação Pré-Deploy:** Antes da publicação desta versão em ambiente de homologação ou produção, o administrador de rede/Active Directory do hospital deve verificar os cadastros institucionais de `pedro.cesario` e `pedro.davi` e **atribuir manualmente os grupos de segurança do AD que correspondam estritamente às suas atribuições aprovadas pela diretoria/governança institucional** (ex: `API_CONECTA_ADMIN`, `API_CONECTA_ASSISTENCIAL_ENF` ou `API_CONECTA_MEDICO`). Não deve haver inclusão automática ou irrestrita de permissões.

---

## 9. Declaração de Integridade e Limites da Auditoria

- [x] **Zero Escritas Externas:** Não foram realizadas operações de escrita em bancos de dados Oracle, Redis, LDAP ou no SQLite corporativo.
- [x] **Zero Chamadas Externas em Testes:** Nenhum tráfego foi disparado para servidores externos de autenticação ou síntese de voz durante a execução dos testes unitários.
- [x] **Ambiente em Execução Intacto:** Os containers Docker `conecta-modular-node` e `conecta-modular-redis` não foram reiniciados nem recriados.
- [x] **Preservação do Repositório:** Todas as alterações preexistentes na árvore de trabalho do usuário foram mantidas intactas.
- [x] **Sem Falsas Promessas:** Registrado com clareza que o frontend não possui alternância dinâmica de status sem recarregamento da tela e que os módulos backend requerem restart do container para assumirem as novas rotas em produção.
