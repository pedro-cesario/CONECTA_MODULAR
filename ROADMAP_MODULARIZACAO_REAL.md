# ROADMAP MESTRE: A VERDADEIRA MODULARIZAÇÃO (ESM NATIVE)
**Projeto:** Conecta Assistencial (Porta 3020)  
**Objetivo:** Fatiar as 7.900 linhas do `frontend/js/app.js` em módulos limpos, escaláveis e de padrão empresarial, **preservando estritamente a lógica original** através de extração cirúrgica de código, sem gerar lógicas artificiais.

---

## 🎯 ARQUITETURA DE TRANSIÇÃO (Bridge Pattern)
Durante a migração progressiva, o frontend opera em formato híbrido para garantir **Zero Tela Branca**:
1. **ES Modules (`frontend/src/`):** Todos os módulos isolados como ESM nativos (`import`/`export`).
2. **Ponte de Compatibilidade (`frontend/src/bridge.js`):**
   - Agrega todos os serviços em `window.conectaCore` e `window.conectaApp`.
   - Emite o evento `conectaCore:ready` para inicialização segura do monolito legado.
3. **Monolito em Redução (`frontend/js/app.js`):**
   - Executa após o evento `conectaCore:ready`.
   - Funções migradas são substituídas por chamadas `window.conectaCore.<funcao>`.
   - Funções legadas ainda não migradas são temporariamente expostas ao `window.conectaCore` via `Object.assign` no final do arquivo.

---

## 📋 STATUS DO CHECKLIST

### FASE 1: Fundação Core (Utilitários e Serviços Globais) — `[x] CONCLUÍDA`
- [x] **1.1.** `frontend/src/core/api.js`: Extraído `apiCall`, interceptadores de `401`, CSRF, métodos `get`, `post`, `put`, `delete`.
- [x] **1.2.** `frontend/src/core/utils.js`: Extraído `escapeHtml`, `debounce`, formatação de datas e helpers de texto.
- [x] **1.3.** `frontend/src/core/ui.js`: Extraído `showToast`, modais de loading, `showModal`, `showConfirmModal`.
- [x] **1.4.** `frontend/src/core/state.js`: Extraído `state` global, `MODULOS_CONFIG`, `MODULOS_META`, `MODULOS_DEFAULT`, `draftHydratingModules`, `modeTransitionSeq`.

### FASE 2: Roteamento, Sessão e Drafts — `[x] CONCLUÍDA`
- [x] **2.1.** `frontend/src/core/auth.js`: Extraído `checkSession`, `loadModulosFromBackend`, `trocarPerfil`, `updateProfileLabels`, `perfilTemAcessoModulo`, `temPermissaoAtiva`.
- [x] **2.2.** `frontend/src/core/router.js`: Extraído `showScreen`, `hideAllAppSections`, `activateWorkspace`, `showModeChooser`, `isCurrentWorkspace`.
- [x] **2.3.** `frontend/src/core/draft.js`: Extraído `initializeDraftSession`, `flushPendingDrafts`, `captureModuleDraft`, `markModuleDraftDirty`, `getModuleDraft`, `setModuleDraft`, `clearModuleDraft`.

### FASE 3: Extração Cirúrgica de Módulos de Domínio
- [x] **3.1 - Passagem de Plantão:** `frontend/src/modules/passagem/passagem.js` criado com 17 funções completas (`enterPassagemMode`, `showPassagemSubMenu`, `loadSetores`, `loadPacientes`, `renderPacientes`, `onSetorChange`, `restorePassagemDraft`, etc.).
- [x] **3.2 - Dashboard & Pronto Atendimento:** `frontend/src/modules/dashboard/dashboard.js` criado com gráficos, contadores e tabelas de Pronto Atendimento e Internação.
- [x] **3.3 - Livro Administrativo:** `frontend/src/modules/livro/livro.js` criado com todas as lógicas de equipe técnica, pátio, circulante, ECT, histórico e impressão (`showLivroSubMenu`, `enterLivroMode`, `loadSetoresLivro`, `loadEnfermeiros`, `loadTecnicos`, `salvarLivro`, `imprimirEscalaAssistencial`, etc.).
- [x] **3.4 - Escalas (Psicologia e Geral):** `frontend/src/modules/escala/escala.js` criado com matriz semanal, edição de células, publicação com justificativa e impressão (`enterEscalaMode`, `loadEscalaSemanal`, `renderEscalaSemanal`, `editEscalaCell`, `saveEscalaCell`, `imprimirSemanasPsicologia`, etc.).
- [x] **3.5 - Auditorias & Registros:** `frontend/src/modules/registros/registros.js` e `frontend/src/modules/auditorias/auditorias.js` criados como ES Modules nativos e integrados ao bridge, removendo tags de script legadas do `index.html`.

### FASE 4: Finalização e Remoção do Monolito — `[x] 100% CONCLUÍDA`
- [x] **4.1.** O arquivo `app.js` atingiu 0 linhas.
- [x] **4.2.** `index.html` passa a carregar apenas `<script type="module" src="src/main.js"></script>`.
- [x] **4.3.** A aplicação é orquestrada pelo ponto de entrada nativo `frontend/src/main.js` via ES Modules.
- [x] **4.4.** 100% dos 14 arquivos JavaScript validados com Acorn AST sem erros de sintaxe ou identificadores não declarados.

---

> 🔒 **Guia de Persistência para Próximas IAs:**
> 1. Todas as extrações devem ser **cópias fiéis do código original do `app.js`**, mantendo seletores do DOM exatos (ex: `setores-list`, `pacientes-list`, `mode-selector`).
> 2. Ao extrair um módulo, importe as dependências do `frontend/src/core/` (`api`, `state`, `utils`, `ui`, `router`, `draft`, `auth`).
> 3. Exporte as funções no `bridge.js` para manter a compatibilidade com partes ainda residentes no `app.js`.
> 4. Valide a sintaxe via Acorn parser (`ecmaVersion: 2022`) após qualquer modificação.
