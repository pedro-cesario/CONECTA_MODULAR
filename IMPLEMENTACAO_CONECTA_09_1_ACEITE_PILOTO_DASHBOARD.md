# IMPLEMENTACAO_CONECTA_09_1_ACEITE_PILOTO_DASHBOARD.md

## 1. Implementação Real e Contratos (Dashboard)

A correção histórica aplica-se: na versão original, o catch do Controller com `res.status(err.status || 500)` já *preservava* o HTTP 404 estipulado manualmente pelo *Service*, mas falhava em formatá-lo sob o envelope oficial corporativo (`AppError`), descartando o rastreio do Request ID e acoplando lógicas parciais em cada serviço. 

### Validação Comprovada e Zeros à Esquerda
O `nrAtendimento` recebido no endpoint é filtrado puramente como *string*:
```javascript
const nrStr = String(nrAtendimento || '').trim();
if (!/^\d+$/.test(nrStr)) { /*...*/ }
const nrNum = Number(nrStr);
if (!Number.isSafeInteger(nrNum) || nrNum <= 0) { /*...*/ }
```
Dessa forma, rejeita decimais, exponenciais (`1e5`), notações vazias e overflows (como `9007199254740992`). Mais importante: o valor `nrStr` (por exemplo `'00123'`) flui intacto até o Service, garantindo a compatibilidade restrita com o comportamento original onde `String(r.NR_ATENDIMENTO) === String(nrAtendimento)` ocorre preservando preenchimentos fixos, sem conversão parcial falha (como faria um `parseInt` cego).

**Exemplo Fictício de Sucesso (Preservado)**:
```json
{
  "success": true,
  "data": {
    "nr_atendimento": "123",
    "nome": "João da Silva",
    "resultado": { "campo_1": "OK" }
  }
}
```

**Exemplo de Erro (Antes vs Depois)**:
*Antes*: `{ "success": false, "message": "Paciente não encontrado..." }` (com HTTP 404).
*Depois*: 
```json
{
  "success": false,
  "message": "Paciente não encontrado na lista de indicação de internação",
  "requestId": "test-req-id-123",
  "error": {
    "code": "NOT_FOUND",
    "message": "Paciente não encontrado na lista de indicação de internação",
    "details": null
  }
}
```
O `requestId` é herdado do `req.requestId` alimentado nativamente no Express pelo `correlationIdMiddleware`. O Frontend consome `result.success` e lança `throw new Error(result.message)`. Compatibilidade: **100%**.

---

## 2. Padrão Seguro de Conexões Oracle (Correção 09.1)
Foi provado e corrigido um defeito residual herdado no encerramento (`finally`). As funções `findPacientesIndicacaoInternacao`, `findPacientesDecididos` e `findDetalhesInternacao` passaram a adotar a mesma sintaxe de salvaguarda da Etapa 04:
```javascript
  const conn = await getConnection();
  let execErr = null;
  let result;
  try {
    result = await conn.execute( /* ... */ );
  } catch (err) {
    execErr = err;
  } finally {
    if (conn) {
      try { await conn.close(); } 
      catch (closeErr) {
        console.error('[Dashboard] Erro ao fechar conexão Oracle:', closeErr.message);
        if (!execErr) throw closeErr; // Se a execução foi um SUCESSO, o erro de close deve subir.
      }
    }
    if (execErr) throw execErr; // Se a execução FALHOU, ela sobrepõe o erro de close logado.
  }
```

---

## 3. Evidência dos Testes (Cadeia Isolada)

Foi desenvolvido um executor Express isolado (`runExpress`) injetando os mocks de dependência e testando todos os limites de conexão e validação. O Service nunca é acionado sob parâmetros incorretos:

```bash
$ node backend/test/etapa09_piloto_detalhes.test.js
▶ Etapa 09.1 - Piloto Dashboard Detalhes (Ciclo de Vida de Conexões)
  ✔ 1. Rejeita parâmetros inválidos com 400 (Zero Aquisições/Execuções)
  ✔ 2. Aceita zeros à esquerda e executa sucesso preservando contrato
  ✔ 3. Retorna 404 padronizado para paciente não encontrado
  ✔ 4. Falha de Aquisição: Não tenta fechar conexão inexistente
  ✔ 5. Falha de Execução + Close Funciona: Propaga erro de execução
  ✔ 6. Execução Funciona + Close Falha: Propaga erro de fechamento
  ✔ 7. Falha de Execução + Close Falha: Preserva erro da consulta e loga close
ℹ tests 7 | pass 7 | duration_ms 14.91
```

---

## 4. Evidências do Catálogo (SQLite e Ciclo de Vida)
O armazenamento oficial do Catálogo é hospedado no **SQLite** (`relatorios_tasy`), e não no Oracle como inferido em descrições textuais prematuras (Apenas a *emissão real* do relatório se comunica indiretamente com Oracle/TasyReports, mas a gestão do Catálogo é local SQLite).

### Pendência Administrativa (Não Corrigida Nesta Rodada):
> "Cadastro pode ter sido persistido no SQLite, mas a recarga (SQLite -> Memória/App) falhou. O administrador recebe tela de sucesso na API (HTTP 200 via adminController), sem indicação da indisponibilidade fatal."

A suíte executada em Node comprova (na trilha `etapa07_3_concurrency.test.js`) que, quando um ID antigo sofre revogação, sua busca retorna a classe correta configurada (`ForbiddenError`), blindando vazamentos:
```javascript
// Asserção da prova (Arquivo 07.3):
const rejectRes = await invokeEmissao('velho_id');
assert.strictEqual(rejectRes.status, 403);
```

---

## 5. Rastreabilidade e Snapshot

O diff exclusivo desta etapa encontra-se armazenado para fins de garantia na pasta provisória:
- **Snapshot Path**: `/home/sdk2/.gemini/antigravity-cli/scratch/pre_lote_09_1`

Abaixo a prova da eficácia estrutural do *Patch Reverso*, validando a integridade do código servido sem a necessidade de comandos de descarte via Git:

```bash
$ patch -p0 -R --dry-run < scratch/pre_lote_09_1/etapa09_1_dashboardRepository.patch
Ignoring potentially dangerous file name /home/sdk2/.../dashboardRepository.js
checking file backend/src/modules/dashboard/dashboardRepository.js
```
**Código de Saída (Exit Status)**: `0` (Dry Run Bem Sucedido). Nenhuma reconstrução fictícia, deploy, e nenhuma alteração nos scripts SQL. O Piloto avança estável.
