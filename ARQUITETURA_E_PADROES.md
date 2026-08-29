# 📘 Manual de Arquitetura & Padrões de Engenharia — Conecta Assistencial

> **Para todas as IAs e Desenvolvedores:** Este documento é a fonte única da verdade para manutenção, extensão e criação de novas funcionalidades no Conecta Assistencial.

---

## 🏛️ 1. Visão Geral da Arquitetura (ES Modules Nativo)

O frontend do **Conecta Assistencial** foi completamente modularizado no padrão **Enterprise ES Modules (ESM)**. Não existe mais código monolítico nem scripts globais legados.

```
frontend/
├── index.html ──► Carrega unicamente <script type="module" src="src/main.js?v=..."></script>
├── css/
│   ├── style.css (Estilos globais, temas e variáveis)
│   └── modules/ (Estilos dedicados por módulo)
└── src/
    ├── main.js (Ponto de entrada: boot, listeners globais, auth e roteamento)
    ├── core/
    │   ├── api.js (Cliente HTTP: api.get, api.post, api.put, api.delete, CSRF, 401)
    │   ├── auth.js (Sessão, perfis, dropdowns e capabilities)
    │   ├── draft.js (Engine de rascunhos, dirty checking e autosave)
    │   ├── router.js (Workspaces, switcher de modos e topbar dinâmico)
    │   ├── state.js (Single Source of Truth para estado da aplicação)
    │   ├── ui.js (Modais, toasts, rich text editor e sidebar responsiva)
    │   └── utils.js (Debounce, escapeHtml, formatação de datas e ping)
    └── modules/
        ├── auditorias/auditorias.js (Higiene de Mãos e Processos Assistenciais)
        ├── dashboard/dashboard.js (Leitos Internação e Pronto Atendimento)
        ├── escala/escala.js (Grade Semanal e Gestão de Escalas)
        ├── livro/livro.js (Livro Administrativo, Distribuição Técnica, ECT e Impressão)
        ├── passagem/passagem.js (Passagem de Plantão, Lote e Histórico)
        └── registros/registros.js (Busca de Pacientes e Demanda Espontânea)
```

---

## 🔒 2. Regras e Padrões de Ouro para IAs

### 🔴 REGRA 1: Não crie novos monolitos nem arquivos legados
- Nunca crie arquivos soltos em `frontend/js/`.
- Qualquer nova funcionalidade deve pertencer ao `frontend/src/core/` (se for transversal) ou `frontend/src/modules/<modulo>/` (se for de domínio).

### 🔴 REGRA 2: Imports Explícitos e Sem Shadowing
- Ao importar utilitários ou módulos (ex: `import * as draft from '../../core/draft.js'`), **NUNCA** declare parâmetros de função com o mesmo nome (`function restore(draft)` ❌ -> Use `function restore(draftPayload)` ou `draftData` ✅).
- Importe apenas de arquivos relativos com extensão `.js` explícita (ex: `'./api.js'`).

### 🔴 REGRA 3: Gerenciamento de Estado Centralizado (`state.js`)
- Não crie variáveis globais soltas no `window`.
- Todo estado compartilhado reside em `frontend/src/core/state.js` (`state.<propriedade>`).
- O `state` é um objeto reativo acessado por importação direta: `import { state } from '../../core/state.js'`.

### 🔴 REGRA 4: Validação de Sintaxe Obrigatória com AST
Antes de finalizar qualquer alteração em arquivos JavaScript, execute o validador Acorn AST:
```bash
node -e "
const fs = require('fs');
const acorn = require('./node_modules/acorn/dist/acorn.js');
const files = [
  'frontend/src/core/api.js',
  'frontend/src/core/state.js',
  'frontend/src/core/utils.js',
  'frontend/src/core/ui.js',
  'frontend/src/core/auth.js',
  'frontend/src/core/router.js',
  'frontend/src/core/draft.js',
  'frontend/src/modules/passagem/passagem.js',
  'frontend/src/modules/dashboard/dashboard.js',
  'frontend/src/modules/livro/livro.js',
  'frontend/src/modules/escala/escala.js',
  'frontend/src/modules/registros/registros.js',
  'frontend/src/modules/auditorias/auditorias.js',
  'frontend/src/main.js'
];
files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  console.log('✓ ' + f + ' OK');
});
"
```

### 🔴 REGRA 5: Versionamento de Cache no `index.html`
Ao alterar qualquer arquivo dentro de `frontend/src/`, incremente o parâmetro de versão no `frontend/index.html`:
```html
<script type="module" src="src/main.js?v=260"></script>
```

### 🔴 REGRA 6: Conformidade Obrigatória com o Design System Oficial
Toda e qualquer interface, modal, botão, cabeçalho ou estilo deve seguir rigorosamente o manual oficial:
👉 [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)
- **Nunca** invente cores hexadecimais soltas ou inline styles (`style="..."`). Use as variáveis CSS do tema (`--primary`, `--slate-900`, `--green-600`, etc.).
- **Nunca** use `alert()`, `confirm()` ou bibliotecas externas. Use sempre `ui.showModal()`, `ui.showConfirmModal()` e `ui.showToast()`.
- **Nunca** use placeholders de texto soltos como *"Carregando..."*. Use os **Skeleton Loaders** pulsantes (`ui.renderPacientesSkeleton()`, `ui.renderDashboardSkeleton()`).
- Mantenha a estrutura de cabeçalho padronizada (`.livro-page-header`, `.livro-page-back`, `.livro-page-eyebrow`).


---

## 🛠️ 3. Guia Prático: Como Adicionar um Novo Módulo

1. **Crie a pasta do módulo:** `frontend/src/modules/<novo_modulo>/<novo_modulo>.js`.
2. **Importe os serviços Core necessários:**
   ```javascript
   import { api } from '../../core/api.js';
   import { state } from '../../core/state.js';
   import * as utils from '../../core/utils.js';
   import * as ui from '../../core/ui.js';
   import * as router from '../../core/router.js';
   import * as auth from '../../core/auth.js';
   import * as draft from '../../core/draft.js';
   ```
3. **Exporte as funções públicas:**
   ```javascript
   export async function enterNovoModuloMode() {
     router.activateWorkspace('novo-modulo', document.getElementById('workspace-novo-modulo'));
     // Lógica do módulo...
   }
   ```
4. **Cadastre no `frontend/src/main.js`:**
   - Importe o módulo: `import * as novoModulo from './modules/novo_modulo/novo_modulo.js';`
   - Registre os botões e handlers de inicialização se necessário.

---

## 📡 4. Serviços Core Disponíveis

| Módulo Core | Funções Principais |
|---|---|
| `core/api.js` | `api.get(url)`, `api.post(url, body)`, `api.put(url, body)`, `api.delete(url)` |
| `core/auth.js` | `checkSession()`, `trocarPerfil(id)`, `temPermissaoAtiva(modulo, perm)`, `toggleUserProfileMenu()` |
| `core/draft.js` | `getModuleDraft(mod)`, `setModuleDraft(mod, val)`, `markModuleDraftDirty(mod)`, `flushPendingDrafts()` |
| `core/router.js` | `showScreen(name)`, `activateWorkspace(mode, el)`, `showModeChooser()`, `configureTopbarByMode()` |
| `core/ui.js` | `showToast(msg, type)`, `showModal(type, title, msg)`, `showConfirmModal(title, msg)`, `toggleSidebar()` |
| `core/utils.js` | `escapeHtml(text)`, `debounce(fn, ms)`, `formatIsoDatePtBr(date)`, `getTodayIsoDate()`, `loadVersion()` |
| `core/state.js` | `state` (objeto único com todos os dados da sessão, setores, pacientes e formulários) |
