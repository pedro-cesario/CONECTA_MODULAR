# IMPLEMENTACAO_CONECTA_05_LOTE_2A_AUTORIZACAO_CENTRAL.md

## 1. BASE PRÉ-LOTE E DIFF EXCLUSIVO
Antes da modificação, realizamos um *snapshot* do arquivo `/backend/src/core/config/configCache.js` no diretório `/home/sdk2/.gemini/antigravity-cli/scratch/pre_lote_2a/`.

**Funções Encontradas (Antes):**
```javascript
// Implementação 1 (Linhas 725-733)
function perfilTemAcessoModulo(perfilId, moduloId) {
  if (!perfilId || !moduloId) return false;
  const pId = String(perfilId).trim().toLowerCase();
  const mId = String(moduloId).trim().toLowerCase();
  return cache.perfilModulos.some(pm => 
    String(pm.perfil_id).trim().toLowerCase() === pId && 
    String(pm.modulo_id).trim().toLowerCase() === mId
  );
}

// ... [outras funções] ...

// Implementação 2 (Linhas 764-767) - ATIVAMENTE UTILIZADA POR HOISTING DO JS
function perfilTemAcessoModulo(perfilId, moduloId) {
  if (!perfilId || !moduloId) return false;
  return cache.perfilModulos.some(pm => pm.perfil_id === perfilId && pm.modulo_id === moduloId);
}
```

**Função Refatorada (Depois - Diff Exclusivo):**
Removemos a **Implementação 1** integralmente (pois era código morto sobrescrito pelo hoisting do node). Mantivemos a **Implementação 2** estritamente como estava para preservar a semântica de igualdade forte, não ampliando o escopo de entrada com `toLowerCase()` para evitar acessos indesejados sem contratos definidos.

## 2. CHAMADORES DA FUNÇÃO CENTRAL
O método `perfilTemAcessoModulo` do `configCache` é invocado nos seguintes fluxos:
1. `backend/src/core/utils/acesso.js:53`: Em `validarModuloPermissao(usuario, moduloId, permissao)`, responsável pelos middlewares de rotas (`requirePermission`). Argumentos: `perfilAtivo` (do obj `req.session.usuario`), e a string hardcoded do `moduloId`.
2. `backend/src/core/config/modulos.js:209`: Dentro de uma função homônima, funcionando como camada de abstração.
3. `backend/src/core/config/configCache.js:740`: Chamada pela função vizinha `perfilPodeVisualizarSetor(perfilId, cdSetor, moduloId)`.

## 3. TESTES, RESULTADOS E POLÍTICA PRESERVADA
Para provar que a manutenção da "Implementação 2" não alteraria nenhum aspecto da segurança e protegeria contra entradas sujas diferentemente da "Implementação 1", foi injetada uma função mockável para `cache.perfilModulos` e executada a suíte sintética de testes `backend/test/etapa05_lote2a.test.js`.

**Resultados Efetivos (9 Testes / 9 Aprovados):**
- **Vínculos Permitidos Estritos:** Sucesso para `(enfermagem, passagem)`.
- **Vínculo Ausente/Desconhecido:** Negado isoladamente.
- **Diferenças Comportamentais Cobertas (Ausência de Ampliação de Privilégios):** A suíte testou o comportamento da função deletada contra a mantida. Ao passar `" Enfermagem "` (com espaços e caixa alta), a função removida autorizaria indevidamente o acesso (por `trim/toLowerCase`). A função ativa que preservamos bloqueia. Tipos incorretos (`'123' vs 123`) também são bloqueados pela nossa política preservada (`===`).
- **Configuração Indisponível (undefined):** Se o objeto `cache.perfilModulos` for destruído, a função falha com erro de Type (`Cannot read properties of undefined`). Preferimos preservar essa quebra da requisição para sinalizar erro grave do cache no server (Log/Alerta) a embutir um fallback silencioso (`cache.perfilModulos || []`) que esconderia o problema da TI, mantendo o estrito comportamento atual.

## 4. MAPEAMENTO DO PRÓXIMO LOTE (DOCUMENTAÇÃO SEM IMPLEMENTAÇÃO)

### A. Rota `/api/modulos`
- **Contrato e Consumidores:** Retorna todos os módulos da aplicação com a propriedade embutida `perfisPermitidos: ['enfermagem', 'medico', ...]`. Consumida nos scripts do VanillaJS `auth.js`, `registros.js` e `auditorias.js`.
- **Relação com Checkboxes:** **Nenhuma**. Checkboxes são renderizados por uma configuração disparada paralelamente pela rota `/api/passagem/checkboxes`.
- **Proposta Mínima para Remoção de Exposição:** No endpoint (ou no controller), o array `perfisPermitidos` deve ser filtrado retornando *apenas* o Perfil Ativo do requerente (ex: `['enfermagem']`) caso ele o possua, ou vazio `[]`. Como o frontend faz check nativo via `.includes(String(perfilAtivo))`, esse bloqueio backend elimina a exposição matricial sem quebrar a tela. Administrativos podem receber o array completo.

### B. Pacientes por Setor (Dashboard)
- **Rotas e Serviços:** `/api/pacientes/dashboard/pacientes-setor/:cd_setor` executa o `pacienteController.listarPacientesDashboard`.
- **Escopo e Validação:** Utiliza o `perfilAtivo` (vindo do Redis/Sessão). A validação já ocorre ANTES da consulta ao banco chamando `configCache.perfilPodeVisualizarSetor`.
- **Regra para Lista Vazia:** Atualmente, se um perfil não possui setores restritivos cadastrados no cache, a função de checagem cai no fallback puro de acesso ao módulo: `return perfilTemAcessoModulo(...)`. Isso representa vulnerabilidade de segurança (Privilégio Máximo em vez de Privilégio Mínimo). Se a lista for vazia, ele acessará a emergência, UTIs e alas restritas indistintamente.

### C. Relatórios (Recepção)
- **Caminho Real:** A rota (via `GET /relatorios/:id/gerar`) aciona o `recepcaoController` que usa `tasyReportsClient.gerarRelatorioPdf` conectando ao TTS externo. *(OBS: O método `gerarRelatorioAtendimento` dentro do repositório é código morto (HTML) e não é consumido pelo PDF).*
- **Origem dos IDs:** São alimentados por `configCache.getRelatoriosTasy()` mesclados com constantes nativas do sistema.
- **Permissão Atual:** O sistema exige que o perfil possua a *flag* de privilégio `'emitir_relatorio'`.
- **Proposta de Validação:** Inserir barreira de Autorização no início do controller validando se o `req.params.id` solicitado faz parte do escopo matricial configurado para o perfil do usuário ou do módulo, bloqueando acesso direto pela URL.

## 5. PENDÊNCIAS E DECISÕES NECESSÁRIAS
1. Na base mapeada no *Lote 1*, a função `verificarDuplicidadePaciente` apresentou sintaxe relacional SQL para junção de arrays. Há dúvidas e risco latente na precedência natural (OR / AND) de agrupamento nos laços SQL não blindados com parênteses. Requer revisão na etapa pertinente sem alteração atual.
2. A política de Limpeza de Segredos foi repensada: deve ser tratada como processo segmentado entre `Rotação de Senha e Chaves`, mitigação em `gitignore` de base local e auditoria direta no rastreador do histórico do Git, e não como uma "migração irrestrita de branch" em massa.
3. Precisamos definir se o fallback de `perfilPodeVisualizarSetor` (Pacientes por Setor) terá a regra alterada para **Bloqueio por Padrão (Deny-All)** quando não existirem setores vinculados, o que causará impacto a usuários que atualmente dependem dessa permissividade sistêmica. 

## 6. PROCEDIMENTO DE RETORNO (ROLLBACK SEGURO)
Em caso de impacto negativo, a restauração desta implementação exige apenas a concatenação da declaração contida no arquivo temporário `/home/sdk2/.gemini/antigravity-cli/scratch/pre_lote_2a/configCache.js` (Implementação 1, inativada) no meio do bloco local equivalente em `configCache.js` da base, revertendo a eliminação efetuada pela deleção de linhas. O patch reversivo manual é de exatas 9 linhas exclusivas, não afetando outros caches ou escopos globais.
