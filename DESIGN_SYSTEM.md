# 🎨 Conecta HEAL — Design System & Guia Oficial de UI/UX

> **Manual Obrigatório de Identidade Visual, Componentes, Tokens e Comportamentos de Interface.**  
> *Qualquer desenvolvedor ou IA que criar novas telas, botões, modais ou refatorar o frontend DEVE seguir rigorosamente este documento.*

---

## 🎯 1. Princípios de Design Hospitalar (Clinical Clarity)

1. **Clareza Clínica em Primeiro Lugar:** A interface é usada por médicos, enfermeiros e técnicos em plantões intensos. Cores, contrastes e ícones devem comunicar status clínico de forma inequívoca (*ex: vermelho para risco/alerta crítico, verde para estabilidade/sucesso, âmbar para atenção*).
2. **Zero Poluição Visual:** Espaçamento generoso, hierarquia tipográfica evidente (*Eyebrow -> Título -> Subtítulo*) e cartões agrupados por domínio sem bordas excessivas.
3. **Consistência Absoluta:** Todos os módulos (*Passagem, Dashboard, Livro, Escala, Registros, Auditorias*) devem ter exatamente o mesmo cabeçalho, mesmo botão de voltar, mesma barra de ações flutuante e mesmos modais.
4. **Proibição de `alert()`, `confirm()` e `prompt()` nativos:** Toda interação com o usuário DEVE usar os modais e toasts do core (`ui.showModal`, `ui.showConfirmModal`, `ui.showToast`).

---

## 🎨 2. Tokens de Cor & Variáveis CSS

Utilize **SEMPRE** as variáveis CSS do `:root`. **É terminantemente proibido utilizar cores hexadecimais soltas ou inline styles (`style="background: #..."`)** no HTML/JS.

### 🔷 Cores Primárias (Identidade Institucional HEAL)
| Variável | Hex | Uso Recomendado |
|---|---|---|
| `--primary` | `#00387A` | Cor principal da marca, cabeçalhos, botões primários, badges ativos |
| `--primary-light` | `#134F9F` | Estados hover, ícones secundários em foco |
| `--primary-dark` | `#001A40` | Topbars fixas, textos com alto contraste institucional |
| `--primary-50` | `#EBF2FC` | Fundo de badges suaves, linhas de destaque |
| `--primary-100` | `#D1E4F8` | Bordas de cards ativos, foco de inputs |

### 🔶 Cores de Destaque & Alertas (Accent & Status)
| Variável | Hex | Uso Recomendado |
|---|---|---|
| `--accent` | `#F59E0B` | Âmbar: Alertas de atenção, pendências, turno noturno |
| `--accent-light` | `#FBBF24` | Hover de cards âmbar |
| `--green-500` / `--green-600` | `#22C55E` / `#16A34A` | Sucesso, botão Salvar, leito estável |
| `--red-500` / `--red-600` | `#EF4444` / `#DC2626` | Perigo, recusa de vaga, faltas não justificadas |
| `--red-50` / `--red-100` | `#FEF2F2` / `#FEE2E2` | Fundo de alertas críticos e seções de falta |

### ⚪ Neutros & Superfícies (Slate Scale)
| Variável | Hex | Uso Recomendado |
|---|---|---|
| `--slate-50` | `#F9F9FF` | Fundo geral da aplicação (`body`, `surface`) |
| `--slate-100` | `#F3F3FA` | Fundo de cards, painéis de filtro |
| `--slate-200` | `#E2E2E9` | Bordas padrão, divisórias de tabelas |
| `--slate-300` | `#C3C6D3` | Bordas inativas, placeholders |
| `--slate-500` | `#737783` | Textos secundários, legendas, metadados |
| `--slate-700` | `#424751` | Subtítulos, rótulos de campos (`label`) |
| `--slate-900` | `#191B21` | Títulos principais (`h1`, `h2`), texto de alto contraste |

---

## 🔤 3. Tipografia & Escala de Textos

- **Fonte Oficial:** `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

### Hierarquia Padrão de Cabeçalhos de Tela
```html
<header class="livro-page-header">
  <div class="livro-page-heading">
    <!-- Botão de Voltar Padronizado -->
    <button class="livro-page-back" id="btn-modulo-voltar" type="button" aria-label="Voltar">
      <i class="bi bi-arrow-left"></i>
    </button>
    <!-- Ícone em Container Circular -->
    <span class="livro-page-icon"><i class="bi bi-journal-medical"></i></span>
    <!-- Eyebrow + Título + Subtítulo -->
    <div>
      <span class="livro-page-eyebrow">Categoria / Módulo</span>
      <h2>Título da Tela</h2>
      <p>Descrição concisa da ação que o profissional realiza nesta tela.</p>
    </div>
  </div>
  <span class="livro-page-status"><i class="bi bi-shield-check"></i> Registro seguro</span>
</header>
```

---

## 🔘 4. Botões e Ações

### 🟢 Botão Primário de Ação / Salvar
```html
<button class="btn-save" id="btn-salvar" type="button">
  <i class="bi bi-check2-circle"></i> Salvar escala
</button>
```
* **Comportamento:** Sempre com cantos arredondados (`--radius-md`), ícone à esquerda e feedback de loading (`setLoading(btn, true)` com spinner `bi-arrow-repeat spin`).

### ⚪ Botão Secundário / Voltar / Visualizar
```html
<button class="btn-secondary" id="btn-cancelar" type="button">
  <i class="bi bi-arrow-left"></i> Voltar
</button>
```

### 🔴 Botão de Limpar / Excluir / Descartar
```html
<button class="btn-secondary livro-clear-btn" id="btn-limpar" type="button">
  <i class="bi bi-eraser"></i> Limpar
</button>
```
* **Regra:** Ações destrutivas ou de limpeza **SEMPRE** devem abrir o modal de confirmação `ui.showConfirmModal()`.

---

## 🪟 5. Modais, Diálogos e Toasts

### 1. Mensagem Informativa / Sucesso / Alerta
```javascript
import * as ui from '../core/ui.js';

await ui.showModal('success', 'Operação Concluída', 'A passagem de plantão foi salva com sucesso no TASY.');
// Tipos suportados: 'success', 'warning', 'error', 'info'
```

### 2. Confirmação com Duplo Clique Seguro
```javascript
const confirmou = await ui.showConfirmModal(
  'Descartar Alterações',
  'Existem dados não salvos. Deseja realmente sair e descartar?'
);
if (!confirmou) return;
```

### 3. Toasts Flutuantes (Notificações Não-Bloqueantes)
```javascript
ui.showToast('Rascunho salvo automaticamente', 'info');
ui.showToast('Erro ao comunicar com o servidor', 'error');
ui.showToast('Escala publicada com sucesso', 'success');
```

---

## 💀 6. Estados de Carregamento (Skeleton Loaders)

Nunca utilize textos estáticos como *"Carregando dados..."* soltos na tela. Utilize os **Skeleton Loaders com animação pulsante (`shimmerPulse`)**:

```javascript
import * as ui from '../core/ui.js';

// Para carregamento de setores:
containerSetores.innerHTML = ui.renderSetoresSkeleton(6);

// Para carregamento de leitos/pacientes na Passagem:
containerPacientes.innerHTML = ui.renderPacientesSkeleton(4);

// Para carregamento do grid do Dashboard:
containerDashboard.innerHTML = ui.renderDashboardSkeleton(6);
```

---

## 🚫 7. O Que NUNCA Fazer (Anti-Patterns para IAs)

1. ❌ **NUNCA crie estilos inline com cores hexadecimais arbitrárias** (ex: `style="background: #123456"` ou `style="color: red"`). Use as variáveis `--primary`, `--red-500`, etc.
2. ❌ **NUNCA use `alert()`, `confirm()` ou bibliotecas externas como SweetAlert / Bootbox.** O projeto tem seu próprio motor de modais em `ui.js`.
3. ❌ **NUNCA remova a estrutura de cabeçalho padrão** (`.livro-page-header` com `.livro-page-back` e `.livro-page-eyebrow`).
4. ❌ **NUNCA utilize ícones fora do pacote Bootstrap Icons (`bi bi-*`)**.
5. ❌ **NUNCA deixe formulários sem persistência de rascunho (`draft.markModuleDraftDirty`)** em telas onde o usuário digita anotações clínicas.
6. ❌ **NUNCA force scrollbar horizontal**. Em telas compactas (1366x768 de hospitais), a sidebar deve colapsar suavemente e os cards devem se reorganizar via CSS Grid/Flexbox responsivo.
