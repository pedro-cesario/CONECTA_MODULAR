# IMPLEMENTACAO_CONECTA_08_FECHAMENTO_E_MAPEAMENTO_DASHBOARD.md

## PARTE A: FECHAMENTO DOCUMENTAL DO CATÁLOGO

### 1. Evidências Finais e Trechos Reais de Código
Como restrição desta rodada, nenhuma maquiagem ou alteração de código foi realizada para adequar os testes. A aplicação validada e os caminhos reais seguem rigorosamente aderentes à infraestrutura:

**a. Inicialização e Recusa após Pane (Cache)**
O *flag* nativo injetado em 07.2 dita a autorização no cache de relatórios. O Controller de Admin executa o processo que pode culminar na falha:
```javascript
// core/config/configCache.js
let relatoriosTasyDisponivel = false;

// No getRelatoriosTasyState() - O portão
function getRelatoriosTasyState() {
  if (!relatoriosTasyDisponivel || cache.relatoriosTasy === undefined) return 'UNAVAILABLE';
  if (cache.relatoriosTasy.length === 0) return 'EMPTY';
// ...
```
**b. Risco Administrativo Mapeado e Assumido**
Quando um admin salva o layout, o `adminController.js` chama `saveRelatorioTasy`, que finaliza executando:
```javascript
  await load();
  return { id, cd_relatorio: cd /*...*/ };
```
Como o Controller Administrativo não verifica a resposta estrita de `load()` e apenas constrói `res.json({success: true})`, o Admin sempre visualizará sucesso, mas caso ocorra ruptura com o SQLite no meio do `load()`, o motor de emissões tomba para `UNAVAILABLE` com segurança até um novo re-carregamento. A operação *Assistencial* é salva e isolada da pane de *Management*.

**c. Contratos HTTP Comprovados**
Todas as dependências externas foram esvaziadas (interceptando os módulos exportados *getConnection* e o *tasyReportsClient.gerarRelatorioPdf*) e a requisição simulada passou de ponta a ponta: do `requirePermission` (Auth) para o Controller.

- *Falha inicial:* Emissão/Listagem bloqueada em 503 HTTP. 0 pacotes enviados ao Oracle/Tasy.
- *Cadastro Vazio (Decisão da Diretoria):* Retorna `AppError.ForbiddenError('Catálogo de relatórios vazio.')` encapsulado em 403 HTTP. Listagem cai em catch(err) -> HTTP 403. Sem fallback para constantes.

### 2. Resultados das Suítes Regressivas
Executei sequencialmente todos os testes da trilha da Recepção construídos durante o Lote 2C (`node backend/test/etapa07*`). 
*Nenhuma quebra.* Nenhuma alteração foi necessária, pois a política evoluiu organicamente preservando o núcleo original.
- `etapa07_lote2c.test.js`: 4/4 Pass. (Validando integridade numérica / isSafeInteger).
- `etapa07_1_fechamento.test.js`: 9/9 Pass. (Validando barreiras contra ressurreição e fallback constante).
- `etapa07_2_aceite.test.js`: 5/5 Pass. (Validando unificação de AppErrors e Emissão na recarga).
- `etapa07_3_evidencias.test.js`: 4/4 Pass. (Comprovando os contratos HTTP corretos para listagem (array) e listagem vazia/bloqueada (403/503)).

### 3. Limitações de Rastreabilidade do Rollback
Os patches dry-run gerados na Etapa 07.3 consolidavam de forma *soma agregada* todo o Lote 2C (arquivos completos). Não existem "Snapshots" gravados exclusivamente no meio das etapas 07.1 e 07.2 isoladas do escopo global. 
Dessa forma, admito a ausência física para uma restauração *fatiada*, atestando que a capacidade do *Rollback* validado recua a base completamente e em segurança para o início da Etapa 07 original. Não reconstruí histórico fictício no Git nem violei o versionamento real.

---

## PARTE B: MAPEAMENTO E PILOTO DO DASHBOARD

### 1. Descoberta das Rotas Ativas (Leitura)
Mapeei o fluxo inspecionando o consumo no arquivo front-end `dashboard.js`. A arquitetura cruza controladores e exibe a natureza fragmentada legada. As requisições assistenciais são:

1. `GET /api/setores-internacao?modulo=dashboard`
   - **Auth:** `requireAuth` e Validação de perfil (Passagem / Dashboard).
   - **Caminho:** `setorController.listarSetoresInternacao` -> `setorService` -> Oracle DB.
2. `POST /api/dashboard/pacientes-setor/:cd_setor`
   - **Auth:** `requireAuth` e validação de `perfilPodeVisualizarSetor`.
   - **Caminho:** Rota POST usada apenas para Leitura. Encaminha para `pacienteController.listarPacientesDashboard` -> `pacienteService` -> Oracle DB (com agrupamento pesado em memória).
3. `GET /api/dashboard/internacao`
   - **Auth:** `requireAuth` + validação em `validarAcessoDashboardPA`.
   - **Caminho:** `dashboardController.listarDashboardPA` -> `dashboardService.listarDashboardPA()`.
   - **Cache/Risco:** Usa padrão agressivo de *Stale-While-Revalidate* em memória. Retorna lixo tolerável (stale) enquanto recria em background. O Front atualiza em intervalos periódicos.
4. `GET /api/dashboard/internacao/detalhes/:nrAtendimento`
   - **Auth:** `requireAuth` + validação `validarAcessoDashboardPA`.
   - **Caminho:** `dashboardController.obterDetalhesInternacao` -> `dashboardService.listarDetalhesInternacao()` -> `dashboardRepository`.
   - **Cache:** Sem cache. Dispara queries puras e faz busca manual por arrays de memória. 

### 2. Proposta Concreta para o Primeiro Piloto de Readequação
Para isolar a validação e padronizar sem colocar a operação em risco, escolhi adotar o fluxo: **`GET /api/dashboard/internacao/detalhes/:nrAtendimento`**

#### Justificativa da Escolha:
A rota tem escopo estreitíssimo (não utiliza o pool pesado de Cache Stale-While-Revalidate), requer somente 1 parâmetro dinâmico e tem defeitos concretos comprovados e corrigíveis pontualmente na nossa esteira. Trata-se do fluxo mais seguro para injetar o padrão de controle de erros sem abalar o resto.

#### Defeitos Observados (Contrato Atual):
1. **Validação Inexistente:** `const { nrAtendimento } = req.params;` vai cegamente para a pesquisa SQL sem ser validado em formato e sem limite numérico.
2. **Erro Local Forçado:** O service instiga `const err = new Error(); err.status = 404;` manualmente em vez do utilitário formal de `AppError`.
3. **Controlador Bypassando Global:** Ele intercepta em `catch(err) { return res.status(err.status || 500).json(...) }`, sem encaminhar para o interceptador mestre `next(err)` (`errorHandler.js`).
4. **Performance O(N) Subótima:** Executa dois downloads sequenciais pesados (`findPacientesIndicacaoInternacao` inteiro da rede DB para a RAM e faz um `.find()` no JS comparando Strings). *(Nesta rodada de adequação do piloto, priorizaremos o envelope padrão, antes de reescrever SQL)*.

#### Contrato Pretendido (Alterações Mínimas):
- **dashboardController.js:** Implementar validação estrita (`^\d+$` + `Number.isSafeInteger`) para blindagem da infra. Removeremos o retorno manual no Controller e invocaremos `next(err)`.
- **dashboardService.js:** Importar e lançar `NotFoundError` provindo de `core/errors/AppError.js`, adequando-se à governança unificada testada no Lote 2C.
- **dashboardRepository.js:** Preservar intacto neste primeiro momento, conferindo apenas as travas de `conn.close()` que já habitam o `finally`.

#### Critérios de Aceite Propostos:
- Ausência de impactos nos chamadores da rota `api.get(/detalhes/)` no front-end `dashboard.js`. O json continuará com o nó `success: false, message: ...`.
- Asserção explícita de `Zero Oracle Queries` para quando o parâmetro não passar na etapa de conversão.
- Confirmação do uso do RequestID injetado (propriedade do novo error-handler da API) nas devoluções desse terminal.
