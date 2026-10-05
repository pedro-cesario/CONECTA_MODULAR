# IMPLEMENTACAO_CONECTA_04_LOTE_1_CONTRATO_E_CONEXOES.md

## 1. BASE E ARQUIVOS ALTERADOS
- **Branch:** `master`
- **Commit Base:** `c2bd0c002b56fc37b516cc67d894473c6e77c5d7` (Autor: Pedro Cesario, "fix(infra): restaurar funcionamento do Conecta 2.0...")
- **Alterações Pré-existentes Preservadas:** Modificações das Etapas 02 e 02.1 mantidas intactas (ex: `ldapService.js`, `dashboardRepository.js`).
- **Arquivos Alterados Neste Lote:**
  - `frontend/src/core/utils.js` (Refatoração da validação do `loadVersion`)
  - `backend/src/modules/recepcao/recepcaoRepository.js` (Funções `gerarRelatorioAtendimento`, `verificarDuplicidadePaciente` e injeção de hooks para mock)
  - `backend/src/modules/setores/setorService.js` (Função `buscarSetoresComEscalaLiberada`, export e injeção de hooks para mock)
- **Novos Arquivos:**
  - `backend/test/etapa04_lote1.test.js` (Suite de testes isolados do Lote 1)

## 2. ERRATA DO PLANO ANTERIOR (ETAPA 03)
Conforme levantado pela revisão detalhada, o plano anterior passou pelas seguintes correções em seu escopo de interpretação:
- **Autenticação e Sessões:** A aplicação *não* utiliza tokens stateless. Ela utiliza sessões baseadas em cookie, e o estado é persistido nativamente no Redis (ou SQLite em ambiente simulado) via `express-session`.
- **Classificação Correta dos Casos Oracle:** O relatório da Etapa 03 classificou equivocadamente as conexões de `gerarRelatorioAtendimento` e `verificarDuplicidadePaciente` como "vazamento confirmado". O comportamento real era de **aquisição desnecessária**, visto que executavam retornos antecipados ou processamentos que não iam a banco de fato. Como o fluxo passava pelo bloco `finally`, a conexão terminava fechada. O mesmo vale para `buscarSetoresComEscalaLiberada`, configurando **risco não confirmado** (onde a falha efetiva era o possível mascaramento de erro primário caso o *close()* falhasse no `finally`).
- **Contratos de Relatórios (PDF/SSE):** Documentado que o tráfego em PDF (`/api/relatorios/.../pdf`) e SSE mantêm contratos de streaming nativos, não devendo ser envelopados em JSON genérico de erro/sucesso. O problema nos relatórios repousa na ausência de verificação do escopo do ID.
- **Cancelamento vs 401:** Utilizar `AbortController` (no core HTTP) previne que respostas defasadas sobreescrevam dados mais novos (*race conditions*). O tratamento global de 401 segue vital, focado unicamente na limpeza do estado local ao expirar a sessão.
- **Limpeza Git:** Adicionar arquivos `.sqlite` e `.json` no `.gitignore` e retirá-los do índice (`git rm --cached`) cessa a publicação constante, porém *não apaga o histórico de commits passados* e nem revoga segredos vazados.
- **Filtro `/api/modulos`:** Só poderá ter seu contrato severamente restrito após comprovado que os *checkboxes* do Frontend da Passagem de Plantão não quebram ao perder visibilidade de módulos para os quais o perfil logado não possui acesso direto.

*Nota:* O TTS (`/api/painel/audio`), ações diretas de infra/Git, autorizações por setor e painel administrativo continuam pendentes (Não resolvidos neste Lote).

## 3. CLASSIFICAÇÃO, EVIDÊNCIAS E DIFFS RELEVANTES

### 3.1 `loadVersion` (Contrato de API FrontEnd)
- **Antes:** O método apenas checava se `result` era Truthy e `result.ok !== false`. Objetos nulos e arrays passavam incorretamente como sucessos parciais.
- **Depois:** Passa a exigir que seja `typeof object` (e não Array), que contenha obrigatoriamente `ok === true`, `version` preenchida após `trim()` e `showTestBar` booleano puro.
- **Mudança de Comportamento:** Retornos vagos da infraestrutura ou rotas incorretas que devolvam arrays/HTML acionarão estritamente o estado "Serviço temporariamente indisponível".

### 3.2 `recepcaoRepository.gerarRelatorioAtendimento`
- **Classificação Original Corrigida:** Aquisição Desnecessária (Risco de Máscara de Erro no `finally`).
- **Ajuste:** O parsing base (parseInt) e a busca de configurações de Relatório ocorrem independentes da base Oracle e foram movidos **para antes** do `await _getConnection()`. O fechamento da conexão no `finally` recebeu `try/catch` para não encobrir exceções nativas. Validações primitivas barram imediatamente o fluxo ao enviar "NaN" nas chaves da rota.

### 3.3 `recepcaoRepository.verificarDuplicidadePaciente`
- **Classificação Original Corrigida:** Aquisição Desnecessária.
- **Ajuste:** O bloco que compõe as condicionais de busca para o CPF/Data de Nascimento e retorna precocemente (`return { duplicado: false };`) foi posicionado para rodar *antes* de instanciar a pool de conexões. Proteção estrita do `close()` no `finally` foi inserida.

### 3.4 `setorService.buscarSetoresComEscalaLiberada`
- **Classificação Original Corrigida:** Risco não confirmado (O erro não vazava, mas o close inseguro impedia debugar falhas originais de rede).
- **Ajuste:** Inserção do `return []` se `dataPlantao` for undefined ou em branco *antes* da abertura de conexão, e try/catch aninhado assegurando o `.close()`.

## 4. COMANDOS E RESULTADOS DE TESTES (EVIDÊNCIA DE ISOLAMENTO)

Todos os testes desenvolvidos evitam inicializar clientes reais. Eles aplicam mock nativo importando `utils.js` (para frontend dom/api fake) e injetam interceptadores no backend via `setCustomGetConnectionForTest`.

**Comando Executado:** `node backend/test/etapa04_lote1.test.js`
**Resultados Efetivos:**
```text
▶ Etapa 04 Lote 1: loadVersion strict contract
  ✔ Sucesso com resposta estrita (8.56ms)
  ✔ Falha com array (inválido) (1.19ms)
  ✔ Falha com objeto null (0.47ms)
  ✔ Falha com version vazia (0.37ms)
  ✔ Falha com showTestBar ausente (0.34ms)
  ✔ Recuperação de falha para sucesso (0.28ms)

▶ Etapa 04 Lote 1: Conexões Oracle
  ▶ recepcaoRepository.gerarRelatorioAtendimento
    ✔ Validações falham antes da aquisição de conexão (0.90ms)
    ✔ Fecha a conexão em caso de sucesso (14.38ms)
  ▶ recepcaoRepository.verificarDuplicidadePaciente
    ✔ Retorno antecipado sem adquirir conexão se conds = 0 (0.36ms)
  ▶ setorService.buscarSetoresComEscalaLiberada
    ✔ Retorno antecipado sem adquirir conexão se dataPlantao vazio (0.60ms)
    ✔ Falha de fechamento não mascara erro de execução (0.76ms)
```

*Nota Extra:* A suite estabilizada anteriormente (`backend/test/etapa02_estabilizacao.test.js`) foi re-executada garantindo ausência total de regressão nas correções do Lote passado (LDAP/Grupos, etc). O SQLite da aplicação e Scripts de Manutenção não sofreram interferência.

## 5. PENDÊNCIAS A MANTER NO RADAR
O Lote 1 é focado e estrito. Seguem integralmente como *To-Do*:
- Construção de Painel de Configurações Seguro (AES).
- Autorização refinada de Backend (Escopo, Setor, `configCache.js`).
- Higienização permanente do `.gitignore`.
- Substituição massiva de alert/prompt baseados no DESIGN_SYSTEM.
- Proxy `TTS` na API.

## 6. PROCEDIMENTO DE RETORNO (ROLLBACK) E IMPLANTAÇÃO

**Rollback Restrito (Reverte este Lote preservando anteriores):**
```bash
git checkout HEAD -- frontend/src/core/utils.js
git checkout HEAD -- backend/src/modules/recepcao/recepcaoRepository.js
git checkout HEAD -- backend/src/modules/setores/setorService.js
# O arquivo de testes criado backend/test/etapa04_lote1.test.js pode ser excluído manualmente caso necessário.
```

**Verificações para Homologação:**
- As mudanças no backend não farão efeito automático se não houver um procedimento de reinício (restart) no processo do servidor Node, ou na reconstrução do container rodando a API.
- Como o projeto faz deploy do frontend por *bind mount* de diretório (sem build-step), a alteração de `utils.js` estará fisicamente presente aos usuários na pasta, mas pode estar retida no Cache do Navegador de equipes assistenciais se o `index.html` e a URL principal não tiverem a tag de versão (`?v=XXX`) incrementada. Orientar hard refresh nas estações.
