# Relatório de Investigação Técnica — Gestão de Acesso / SQLITE_READONLY (HTTP 500)

**Data**: 2026-10-03  
**Incidente**: `POST /api/admin/permissoes` retornando HTTP 500 com `SQLITE_READONLY: attempt to write a readonly database`  
**Status**: Diagnóstico Concluído / Correção de Código Preparada / Mudança Operacional Proposta  
**Arquivo de Teste**: [`backend/test/investigacao_admin_permissoes.test.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/test/investigacao_admin_permissoes.test.js)  

---

## 1. Rastreamento e Diagnóstico da Causa Raiz

### 1.1 Rota, Controller e Camada de Persistência
- **Rota**: [`backend/src/modules/admin/routes.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/admin/routes.js#L14)
  `router.post('/permissoes', requireAuth, requireAdmin, adminController.salvarPermissoesModulo);`
- **Controller**: [`backend/src/modules/admin/adminController.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/admin/adminController.js#L99-L125) (`salvarPermissoesModulo`)
- **Persistência**: [`backend/src/core/config/configCache.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/core/config/configCache.js#L899-L935) (`setProfileAccess`)

### 1.2 Auditoria do Sistema de Arquivos, Permissões e Processos

| Parâmetro Auditado | Valor Constatado | Análise Técnica |
|---|---|---|
| **Caminho Absoluto (Host)** | `/media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite/config.db` | Caminho resolvido via `path.resolve(__dirname, '../../../../auth.sqlite')`. |
| **Caminho Absoluto (Container)** | `/home/node/app/auth.sqlite/config.db` | Montado via volume no Docker (`./auth.sqlite:/home/node/app/auth.sqlite`). |
| **Flags de Abertura SQLite** | `new sqlite3.Database(dbPath)` | Abre com `OPEN_READWRITE \| OPEN_CREATE` (0x6). Se o filesystem negar escrita, SQLite degrada para readonly. |
| **Usuário do Processo da Aplicação** | `matrix` (Host) / `node` (Docker) | **UID = 1000, GID = 1000** |
| **Usuário CLI / Host** | `sdk2` | **UID = 1003, GID = 1004** |
| **Proprietário do Diretório `auth.sqlite`** | `sdk2:sdk2` (1003:1004) | Permissão: `drwxr-xr-x` (**755**). Para UID 1000, é apenas `r-x` (**Sem permissão de escrita**). |
| **Proprietário do Arquivo `config.db`** | `sdk2:sdk2` (1003:1004) | Permissão: `-rw-rw-r--` (**664**). Para UID 1000, é apenas `r--` (**Somente leitura**). |
| **Arquivos Auxiliares (WAL / SHM / Journal)** | Nenhum existente no momento | SQLite necessita criar `config.db-journal` ou `config.db-wal` **no diretório** durante transações. |
| **Bind Mounts / Volumes** | `docker-compose.yml:15` | O volume está montado como leitura/escrita (`rw`), mas as permissões do sistema de arquivos subjacente barram o UID 1000. |

### 1.3 Causa Raiz Comprovada
A base SQLite requer permissão de escrita **não apenas no arquivo `config.db`**, mas também **no diretório pai `auth.sqlite/`** para que o driver SQLite consiga criar arquivos de bloqueio e journal de rollback (`config.db-journal`).

Como o diretório e o arquivo foram alterados para propriedade de `sdk2:sdk2` (UID 1003), o processo Node da aplicação — que executa sob **UID 1000** (`matrix` no host ou `node` dentro do container) — possui apenas permissão de "outros" (`r-x` no diretório e `r--` no arquivo). Ao executar `BEGIN IMMEDIATE TRANSACTION` em `setProfileAccess`, o SQLite é impedido pelo kernel Linux de criar o journal e retorna imediatamente:
```text
SQLITE_READONLY: attempt to write a readonly database
```

---

## 2. Análise Transacional e Efeitos Parciais

O método `setProfileAccess` em [`backend/src/core/config/configCache.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/core/config/configCache.js#L899-L935) opera com transação explícita:
```javascript
async function setProfileAccess(perfilId, moduloIds = [], permissions = {}, setoresPorModulo = {}) {
  await run('BEGIN IMMEDIATE TRANSACTION');
  try {
    await run('DELETE FROM perfil_modulos WHERE perfil_id = ?', [perfilId]);
    await run('DELETE FROM perfil_permissoes WHERE perfil_id = ?', [perfilId]);
    await run('DELETE FROM perfil_modulo_setores WHERE perfil_id = ?', [perfilId]);
    // INSERTs...
    await run('COMMIT');
  } catch (err) {
    try { await run('ROLLBACK'); } catch (_) {}
    throw err;
  }
  await load();
}
```

### Prova de Integridade:
1. O erro `SQLITE_READONLY` ocorre logo no `BEGIN IMMEDIATE TRANSACTION` (ou no primeiro comando de escrita `DELETE`).
2. O bloco `catch` executa a tentativa de `ROLLBACK` e relança o erro.
3. As instruções de escrita subsequentes e o `await load()` **não são executados**.
4. **Zero efeitos parciais**: Nenhuma permissão prévia foi perdida ou parcialmente gravada; o estado do banco e do cache em memória permaneceu 100% íntegro.

---

## 3. Correção de Código (Backend)

Em [`backend/src/modules/admin/adminController.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/src/modules/admin/adminController.js#L121-L127), o tratamento foi aprimorado para não vazar mensagens internas de stack trace, mantendo o log técnico detalhado e informando claramente a indisponibilidade de escrita sem mascarar como sucesso:

```javascript
  } catch (err) {
    console.error('[Admin] Erro ao salvar permissões:', err);
    const isReadonly = err.message && err.message.includes('SQLITE_READONLY');
    const publicMessage = isReadonly
      ? 'Erro ao persistir permissões: base de dados de configuração em modo somente leitura (SQLITE_READONLY).'
      : (err.message || 'Erro ao salvar permissões');
    res.status(500).json({ success: false, message: publicMessage });
  }
```

---

## 4. Proposta de Mudança Operacional (Não Executada nesta Rodada)

Conforme a diretriz de não executar alterações operacionais em ambiente sem autorização expressa, a intervenção operacional necessária é apresentada abaixo:

### 4.1 Diagnóstico do Usuário Alvo
- UID/GID de execução da aplicação: `1000:1000` (`matrix` / `node`).
- Caminho alvo: `/media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite`.

### 4.2 Comandos Propostos para Remediação
```bash
# 1. Ajustar a propriedade do diretório e do banco para o UID do processo da aplicação (1000:1000)
sudo chown -R 1000:1000 /media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite

# 2. Garantir permissões de escrita para o proprietário e grupo, permitindo criação de lock/journal
sudo chmod 775 /media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite
sudo chmod 664 /media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite/config.db
```

### 4.3 Impacto Operacional
- Permite que o container Docker (`node`, UID 1000) e o processo host (`matrix`, UID 1000) consigam abrir transações de escrita e atualizar perfis, permissões e setores sem erro.
- Não afeta a leitura dos dados existentes.
- Não reinicia a máquina nem altera dependências.

### 4.4 Rollback Operacional
Caso seja necessário reverter para a propriedade anterior de `sdk2`:
```bash
sudo chown -R 1003:1004 /media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite
sudo chmod 755 /media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite
sudo chmod 664 /media/SAAS/SAAS/CONECTA_MODULAR/auth.sqlite/config.db
```

---

## 5. Validação Automatizada

Suite de testes dedicada executada:
```bash
node --test backend/test/investigacao_admin_permissoes.test.js
```

Saída:
```text
▶ Incidente 2 — Gestão de Acesso / Diagnóstico POST /api/admin/permissoes (SQLITE_READONLY)
  ▶ 1. Autenticação, Autorização e Validação do Endpoint
    ✔ 1.1 Sessão ausente: deve retornar HTTP 401 Unauthorized (16.728512ms)
    ✔ 1.2 Usuário sem grupo ADMIN (API_CONECTA_ADMIN): deve retornar HTTP 403 Forbidden (3.526139ms)
    ✔ 1.3 Payload inválido (sem perfilId ou modulos não array): deve retornar HTTP 400 Bad Request (2.943773ms)
    ✔ 1.4 Perfil inexistente: deve retornar HTTP 404 Not Found (2.652309ms)
    ✔ 1.5 Módulo passagem sem setores selecionados: deve retornar HTTP 400 Bad Request (2.429647ms)
  ✔ 1. Autenticação, Autorização e Validação do Endpoint (29.333327ms)
  ▶ 2. Diagnóstico de Falha SQLITE_READONLY e Prova de Transação Atômica
    ✔ 2.1 Simulação de SQLITE_READONLY: retorna HTTP 500 com mensagem pública sanitizada e rollback comprovado (4.077616ms)
    ✔ 2.2 Persistência bem-sucedida quando a base é gravável: retorna HTTP 200 OK (2.484816ms)
  ✔ 2. Diagnóstico de Falha SQLITE_READONLY e Prova de Transação Atômica (6.902147ms)
✔ Incidente 2 — Gestão de Acesso / Diagnóstico POST /api/admin/permissoes (SQLITE_READONLY) (56.606483ms)
ℹ tests 7
ℹ suites 3
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 318.106716
```

---

## 6. Diff Exclusivo do Incidente 2

```diff
--- /home/sdk2/.gemini/antigravity-cli/scratch/pre_fechamento_livro_admin_readonly/adminController.js	2026-10-03 20:07:10.347378415 -0300
+++ backend/src/modules/admin/adminController.js	2026-10-03 20:08:32.457957518 -0300
@@ -120,7 +120,11 @@
     res.json({ success: true, message: 'Permissões atualizadas com sucesso' });
   } catch (err) {
     console.error('[Admin] Erro ao salvar permissões:', err);
-    res.status(500).json({ success: false, message: err.message });
+    const isReadonly = err.message && err.message.includes('SQLITE_READONLY');
+    const publicMessage = isReadonly
+      ? 'Erro ao persistir permissões: base de dados de configuração em modo somente leitura (SQLITE_READONLY).'
+      : (err.message || 'Erro ao salvar permissões');
+    res.status(500).json({ success: false, message: publicMessage });
   }
 }
```

### Reverse Dry-Run
```bash
diff -u /home/sdk2/.gemini/antigravity-cli/scratch/pre_fechamento_livro_admin_readonly/adminController.js backend/src/modules/admin/adminController.js | patch -R --dry-run backend/src/modules/admin/adminController.js
# Exit code: 0
```

---

## 7. Registro de Estado da Etapa 11

A **Etapa 11 (Padronização da Leitura de Pacientes por Setor — `POST /api/dashboard/pacientes-setor/:cd_setor`)** permanece **pausada** para priorização dos incidentes operacionais.

### Estado Atual e Pendências:
1. **Alterações realizadas**:
   - Validações de entrada de tipos e integridade do parâmetro `:cd_setor`.
   - Isolamento de erros via `AppError` e `next(err)`.
   - Arquivo de teste prévio criado em [`backend/test/etapa11_pacientes_setor.test.js`](file:///media/SAAS/SAAS/CONECTA_MODULAR/backend/test/etapa11_pacientes_setor.test.js).
2. **Pendências da Etapa 11**:
   - Ajuste fino da asserção de teste unitário do mock do paciente (mapeamento do nome civil vs nome fantasia).
   - Validação integrada da cadeia HTTP com o pipeline Express completo.
   - Emissão do relatório final `IMPLEMENTACAO_CONECTA_11_PACIENTES_POR_SETOR.md`.
