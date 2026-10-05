# IMPLEMENTACAO_CONECTA_09_PILOTO_DETALHES_DASHBOARD.md

## 1. O Problema e o Comportamento Resultante
O fluxo analítico `GET /api/dashboard/internacao/detalhes/:nrAtendimento` operava sem validação de tipos de dados. Os parâmetros repassados pela URI transitavam diretamente do *Controller* para o motor SQL em formato bruto de String. 
- O *Repository* executava `.execute` e, dentro do `finally`, processava um fechamento desprotegido (`await conn.close()`). Se o serviço do banco falhasse simultaneamente na consulta e no fechamento, a exceção lançada seria sobre a falha do *close*, ocultando completamente o *root cause* inicial (ex: timeout de query).
- O *Service* disparava `new Error()` manual assinalando `status = 404`, cujo bloco catch do *Controller* formatava num HTTP 500 padronizado estaticamente (`res.status(err.status || 500)`), perdendo os metadados contextuais do interceptador global (incluindo o `requestId`).

## 2. Implementação com Alterações Mínimas
A aplicação adotou o padrão de responsabilidade corporativa mantendo os contratos atuais:
- **`dashboardController.js`**: Rejeita parâmetros inseguros prematuramente (`HTTP 400`). A validação permite apenas inteiros positivos seguros (Regex de numéricos + `Number.isSafeInteger`). Adota o `next(err)` em substituição da formação de payload local.
- **`dashboardService.js`**: Substituiu o erro empacotado localmente pela instância global `NotFoundError` nativa do repositório, garantindo metadados adequados para o `errorHandler.js`.
- **`dashboardRepository.js`**: Incorporou as diretivas corretas de encerramento (`try { await conn.close() } catch(errClose) { log }`) aos métodos `findPacientesIndicacaoInternacao`, `findPacientesDecididos` e `findDetalhesInternacao`.

**Diferencial de Retorno de Contratos:**
**ANTES (404/Not Found)**:
```json
{
  "success": false,
  "message": "Paciente não encontrado na lista de indicação de internação"
}
```
**DEPOIS (404 Integrado com ErrorHandler)** *(A compatibilidade de sucesso/falha do Front-end é 100% mantida e estendida):*
```json
{
  "success": false,
  "message": "Paciente não encontrado na lista de indicação de internação",
  "requestId": "req-id-uuid-1234",
  "error": {
    "code": "NOT_FOUND",
    "message": "Paciente não encontrado na lista de indicação de internação",
    "details": null
  }
}
```

## 3. Evidências dos Testes Isolados
A padronização foi testada integralmente no NodeJS sem acessar o Tasy/Oracle reais, injetando *mocks* do pacote `database.getConnection` (0 aquisições e 0 execuções do DB foram registradas em falhas de validação).

**Comando**: `node backend/test/etapa09_piloto_detalhes.test.js`
**Saída Resumida**:
```
▶ Etapa 09 - Piloto Dashboard Detalhes
  ✔ 1. Rejeita parâmetros inválidos com 400 e 0 chamadas ao Oracle
  ✔ 2. Aceita zeros à esquerda e executa com sucesso
  ✔ 3. Retorna 404 padronizado para paciente não encontrado
  ✔ 4. Retorna 500 mascarado em falha de repositório
  ✔ 5. Falha de close não derruba aplicação e propaga erro original
✔ Etapa 09 - Piloto Dashboard Detalhes
ℹ tests 5 | pass 5 | fail 0 | duration_ms 18.72
```

## 4. Evidências Retroativas e Pendências do Catálogo (Etapa 07.*)
Cumprindo a instrução estrita documental, executei os arquivos das Etapas Lote 2C individualmente. A concorrência comprova que o estado da recarga gerencia o "ID Antigo x ID Novo".
**Comandos Executados**:
```bash
node backend/test/etapa07_lote2c.test.js
node backend/test/etapa07_1_fechamento.test.js
node backend/test/etapa07_2_aceite.test.js
node backend/test/etapa07_3_evidencias.test.js
node backend/test/etapa07_3_concurrency.test.js
```
**Saída da Concorrência** (Evidência da disponibilidade / recuperação com ids válidos descartando antigos):
```
▶ Etapa 07.3 - Ciclo de Vida e Concorrência Real
  ✔ 1. Consulta ocorrendo durante recarga preserva o estado anterior intacto
  ✔ 2. Recarga falha, estado cai; Próxima recarga sucesso, estado sobe
ℹ tests 2 | pass 2 | duration_ms 85.40
```

> ⚠️ **PENDÊNCIA ADMINISTRATIVA IDENTIFICADA:** No fluxo de criação do catálogo (Admin), a requisição ao Oracle para persistir os relatórios ocorre normalmente. Todavia, se a função `load()` do cache SQLite subsequente falhar (por ex., SQLite Busy), o administrador visualizará um aviso de sucesso, mas o cache do app mudará instantaneamente para `UNAVAILABLE` bloqueando as emissões médicas para prevenir vazamentos. O fluxo de retornos em ambiente gerencial precisa ser ajustado na interface futuramente para revelar esse erro secundário de `load()`. Não será atribuída essa deficiência de tela a uma decisão institucional da Diretoria sem validações da engenharia.

## 5. Entrega e Procedimentos de Rollback
O estado prévio foi engarrafado garantindo a proteção e a perenidade das funcionalidades do *Dashboard*. O projeto segue sem declaração de "homologação total", restrita unicamente a este circuito validado.

**Artefatos Temporários Salvos:**
- `/home/sdk2/.gemini/antigravity-cli/scratch/pre_lote_09/`

**Validação de Retrocesso (Reverse Patch):**
```bash
$ patch -p0 -R --dry-run < ~/.gemini/antigravity-cli/scratch/pre_lote_09/etapa09_piloto.patch
Ignoring potentially dangerous file name /home/sdk2/.../dashboardController.js
checking file backend/src/modules/dashboard/dashboardController.js
Ignoring potentially dangerous file name /home/sdk2/.../dashboardRepository.js
checking file backend/src/modules/dashboard/dashboardRepository.js
Ignoring potentially dangerous file name /home/sdk2/.../dashboardService.js
checking file backend/src/modules/dashboard/dashboardService.js
```
**Código de Saída:** `0` (Success). O Rollback isolado deste piloto isolado pode ser integralmente recuperado do Patch gerado. Nenhuma técnica destrutiva como Reset ou Checkout no Git será necessária.
