# Relatório de Implementação e Evidências — Etapa 10.1
**Auditoria do Ciclo Administrativo, Padronização de Contratos e Evidências de Teste**

---

## 1. Contrato Administrativo Real e Mutadores

### 1.1. URLs e Métodos no Registro Real das Rotas
Arquivo: `backend/src/modules/admin/routes.js` (montado em `backend/src/routes.js` sob `/admin`, e no servidor sob `/api`):
- `POST /api/admin/relatorios-tasy` -> `adminController.salvarRelatorioTasy`
- `PUT /api/admin/relatorios-tasy/:id/toggle` -> `adminController.toggleRelatorioTasy`
- `DELETE /api/admin/relatorios-tasy/:id` -> `adminController.deletarRelatorioTasy`

### 1.2. Código Real dos Mutadores (`configCache.js`)
Arquivo: `backend/src/core/config/configCache.js`

Cada mutador executa a alteração no SQLite via `run()` e em seguida executa `await load()`, retornando a propriedade `_cacheReloaded`:

```javascript
// backend/src/core/config/configCache.js (linhas 550-596)
async function saveRelatorioTasy(dados) {
  const cd = parseInt(dados.cd_relatorio, 10);
  const nrSeq = parseInt(dados.nr_sequencia, 10);
  if (!cd || !nrSeq || !dados.ds_titulo) {
    throw new Error('Código do relatório, número de sequência e título são obrigatórios');
  }
  const id = dados.id || `rel_${cd}`;
  const icone = dados.icone || 'bi-file-earmark-text';
  const badge = dados.badge || 'Geral';
  const ativo = dados.ativo === 0 ? 0 : 1;
  const ordem = parseInt(dados.ordem, 10) || 0;

  await run(
    `INSERT INTO relatorios_tasy (id, cd_relatorio, nr_sequencia, ds_titulo, icone, badge, ativo, ordem, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       cd_relatorio = excluded.cd_relatorio,
       nr_sequencia = excluded.nr_sequencia,
       ds_titulo = excluded.ds_titulo,
       icone = excluded.icone,
       badge = excluded.badge,
       ativo = excluded.ativo,
       ordem = excluded.ordem,
       updated_at = datetime('now')`,
    [id, cd, nrSeq, dados.ds_titulo, icone, badge, ativo, ordem]
  );
  const cacheReloaded = await load();
  return { id, cd_relatorio: cd, nr_sequencia: nrSeq, ds_titulo: dados.ds_titulo, icone, badge, ativo, ordem, _cacheReloaded: cacheReloaded };
}

async function deleteRelatorioTasy(id) {
  if (!id) throw new Error('ID é obrigatório');
  await run('DELETE FROM relatorios_tasy WHERE id = ?', [id]);
  const cacheReloaded = await load();
  return { success: true, id, _cacheReloaded: cacheReloaded };
}

async function toggleRelatorioTasy(id, ativo) {
  if (!id) throw new Error('ID é obrigatório');
  const val = ativo ? 1 : 0;
  await run("UPDATE relatorios_tasy SET ativo = ?, updated_at = datetime('now') WHERE id = ?", [val, id]);
  const cacheReloaded = await load();
  return { success: true, id, ativo: val, _cacheReloaded: cacheReloaded };
}
```

### 1.3. Outros Consumidores dos Mutadores e Compatibilidade
Auditamos todas as referências aos três mutadores no repositório:
- `backend/test/admin_pilares.test.js`:
  - Linha 34: `const novo = await configCache.saveRelatorioTasy({ ... });`
  - Linha 52: `await configCache.toggleRelatorioTasy(novo.id, 0);`
  - Linha 58: `await configCache.deleteRelatorioTasy(novo.id);`
- **Análise de Compatibilidade:** O teste `admin_pilares.test.js` verifica apenas `novo.id`, `encontrado.ativo` e a presença do registro na lista retornada por `configCache.getRelatoriosTasy(false)`. A adição da propriedade `_cacheReloaded` preservou 100% da assinatura e das propriedades esperadas (`success`, `id`, `ativo`, etc.). O teste executa e passa com 100% de sucesso.

---

## 2. Substituição de HTTP 207 por HTTP 200 com Campos Explícitos

### 2.1. Onde e Quando Foi Feita a Substituição
- **Arquivos Alterados:** `backend/src/modules/admin/adminController.js` e `backend/test/etapa10_admin_catalogo.test.js`.
- **Momento:** Durante a Etapa 10.1 (após auditoria técnica da camada cliente e do protocolo).

### 2.2. Justificativa Técnica
1. **Comportamento do `api.js`:**
   O cliente `frontend/src/core/api.js` executa:
   ```javascript
   const json = await res.json().catch(() => null);
   // ...
   return json;
   ```
   Ele retorna diretamente o corpo JSON desempacotado para quem invocou o método (`api.post`, `api.put`, `api.delete`). O status HTTP numérico (200 ou 207) **não é entregue nem avaliado** pelo script da página `admin.html`.
2. **Inadequação do HTTP 207 (RFC 4918 - WebDAV):**
   O status 207 foi concebido pelo WebDAV para respostas em lote com XML (`<D:multistatus>`). Usá-lo para endpoints REST JSON de recurso individual cria riscos de incompatibilidade com gateways, proxies reversos (ex.: regras corporativas de cache/WAF) e ferramentas de monitoramento HTTP.
3. **Semântica da Operação:**
   Como a gravação física no SQLite foi concluída com sucesso antes da tentativa de recarga, o recurso foi de fato persistido. Responder com HTTP 200 contendo as flags `{ success: true, partialSuccess: true, cacheReloaded: false, message: '...', data: ... }` reflete com precisão o estado: persistido com sucesso, porém degradado na sincronização do cache em memória.
4. **Mensagens Públicas Sanitizadas:**
   Foram eliminados termos internos ("no banco", "configuração não recarregada"). As mensagens públicas adotadas são:
   - Salvar: `'Alteração salva, mas os relatórios estão temporariamente indisponíveis.'`
   - Toggle: `'Status alterado, mas os relatórios estão temporariamente indisponíveis.'`
   - Excluir: `'Relatório excluído, mas os relatórios estão temporariamente indisponíveis.'`

---

## 3. Código Real dos Controllers e Payloads Implementados

Arquivo: `backend/src/modules/admin/adminController.js` (linhas 886-935)

```javascript
async function salvarRelatorioTasy(req, res) {
  try {
    const { id, cd_relatorio, nr_sequencia, ds_titulo, icone, badge, ativo, ordem } = req.body;
    const item = await configCache.saveRelatorioTasy({ id, cd_relatorio, nr_sequencia, ds_titulo, icone, badge, ativo, ordem });
    const { _cacheReloaded, ...data } = item;
    if (_cacheReloaded === false) {
      return res.status(200).json({
        success: true,
        partialSuccess: true,
        cacheReloaded: false,
        message: 'Alteração salva, mas os relatórios estão temporariamente indisponíveis.',
        data
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Admin] Erro ao salvar relatório TASY:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deletarRelatorioTasy(req, res) {
  try {
    const { id } = req.params;
    const result = await configCache.deleteRelatorioTasy(id);
    const { _cacheReloaded, ...data } = result;
    if (_cacheReloaded === false) {
      return res.status(200).json({
        success: true,
        partialSuccess: true,
        cacheReloaded: false,
        message: 'Relatório excluído, mas os relatórios estão temporariamente indisponíveis.',
        data
      });
    }
    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error('[Admin] Erro ao deletar relatório TASY:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function toggleRelatorioTasy(req, res) {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    const result = await configCache.toggleRelatorioTasy(id, ativo);
    const { _cacheReloaded, ...data } = result;
    if (_cacheReloaded === false) {
      return res.status(200).json({
        success: true,
        partialSuccess: true,
        cacheReloaded: false,
        message: 'Status alterado, mas os relatórios estão temporariamente indisponíveis.',
        data
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Admin] Erro ao alterar status do relatório TASY:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
```

### 3.1. Payloads Efetivos por Cenário

| Operação | Cenário | HTTP Status | Payload Efetivo |
| :--- | :--- | :---: | :--- |
| **Salvar** | Sucesso Total | 200 | `{"success": true, "data": { "id": "rel_101", "cd_relatorio": 101, ... }}` |
| **Salvar** | Falha de Banco | 500 | `{"success": false, "message": "Insert Failed"}` |
| **Salvar** | Falha de Recarga | 200 | `{"success": true, "partialSuccess": true, "cacheReloaded": false, "message": "Alteração salva, mas os relatórios estão temporariamente indisponíveis.", "data": { ... }}` |
| **Toggle** | Sucesso Total | 200 | `{"success": true, "data": { "success": true, "id": "rel_101", "ativo": 0 }}` |
| **Toggle** | Falha de Banco | 500 | `{"success": false, "message": "Update Failed"}` |
| **Toggle** | Falha de Recarga | 200 | `{"success": true, "partialSuccess": true, "cacheReloaded": false, "message": "Status alterado, mas os relatórios estão temporariamente indisponíveis.", "data": { ... }}` |
| **Deletar** | Sucesso Total | 200 | `{"success": true, "data": { "id": "rel_101" }}` |
| **Deletar** | Falha de Banco | 500 | `{"success": false, "message": "Delete Failed"}` |
| **Deletar** | Falha de Recarga | 200 | `{"success": true, "partialSuccess": true, "cacheReloaded": false, "message": "Relatório excluído, mas os relatórios estão temporariamente indisponíveis.", "data": { "success": true, "id": "rel_101" }}}` |

---

## 4. Consumo no Frontend (`frontend/admin.html`)

Arquivo: `frontend/admin.html`

### 4.1. Toggle de Ativo/Inativo (linhas 5176-5182)
```javascript
const res = await api.put(`${apiConfig.baseUrl}/admin/relatorios-tasy/${id}/toggle`, { ativo: !ativoAtual });
if (res && res.partialSuccess) {
  showToast(res.message, 'warning');
} else {
  showToast('Status do relatório atualizado', 'success');
}
await loadRelatoriosTasy();
```

### 4.2. Exclusão de Relatório (linhas 5202-5208)
```javascript
const res = await api.delete(`${apiConfig.baseUrl}/admin/relatorios-tasy/${id}`);
if (res && res.partialSuccess) {
  showToast(res.message, 'warning');
} else {
  showToast('Relatório excluído do catálogo', 'success');
}
await loadRelatoriosTasy();
```

### 4.3. Criação / Edição de Relatório (linhas 5275-5283)
```javascript
const res = await api.post(`${apiConfig.baseUrl}/admin/relatorios-tasy`, { ... });
if (res && res.partialSuccess) {
  showToast(res.message, 'warning');
} else {
  showToast('Relatório salvo com sucesso no catálogo!', 'success');
}
document.getElementById('modal-relatorio-tasy').classList.remove('show');
await loadRelatoriosTasy();
```

**Interpretação pelo Frontend:**
- Se `res.partialSuccess` é `true`: o modal fecha, o toast amarelo/alerta (`warning`) exibe a mensagem pública da API sem jargões internos, e o catálogo é recarregado na tela via `loadRelatoriosTasy()`.
- O administrador **não é incentivado a tentar recadastrar** o mesmo registro, prevenindo duplicidade de chave primária.

---

## 5. Provas do Ciclo Real de Recarga e Asserções

### 5.1. Suíte Administrativa e Ciclo de Vida
- **Arquivo:** `backend/test/etapa10_admin_catalogo.test.js`
- **Comando:** `node backend/test/etapa10_admin_catalogo.test.js`
- **Mecanismo:** Testes isolados com dublês controlados para as operações do SQLite e TasyReportsClient.

**Saída e Contagens Reais:**
```text
▶ Etapa 10.1 - Ciclo Real de Recarga e Contrato Administrativo
  ✔ 1. Carga com ID 101 ativo (2.881ms)
  ✔ 2. Falha de recarga causa UNAVAILABLE e listagem/emissão em 503 (1.277956ms)
  ✔ 3. Recuperação com somente ID 202 ativo: ID 101 bloqueado em 403 (zero chamadas Tasy) e ID 202 em 200 (1 chamada Tasy) (0.737938ms)
  ✔ 4. Contrato Administrativo: Salvar/Criar Relatório (Sucesso, Falha de Persistência, Falha de Recarga) (1.440731ms)
  ✔ 5. Contrato Administrativo: Ativar/Desativar Relatório (Sucesso, Falha de Persistência, Falha de Recarga) (1.313928ms)
  ✔ 6. Contrato Administrativo: Excluir Relatório (Sucesso, Falha de Persistência, Falha de Recarga) (1.188045ms)
✔ Etapa 10.1 - Ciclo Real de Recarga e Contrato Administrativo (10.228089ms)
ℹ tests 6
ℹ suites 1
ℹ pass 6
ℹ fail 0
```

**Asserções Específicas Comprovadas:**
1. **ID 101 ativo:** `load()` retorna `true`, `getRelatoriosTasyState()` é `'AVAILABLE'`. Emissão do relatório 101 retorna HTTP 200 e executa **exatamente 1 chamada simulada ao Tasy**.
2. **Falha de recarga:** `load()` retorna `false`, `getRelatoriosTasyState()` torna-se `'UNAVAILABLE'`. Tentativa de emissão retorna HTTP 503 e executa **zero chamadas ao Tasy**.
3. **Recuperação com ID 202 ativo:**
   - Requisição para ID 101 retorna HTTP 403 e executa **zero chamadas ao Tasy** (comprovando revogação sem vazamento de requisição externa).
   - Requisição para ID 202 retorna HTTP 200 e executa **exatamente 1 chamada ao Tasy**.
4. **Três operações administrativas (Salvar, Toggle, Excluir):**
   - Falha de persistência gera HTTP 500.
   - Sucesso de persistência e recarga gera HTTP 200 com `partialSuccess: undefined`.
   - Persistência com falha de recarga gera HTTP 200 com `partialSuccess: true`, `cacheReloaded: false` e catálogo em `UNAVAILABLE`.

### 5.2. Suíte do Piloto Dashboard (Detalhes da Internação)
- **Arquivo 1:** `backend/test/etapa09_piloto_detalhes.test.js`
  - **Comando:** `node backend/test/etapa09_piloto_detalhes.test.js`
  - **Resultado:** 7 testes executados, 7 aprovados (0 falhas).
  - **Comprova:** Ciclo de conexões Oracle: aquisição falha não tenta fechar conexão; falha na query fecha conexão e propaga erro da query; falha no close propaga erro de fechamento quando a query foi bem-sucedida; falha dupla preserva erro da consulta e loga fechamento.
- **Arquivo 2:** `backend/test/etapa09_2_piloto.test.js`
  - **Comando:** `node backend/test/etapa09_2_piloto.test.js`
  - **Resultado:** 5 testes executados, 5 aprovados (0 falhas).
  - **Comprova:** Validação prévia de `nrAtendimento` via `ValidationError` retornando HTTP 400 sem consultar Oracle para espaços (`" 123"`, `"123 "`, `"1 23"`), texto, negativo, decimais e overflow; HTTP 401 e 403 antes do service; HTTP 404 preservado na semântica de zeros à esquerda (`"00123"`); HTTP 500 sanitizado em produção sem stack trace.

---

## 6. Declaração de Limitações e Rastreabilidade

1. **Limitação de Interface:** O comportamento do frontend (`admin.html`) foi aferido exclusivamente por inspeção estática do código-fonte e análise lógica de eventos DOM. O repositório não dispõe de framework de testes automatizados E2E (como Cypress ou Playwright).
2. **Limitação de Infraestrutura:** Todos os testes foram executados com dublês/mocks em memória. Nenhuma base Oracle, LDAP, Redis ou arquivo SQLite em disco de produção foi acessado ou modificado.
3. **Status de Homologação:** A homologação funcional integrada em ambiente real de homologação/produção permanece **pendente**.
4. **Patches Reversos (Dry-Run):** Os arquivos alterados nas Etapas 10 e 10.1 possuem snapshots salvos em `/home/sdk2/.gemini/antigravity-cli/scratch/pre_lote_10_1/` e patches testados via `patch -p0 -R --dry-run` com código de retorno `0`. Nenhum rollback físico foi aplicado.
