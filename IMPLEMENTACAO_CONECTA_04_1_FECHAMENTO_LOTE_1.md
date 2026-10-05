# IMPLEMENTACAO_CONECTA_04_1_FECHAMENTO_LOTE_1.md

## 1. APRESENTAÇÃO DOS DIFFS E ARQUIVOS ALTERADOS
**Limitação Declarada:** Como o repositório não teve um *commit* ou *snapshot* intermediário isolando a Etapa 02 do início da Etapa 04, um `git diff` direto contra o `HEAD` misturaria todas as adequações de autenticação passadas. Os diffs abaixo são focados estritamente nos trechos modificados durante o **Lote 1 (Etapa 04)**.

### 1.1 `frontend/src/core/utils.js` (loadVersion)
```javascript
// Antes:
export async function loadVersion() {
  try {
    const result = await api.get('/api/version');
    if (!result || result.ok === false) {
      throw new Error('Resposta de versão incompatível');
    }
// ...
// Depois:
export async function loadVersion() {
  try {
    const result = await api.get('/api/version');
    
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Resposta de versão incompatível (tipo inválido)');
    }
    if (result.ok !== true) {
      throw new Error('Resposta de versão incompatível (ok !== true)');
    }
    if (typeof result.version !== 'string' || result.version.trim() === '') {
      throw new Error('Resposta de versão incompatível (versão ausente)');
    }
    if (typeof result.showTestBar !== 'boolean') {
      throw new Error('Resposta de versão incompatível (showTestBar ausente)');
    }
    const version = result.version.trim();
// ...
```

### 1.2 `backend/src/modules/recepcao/recepcaoRepository.js`
**gerarRelatorioAtendimento:**
```javascript
// Antes (Aquisicão e ausência de proteção ao close):
async function gerarRelatorioAtendimento(cdRelatorio, nrAtendimento) {
  const conn = await getConnection();
  try {
    const cd = parseInt(cdRelatorio, 10);
// ...
  } finally {
    await conn.close();
  }
}

// Depois (Validação síncrona antes, e close protegido):
async function gerarRelatorioAtendimento(cdRelatorio, nrAtendimento) {
  const cd = parseInt(cdRelatorio, 10);
  const nAtend = parseInt(nrAtendimento, 10);

  if (Number.isNaN(cd) || Number.isNaN(nAtend)) {
    throw new Error('Parâmetros inválidos para geração de relatório');
  }
  // ... gets configCache (independente de banco) ...
  const conn = await _getConnection();
  try {
// ...
  } catch (err) {
    throw err;
  } finally {
    try {
      await conn.close();
    } catch (closeErr) {
      const logger = require('../../core/utils/logger');
      logger.error('[Recepção] Erro ao fechar conexão em gerarRelatorioAtendimento:', closeErr);
    }
  }
}
```

**verificarDuplicidadePaciente:**
```javascript
// Antes:
async function verificarDuplicidadePaciente({ cpf, dtNascimento, cdPessoaFisica }) {
  const conn = await getConnection();
  try {
    // ... binds e conds
    if (conds.length === 0) {
      return { duplicado: false }; // Retorno antecipado PÓS conexão
    }
// ...
  } finally {
    await conn.close(); // Falha aqui não era logada nem capturada
  }
}

// Depois:
async function verificarDuplicidadePaciente({ cpf, dtNascimento, cdPessoaFisica }) {
  // ... prepara conds
  if (conds.length === 0) {
    return { duplicado: false }; // Retorno antecipado ANTES da conexão
  }

  const conn = await _getConnection();
  try {
// ...
  } catch (err) {
    throw err;
  } finally {
    try {
      await conn.close();
    } catch (closeErr) {
      const logger = require('../../core/utils/logger');
      logger.error('[Recepção] Erro ao fechar conexão em verificarDuplicidadePaciente:', closeErr);
    }
  }
}
```

### 1.3 `backend/src/modules/setores/setorService.js` (buscarSetoresComEscalaLiberada)
```javascript
// Antes:
async function buscarSetoresComEscalaLiberada(dataPlantao, turno) {
  const conn = await getConnection();
  try {
    // query que depende de dataPlantao
// ...

// Depois:
async function buscarSetoresComEscalaLiberada(dataPlantao, turno) {
  if (!dataPlantao) {
    return [];
  }
  const conn = await _getConnection();
// ... [close no finally encapado com try/catch]
```

### 1.4 Hooks de Teste Adicionados (Em Repositórios)
```javascript
let _getConnection = getConnection;
function setCustomGetConnectionForTest(fn) { _getConnection = fn; }
function resetCustomGetConnectionForTest() { _getConnection = getConnection; }
module.exports = {
  // ... funções ...,
  setCustomGetConnectionForTest,
  resetCustomGetConnectionForTest
};
```

## 2. COMPLETAR OS TESTES: MATRIZ DE CENÁRIOS E RESULTADOS

Os testes foram executados injetando contextos simulados (sem uso do SQLite, Redis ou Oracle reais). O Frontend rodou através da injeção nativa de dependências dinâmicas simulando `document` e `api`.

**Comando:** `node backend/test/etapa04_lote1.test.js`

| Módulo / Função | Cenário (Matriz) | Status | Detalhes / Evidência |
|---|---|---|---|
| **loadVersion** | Resposta estrita e válida | Pass | Asserção `Aplicação disponível` e `v1.2.3` confirmada. |
| **loadVersion** | Resposta array (inválido) | Pass | Lança erro `tipo inválido`. |
| **loadVersion** | Resposta objeto Null | Pass | Trata adequadamente (evitando erro de Type). |
| **loadVersion** | Versão ausente ou só com espaços | Pass | Falha estrita validada (trim). |
| **loadVersion** | Campo booleano `showTestBar` ausente | Pass | Falha estrita confirmada. |
| **loadVersion** | Erro de Rede ou HTTP (throw local) | Pass | Asserção do bloco `catch` e adição da classe `offline`. |
| **loadVersion** | Recuperação de falha para sucesso | Pass | Sistema remove classe `offline` se serviço retornar ativo. |
| **Oracle** (gerarRelatorio) | Validações falham ANTES da conexão | Pass | Mock de pool nem chega a ser disparado se falhar no *parseInt*. |
| **Oracle** (gerarRelatorio) | Sucesso com fechamento | Pass | Executa instrução e dispara fechamento `close()` no `finally`. |
| **Oracle** (gerarRelatorio) | Erro de aquisição | Pass | Lança timeout do mock, não havendo o que fechar. |
| **Oracle** (gerarRelatorio) | Erro de execução com fechamento | Pass | Query quebra e ainda assim executa `close()`. |
| **Oracle** (gerarRelatorio) | Execução e close falhando juntos | Pass | O erro da Query Primária (e não do close) é propagado (Não-Mascaramento comprovado). |
| **Oracle** (Duplicidade) | Entrada inválida/Retorno Antecipado | Pass | Acessou e retornou sem instanciar `_getConnection()`. |
| **Oracle** (buscarSetor...) | Close falhando após query falhar | Pass | A falha de fechamento é rastreada no `logger.error` e não se sobrepõe ao erro primário. |

**Suíte Anterior Confirmada:** A suíte original `etapa02_estabilizacao.test.js` continuou passando em seus 22 testes isoladamente sem falhas.

## 3. MUDANÇAS DE COMPORTAMENTO
- **Validação com parseInt (Entradas Sujas):** Como o JavaScript traduz `parseInt("123abc", 10)` para `123`, e `isNaN(123)` é falso, a string `"123abc"` continua sendo implicitamente aceita para gerar relatórios, comportando-se exatamente como o contrato original sem quebras de consumidores antigos. O código previne apenas strings completamente não-numéricas ("abc"), limitando requisições zumbis ao banco de dados. A inclusão de uma sanitização rigorosa de identificadores requer concordância de consumidores sistêmicos antes de ser implementada.
- **SetorService Retornando `[]`:** A adição da barreira `if (!dataPlantao) return []` não quebra nenhum fluxo anterior nem mascara erros críticos porque o único consumidor atual dessa função (`listarSetoresLivro`) blinda sua própria chamada via instrução síncrona `if (dataPlantao && turno) { ... }`.
- **Integridade SQL:** Os bind objects originais (ex: `binds.dtNasc = dtNascimento.substring(0, 10)`), comandos SQL e regras assistenciais permaneceram 100% inalterados e confirmados isolados das regras de negócio refatoradas para conexão.

## 4. PROCEDIMENTO CORRIGIDO DE RETORNO (ROLLBACK SEGURO)

A indicação anterior baseada em comandos destrutivos do Git foi revisada. O uso de `git checkout HEAD -- arquivo` apagaria todas as modificações valiosas não comitadas presentes nas Etapas 01, 02 e 02.1.
Para desfazer **apenas** o Lote 1, o administrador deve:

1. **Evitar Restauração de Arquivo Completo:** Não utilize `.bak` ou `checkout` integral caso outros mantenedores ou ferramentas tenham tocado o arquivo.
2. **Reversão Manual por Trechos (Garantida):**
   - No `frontend/src/core/utils.js`: Substitua o interior de `loadVersion()` retornando para a verificação `if (!result || result.ok === false)`.
   - Nos repositórios: Mova novamente os *statements* `const conn = await getConnection()` para a primeira linha do método, substituindo a interceptação simulada (`_getConnection()`), e remova a sintaxe `try { await conn.close(); } catch (...)` de dentro dos `finally`.
   - Remova manualmente os mocks (`setCustomGetConnectionForTest`) e os blocos exportados no rodapé dos repositórios.

## 5. CORREÇÕES À ERRATA DE ARQUITETURA
Durante esta revisão de fechamento, sanaram-se ambiguidades no documento orientativo inicial:
- **Caminhos Reais de PDF:** Eles não habitam rotas ilustrativas (como `/relatorios`). Estão localizados em `/api/auditorias/higiene-maos/:id/pdf` e `/api/auditorias/processos/:id/pdf`. O acesso a gerar relatório da recepção fica em `/api/recepcao/relatorios/:id/gerar` (HTML).
- **Caminhos Reais de SSE:** Estão contidos especificamente em `/api/painel/:id/stream` (que devolve headers `text/event-stream`), respondendo aos módulos de TV.
- **`/api/modulos` vs Checkboxes:** Classificado categoricamente como **não comprovado**. A inspeção cruzada demonstrou que o módulo Passagem (`passagem.js`) checa a variável global nativa `state.usuario?.perfilAtivo` invocando restritamente o método utilitário nativo sem utilizar uma chamada à API.

## 6. PENDÊNCIAS RESTANTES E PRÓXIMOS PASSOS
1. Modelagem final do *Painel Administrativo* de configuração de banco.
2. Restrição estrita de Autorização por ID (O acesso ao relatório no backend deve certificar-se de que o ID solicitado reside na hierarquia/setor do solicitante).
3. Correção do erro no objeto de Permissões da Sessão (A dupla declaração de `perfilTemAcessoModulo` do `configCache.js`).
4. Decisão formal sobre a exclusão da rota ociosa do TTS (`/api/painel/audio`) e a implantação rigorosa da política de commit sem rastros (*higiene de senhas do `.gitignore` com reescrita em reflog se exigida segurança bancária*).

**Estado de Implantação:** Nenhuma dessas alterações foi enviada à produção ou aplicada em ambientes remotos. O servidor principal não sofreu `restart` neste procedimento, indicando disponibilidade do monólito estritamente local em homologação.
