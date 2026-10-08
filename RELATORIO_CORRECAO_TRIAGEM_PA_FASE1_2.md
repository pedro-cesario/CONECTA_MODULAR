# 1. Correções realizadas

- Verificação exaustiva no banco de dados Oracle TASY para confirmar a existência e assinatura dos "wrappers oficiais" sugeridos.
- Constatação da inexistência do pacote fictício `ATENDIMENTO_FILA_TASY_PKG` ou qualquer função com o sufixo `_W`.
- Validação técnica de que o Core já utilizava as rotinas definitivas e corretas (`TRANSFERIR_PAC_FILA` e `INUTILIZAR_SENHA`), que funcionam corretamente aproveitando os valores "default" dos parâmetros adicionais.
- Criação e integração do serviço de validação backend `TriagemValidationService` ao painel de configurações para impedir payloads de P.A. inválidos.

# 2. Wrapper final de transferência

A chamada original `TRANSFERIR_PAC_FILA` nativa do banco TASY foi confirmada como a oficial. O código em `FilaRepository.js` permaneceu utilizando a função diretamente.
Nenhuma adaptação para "TRANSFERIR_PAC_FILA_W" foi realizada, visto que foi comprovado ser um artefato não existente na base (uma possível alucinação de avaliações passadas).

# 3. Wrapper final de descarte

O mesmo se aplica ao descarte. O método do `FilaRepository.js` continua chamando `INUTILIZAR_SENHA` do esquema nativo.

# 4. Assinaturas Oracle confirmadas

As seguintes assinaturas foram validadas lendo-se as visões de sistema `ALL_ARGUMENTS` e `ALL_SOURCE` via script (node + Oracle Instant Client):

**TRANSFERIR_PAC_FILA** (Procedure Autônoma)
- `NR_SEQ_FILA_NOVA_P` (IN NUMBER)
- `NR_SEQ_FILA_ATUAL_P` (IN NUMBER)
- `CD_SENHA_P` (IN NUMBER)
- `NR_SEQ_SENHA_P` (IN NUMBER)
- `DS_ERRO_P` (OUT VARCHAR2)
- `IE_ORIGEM_TRANSF_P` (IN VARCHAR2, Default)
- `NR_SEQ_MOT_TRANSF_P` (IN NUMBER, Default)
- `CD_JUSTIFICATIVA_TEMPO_ATEND_P` (IN VARCHAR2, Default)

**INUTILIZAR_SENHA** (Procedure Autônoma)
- `CD_SENHA_P` (IN NUMBER)
- `CD_FILA_P` (IN NUMBER)
- `NR_SEQ_SENHA_P` (IN NUMBER)
- `NM_USUARIO_P` (IN VARCHAR2)
- `NR_SEQ_MOTIVO_INUTILIZACAO_P` (IN NUMBER)

# 5. Estratégia de commit/rollback

Foi consultada a visão `ALL_SOURCE` e atestado que tanto a procedure `TRANSFERIR_PAC_FILA` quanto a procedure `INUTILIZAR_SENHA` possuem a instrução `COMMIT` internamente.
O `FilaRepository.js` encapsula as execuções e também efetua `await conn.commit()` local. Como o Node JS dispara o final da instrução logo após a procedure, isso é compatível e seguro.

# 6. Serviço de validação das configurações

Foi implementado o `backend/src/modules/admin/TriagemValidationService.js`.
Esse serviço intercepta a submissão no endpoint genérico de salvar configurações do sistema (`salvarConfigSistema` em `adminController.js`). Ele apenas dispara conexões Oracle quando alguma chave contendo o prefixo `pa_triagem_` está presente.

# 7. Validações implementadas

| Configuração | Validação | Fonte TASY |
| :--- | :--- | :--- |
| `pa_triagem_estabelecimento_padrao` | Valida ID | `estabelecimento` (`cd_estabelecimento`) |
| `pa_triagem_setor_padrao` | Valida ID | `setor_atendimento` (`cd_setor_atendimento`) |
| `pa_triagem_fila_aguardando_triagem` | Valida ID | `fila_espera_senha` (`nr_sequencia`) |
| `pa_triagem_fila_aguardando_atend` | Valida ID | `fila_espera_senha` (`nr_sequencia`) |
| `pa_triagem_classificacao_*` | Valida ID | `classif_pessoa` (`nr_sequencia`) |
| `pa_triagem_cor_*` | Valida ID | `triagem_classif_risco` (`nr_sequencia`) |

Qualquer ID incorreto interrompe o fluxo na API sem permitir salvamentos parciais no cache.

# 8. Configurações removidas ou alteradas

Não foi necessário remover configurações previamente estabelecidas. Mantiveram-se as chaves requeridas para padronização.

# 9. Testes executados

Foram executados testes de unidade com dependência "mockada" (substituição do `db.getConnection`) no arquivo `TriagemValidationService.test.js`. O mock valida se a API retorna exceções acumuladas ao inserir IDs inexistentes e valida sucesso em simulações bem sucedidas.
Todos os testes relacionados às validações passaram (`npx mocha` ou execução direta).

# 10. Resultado

FASE 1 APROVADA: SIM
FASE 2 APROVADA: SIM
PRONTO PARA FASE 3: SIM
