# Padrão de Engenharia de Backend — Conecta Modular

Este documento consolida as diretrizes arquiteturais, convenções de implementação, tratamento de erros, ciclo de conexões e padrões de testes estabelecidos a partir de fluxos auditados documentalmente e testados de forma isolada, com homologação integrada pendente (Etapas 04 a 10.2).

---

## 1. Separação de Responsabilidades por Camada

A arquitetura de referência proposta para o backend do Conecta Modular adota a divisão conceitual em camadas, separando o tratamento HTTP, as regras de negócio e o acesso físico aos dados:

```
[ ROTA / MIDDLEWARES ] ──> [ CONTROLLER ] ──> [ SERVICE ] ──> [ REPOSITORY / CLIENT ]
   Autenticação               Validação Early    Regras de        Acesso a Dados (Oracle, SQLite)
   Autorização                Envelope HTTP      Negócio          Chamadas HTTP Externas (Tasy)
                              next(err)
```

> **Atenção (Estado Atual vs. Padrão Proposto):**
> Esta estrutura de quatro camadas representa a **meta arquitetural proposta para migração**. Nem todos os módulos legados possuem essas quatro camadas separadas (muitos módulos legados agrupam lógica no controller ou acessam o banco diretamente sem repository). Não se deve criar arquivos intermediários desnecessários (ex.: repositories vazios) onde um fluxo simples não o justifique.

### 1.1. Rota (`routes.js` de módulo)
- **Papel:** Declaração de caminhos HTTP e acoplamento de middlewares transversais (`requireAuth`, `requireAdmin`, `requirePermission`).
- **Regra:** Nenhuma lógica de negócio, query SQL ou transformação de payload na rota.
- **Exemplo Real:** `backend/src/modules/admin/routes.js`:
  ```javascript
  router.get('/relatorios-tasy', requireAuth, requireAdmin, adminController.listarRelatoriosTasy);
  router.post('/relatorios-tasy', requireAuth, requireAdmin, adminController.salvarRelatorioTasy);
  router.put('/relatorios-tasy/:id/toggle', requireAuth, requireAdmin, adminController.toggleRelatorioTasy);
  router.delete('/relatorios-tasy/:id', requireAuth, requireAdmin, adminController.deletarRelatorioTasy);
  ```

### 1.2. Controller (`*Controller.js`)
- **Papel:** Ponto de entrada HTTP do fluxo:
  1. Verifica contexto de sessão quando necessário.
  2. Valida parâmetros e corpo da requisição (*Fail Fast*) antes de acionar serviços ou bancos.
  3. Despacha erros de validação via `next(new ValidationError(...))`.
  4. Encapsula respostas no envelope padronizado `{ success: true, data: ... }`.
  5. Retorna status e flags explícitas para resultados parciais (ex.: persistência realizada com falha de recarga do cache).
  6. Encaminha exceções não tratadas ao middleware global via `next(err)`.
- **Regra:** Não executar queries SQL nem acoplar chamadas de rede externas diretamente no controller.
- **Exemplo Real:** `backend/src/modules/dashboard/dashboardController.js` (`obterDetalhesInternacao`).

### 1.3. Service (`*Service.js`)
- **Papel:** Centralização das regras de negócio, validações de domínio e orquestração.
  1. Aplica filtros semânticos, transformações de dados e checagens de negócio.
  2. Lança erros semânticos tipados (`NotFoundError`, `ForbiddenError`, `AppError`).
  3. Não manipula objetos específicos do Express (`req`, `res`, `next`).
- **Exemplo Real:** `backend/src/modules/dashboard/dashboardService.js` (`listarDetalhesInternacao`).

### 1.4. Repository / Client (`*Repository.js`, `*Client.js`)
- **Papel:** Integração física com bases de dados e serviços legados.
  1. Conexões Oracle (via `database.getConnection()`).
  2. Persistência local SQLite (via `configCache.js`).
  3. Chamadas SOAP/HTTP a serviços legados (`tasyReportsClient.js`).
  4. Garantia estrita de liberação de recursos (`finally { if (conn) await conn.close(); }`).

---

## 2. Validação Prévia (*Fail Fast* sem Carga Externa)

Antes de qualquer aquisição de conexão ao banco de dados ou requisição externa, os parâmetros de entrada devem ser validados na camada controladora:

- **Exemplo de Parâmetro Numérico de Rota (`nrAtendimento`):**
  Identificadores numéricos específicos devem exigir dígitos estritos e integridade segura:
  ```javascript
  // Exemplo real em backend/src/modules/dashboard/dashboardController.js
  const { nrAtendimento } = req.params;
  const nrStr = String(nrAtendimento || '');

  if (!/^\d+$/.test(nrStr)) {
    return next(new ValidationError('Número de atendimento inválido'));
  }

  const nrNum = Number(nrStr);
  if (!Number.isSafeInteger(nrNum) || nrNum <= 0) {
    return next(new ValidationError('Número de atendimento inválido ou fora dos limites'));
  }
  ```
- **Outros Parâmetros de Domínio:**
  Parâmetros textuais, datas ISO, UUIDs ou enums (como `'aceitar'` / `'recusar'`) devem seguir a especificação de seu próprio contrato e domínio, sem aplicar cegamente a regex de inteiros.
- **Semântica Preservada dos Zeros à Esquerda:**
  Em identificadores numéricos que trafegam como string (ex.: `"00123"`), a validação estrutural (`^\d+$`) aceita a cadeia. Contudo, na comparação histórica do serviço (`String(r.NR_ATENDIMENTO) === String(nrAtendimento)`), o campo numérico retornado pelo driver Oracle (`123`) não coincide (`"123" !== "00123"`), resultando legitimamente em HTTP 404 (`NotFoundError`), preservando a semântica legada sem mascarar dados.

---

## 3. Autenticação e Autorização Efetivamente Aplicadas

O Conecta Modular opera com autenticação de sessão centralizada e autorização em camadas:

1. **Autenticação Geral (`requireAuth`):**
   - Arquivo: `backend/src/core/middlewares/authMiddleware.js`.
   - Verifica `req.session?.usuario`. Rejeita ausência com HTTP 401: `{ success: false, message: 'Sessão expirada. Faça login novamente.' }`.
2. **Autorização Administrativa (`requireAdmin`):**
   - Arquivo: `backend/src/core/middlewares/authMiddleware.js`.
   - Verifica se o grupo administrativo (`ADMIN_AD_GROUP`, default `'API_CONECTA_ADMIN'`) está presente em `req.session.usuario.grupos_ad`. Rejeita com HTTP 403: `{ success: false, message: 'Acesso restrito a administradores.' }`.
3. **Autorização por Módulo e Permissão (`requirePermission`):**
   - Arquivo: `backend/src/core/middlewares/authMiddleware.js`.
   - Assinatura: `requirePermission(modulos, permissao = null)`.
   - Não lê arrays arbitrários da sessão diretamente; delega para `validarModuloPermissao(usuario, moduloId, permissao)` em `backend/src/core/utils/acesso.js`.
   - Avalia:
     1. Perfil ativo do usuário (`getPerfilAtivo(usuario)`).
     2. Acesso do perfil ao módulo (`configCache.perfilTemAcessoModulo(perfilAtivo, moduloId)`).
     3. Caso exigida permissão específica: libera se for perfil `admin` ou `usuario.is_admin`; caso contrário, valida `configCache.perfilTemPermissao(perfilAtivo, moduloId, permissao)`.
   - Rejeita com HTTP 403: `{ success: false, message: 'Acesso negado: seu perfil não possui autorização para a operação exigida.' }`.
4. **Autorização Setorial (Contextual):**
   - Para fluxos que restringem visualização por setor (ex.: Passagem de Plantão), utiliza `configCache.perfilPodeVisualizarSetor(perfilId, cdSetor, moduloId)`.

---

## 4. Hierarquia de Erros e Middleware Global

### 4.1. Classes de Erro (`AppError.js`)
Arquivo: `backend/src/core/errors/AppError.js`

| Classe | Assinatura | Status HTTP | Código Padrão | Descrição |
| :--- | :--- | :---: | :--- | :--- |
| `AppError` | `(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null)` | 500 (def) | `INTERNAL_ERROR` | Base operacional genérica |
| `ValidationError` | `(message = 'Dados inválidos', details = null)` | 400 | `VALIDATION_ERROR` | Parâmetros ou corpo inválidos |
| `UnauthorizedError` | `(message = 'Não autenticado ou sessão expirada')` | 401 | `UNAUTHORIZED` | Sessão ausente/expirada |
| `ForbiddenError` | `(message = 'Acesso não permitido para este recurso')` | 403 | `FORBIDDEN` | Restrição de perfil/permissão |
| `NotFoundError` | `(message = 'Recurso não encontrado')` | 404 | `NOT_FOUND` | Registro inexistente |
| `ConflictError` | `(message = 'Conflito de dados')` | 409 | `CONFLICT` | Chave duplicada / colisão |
| `DatabaseError` | `(message = 'Erro na operação do banco de dados', details = null)` | 500 | `DATABASE_ERROR` | Falha grave de persistência/query |

Todas as classes estendem `AppError`, marcando `this.isOperational = true`.

### 4.2. Middleware Global (`errorHandler.js`)
Arquivo: `backend/src/core/middlewares/errorHandler.js`

- **Erros `AppError`:** Retorna o status HTTP definido (`err.statusCode`), envelope com `code`, `message` e `details`. Registra log de erro quando `statusCode >= 500`.
- **Erros de Sintaxe JSON:** Captura `SyntaxError` com status 400 (`'JSON mal formatado no corpo da requisição'`).
- **Compatibilidade com Erros Legados:** Reconhece propriedades `status`/`statusCode` em objetos `Error` nativos (faixa 400-499).
- **Sanitização por Ambiente (Erros Não Tratados / 500):**
  - **Desenvolvimento (`NODE_ENV === 'development'`):** Exibe a mensagem real do erro (`err.message`) e a stack trace (`err.stack`).
  - **Produção / Outros Ambientes:** Sanitiza a mensagem para `"Erro interno do servidor"`, com código `"INTERNAL_SERVER_ERROR"` e `stack: undefined`, prevenindo vazamento de dados internos ou SQL.

---

## 5. Contratos de Resposta da API

### 5.1. Sucesso Completo (HTTP 200)
A operação solicitada foi integralmente executada e sincronizada.
Exemplo esquemático:
```json
{
  "success": true,
  "data": {
    "id": 123
  }
}
```

### 5.2. Erro Operacional (HTTP 4xx / 500)
Indica que a requisição não atingiu o objetivo esperado.
> **Importante:** Em operações distribuídas ou compostas sem transação atômica entre sistemas distintos, um erro de resposta pode ocorrer após efeitos parciais (ex.: registro salvo no banco local, mas falha ao notificar serviço externo). O contrato de cada operação deve documentar o estado de persistência alcançado.

Exemplo esquemático:
```json
{
  "success": false,
  "message": "Número de atendimento inválido",
  "requestId": "req_abc123",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Número de atendimento inválido",
    "details": null
  }
}
```

### 5.3. Resultado Parcial (HTTP 200 com Flags Explícitas)
Aplicado em operações compostas onde a persistência relacional principal foi concluída com sucesso, mas a etapa subsequente de sincronização (ex.: recarga do cache em memória) falhou.

Exemplo esquemático:
```json
{
  "success": true,
  "partialSuccess": true,
  "cacheReloaded": false,
  "message": "Alteração salva, mas os relatórios estão temporariamente indisponíveis.",
  "data": {
    "id": "rel_101"
  }
}
```
**Justificativa Técnica:**
- Mantém o status HTTP 200 compatível com clientes REST e com o cliente `frontend/src/core/api.js`.
- Evita o uso de HTTP 207 (WebDAV RFC 4918), que não é canônico para REST JSON de recurso individual e pode ser mal interpretado por proxies e ferramentas de observabilidade.
- Evita falsos erros 500 que induziriam o administrador a tentar criar o registro novamente, causando erro de chave duplicada.
- Informa o estado degradado via payload e protege os endpoints operacionais dependentes com HTTP 503 (`UNAVAILABLE`).

---

## 6. Rastreabilidade com `requestId`

- **Origem:** Gerado no middleware `correlationIdMiddleware` (`backend/src/core/middlewares/correlationIdMiddleware.js`), lendo o cabeçalho `X-Request-Id` recebido ou gerando um UUID via `crypto.randomUUID()`.
- **Propagação:** Anexado ao objeto `req.requestId` e refletido no cabeçalho de resposta `X-Request-Id`.
- **Consumo no Frontend:** O cliente `frontend/src/core/api.js` gera o cabeçalho e associa o `requestId` da resposta às estruturas de erro e retorno.
- **Cobertura de Logs e Exceções:**
  - O logger estruturado (`backend/src/core/utils/logger.js`) e o `errorHandler.js` incluem o `requestId` nos logs formatados.
  - **Exceção Conhecida:** Logs legados em controllers e repositories que chamam `console.log` ou `console.error` diretamente **não** contêm o `requestId`. A migração gradual para `logger.*` é necessária nesses pontos.

---

## 7. Ciclo de Vida de Conexões Oracle (Prevenção de Falhas de Liberação)

A aquisição e tentativa de liberação de conexões do pool Oracle deve assegurar que a causa primária de falha da consulta seja preservada:

```javascript
// Exemplo canônico em backend/src/modules/dashboard/dashboardRepository.js
let conn;
let execError = null;

try {
  conn = await database.getConnection();
  const result = await conn.execute(query, binds);
  return result.rows;
} catch (err) {
  execError = err;
  throw err; // Preserva o erro original da execução SQL
} finally {
  if (conn) {
    try {
      await conn.close();
    } catch (closeErr) {
      if (!execError) {
        // Se a consulta teve sucesso mas o fechamento falhou, propaga o erro de close
        throw closeErr;
      }
      // Se a consulta já falhou, registra a falha na tentativa de close sem mascarar a query
      console.error('[Oracle] Erro na tentativa de fechar conexão após falha de execução:', closeErr.message);
    }
  }
}
```

> **Distinção Importante:** A falha no método `conn.close()` representa uma **falha na tentativa de fechamento** (que pode decorrer de encerramento prematuro de socket pelo banco, timeout ou descarte pelo driver). Ela não constitui, isoladamente, prova conclusiva de vazamento persistente no pool, devendo ser monitorada via telemetria do pool (`getPoolStats`).

---

## 8. Persistência e Sincronização de Cache

Operações de escrita no catálogo e configurações administrativas em `configCache.js` executam duas fases distintas:
1. **Persistência Relacional:** `INSERT / UPDATE / DELETE` no SQLite via `run()`.
2. **Sincronização em Memória:** Chamada a `load()`, que reconstrói os objetos em memória e atualiza `relatoriosTasyDisponivel`.

**Matriz de Comportamento:**
- **Fase 1 falha:** O erro do SQLite é lançado, a transação/operação aborta; o controller responde HTTP 500. Nenhuma alteração foi persistida.
- **Fase 1 OK + Fase 2 OK:** `load()` retorna `true`, `_cacheReloaded = true`. Resposta HTTP 200 de sucesso integral.
- **Fase 1 OK + Fase 2 Falha:** `load()` retorna `false`, `_cacheReloaded = false`, estado do catálogo torna-se `UNAVAILABLE`. Resposta HTTP 200 com `partialSuccess: true` e mensagem de advertência.

---

## 9. Diretrizes para Testes Isolados

Os testes automatizados devem validar contratos de integração sem comprometer ambientes reais:

1. **Proporcionalidade das Asserções:**
   - Testes de HTTP 404 e validação de formato aplicam-se a rotas que recebem parâmetros dinâmicos ou recursos consultáveis. Rotas sem parâmetros (ex.: listagens globais) não devem receber asserções artificiais de 404.
2. **Isolamento de Infraestrutura (Cuidado com Construtor SQLite):**
   - Mocks de `prototype.all` e `prototype.run` não impedem que `new sqlite3.Database(dbPath)` tente abrir o arquivo físico em disco no momento da instanciação.
   - O isolamento estrito deve aplicar mocks **antes** da importação dos módulos que instanciam o banco, interceptar o próprio construtor `sqlite3.Database`, ou direcionar a conexão para `:memory:` / arquivo temporário isolado.
3. **Dublês de Serviços Externos:**
   - Dublês para `database.getConnection` devem simular aquisição, execução e close, aferindo contagens exatas de conexões.
   - Chamadas HTTP a serviços externos (ex.: `tasyReportsClient.gerarRelatorioPdf`) devem ser simuladas sem tráfego de rede real.

---

## 10. Mapeamento de Status do Backend

### 10.1. Fluxos Auditados Documentalmente e Testados de Forma Isolada
- **Recepção:**
  - `GET /api/recepcao/relatorios`
  - `GET /api/recepcao/relatorios/:id/gerar` (atenção ao plural `relatorios`)
- **Dashboard (Piloto):**
  - `GET /api/dashboard/internacao/detalhes/:nrAtendimento`
- **Administração:**
  - `GET /api/admin/relatorios-tasy`
  - `POST /api/admin/relatorios-tasy`
  - `PUT /api/admin/relatorios-tasy/:id/toggle`
  - `DELETE /api/admin/relatorios-tasy/:id`

### 10.2. Fluxos Candidatos para Próximas Migrações
- `POST /api/dashboard/pacientes-setor/:cd_setor` (registrado como método `POST` em `backend/src/routes.js:58`)
- `GET /api/pacientes-setor/:cd_setor` (registrado como método `GET` em `backend/src/routes.js:57`)
- `GET /api/dashboard/internacao`
- `POST /api/dashboard/internacao/acao`
- Demais módulos: `ocorrencias`, `escalas`, `registros`, `auditorias`, `painel`, `setores`, `usuarios`.

### 10.3. Exceções e Pendências Conhecidas
- Controladores legados ainda utilizam tratamento local com `res.status(err.status || 500).json(...)` em vez de delegar para `next(err)`.
- Ausência de validação estruturada com `ValidationError` em parâmetros de rotas legadas.
- Endpoints de painéis de TV e guichês no Admin não possuem separação entre persistência e recarga do cache.
- Logs com `console.error` direto sem enriquecimento com `requestId`.
