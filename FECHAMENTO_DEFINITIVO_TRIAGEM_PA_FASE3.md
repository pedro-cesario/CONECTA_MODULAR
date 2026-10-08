# FECHAMENTO DEFINITIVO DA FASE 3 - TRIAGEM P.A.

## 1. Correção das Procedures de Fila
Foram revisadas e corrigidas as procedures no backend (`FilaRepository.js`). As referências errôneas a `atendimento_fila_tasy_pkg` e aos sufixos `_W` foram completamente removidas. Agora, o sistema invoca explicitamente as procedures autônomas oficiais do TASY:
- `INUTILIZAR_SENHA`
- `TRANSFERIR_PAC_FILA`

## 2. Condição de Identificação (UI)
As opções de identificação foram unificadas na interface do usuário (frontend) em um grupo conciso de três radio cards contendo as opções válidas:
- **IDENTIFICADO**
- **NAO_APRESENTOU_IDENTIFICACAO**
- **NAO_IDENTIFICADO**

## 3. Criação Tardia do Paciente Não Identificado
O fluxo no frontend (`dashboard.js`) foi corrigido para não efetuar chamadas prematuras na seleção da condição "NÃO IDENTIFICADO". O paciente genérico (anônimo) só é criado no TASY mediante a submissão (clique em Iniciar Triagem), garantindo que o banco de dados não seja poluído com lixo caso o usuário cancele o modal. A responsabilidade foi movida inteiramente para `TriagemPaService.iniciarAtendimentoTriagem`.

## 4. Validação do Enum de Identificação no Backend
O payload do endpoint `/api/triagem-pa/iniciar` passou a exigir a propriedade `condicaoIdentificacao`. O serviço agora valida rigorosamente a enumeração, aceitando apenas as três opções esperadas e devolvendo erro `400 Bad Request` caso seja passado um valor inválido.

## 5. Recuperação de Estado (Retomada)
Foi ajustado o serviço `obterStatusSenha` para garantir a correta recuperação da Condição de Identificação ao continuar uma triagem prévia. O sistema busca as classificações vinculadas ao paciente na tabela `PESSOA_CLASSIF` e, cruzando com as configurações do Conecta Admin, define o enum correto (IDENTIFICADO, NAO_APRESENTOU_IDENTIFICACAO, ou NAO_IDENTIFICADO) a ser enviado ao frontend.

## 6. Integridade dos Testes
O arquivo de testes `backend/test_fase3.js` foi reescrito e expandido para validar os 12 novos cenários de correção pontual:
- As 3 opções de Enum e bloqueio de opções inválidas;
- Criação tardia de não identificados;
- Comprovação do uso da procedure oficial `INUTILIZAR_SENHA`;
- Atribuição coesa das classificações de paciente atreladas à retomada.

Todos os 20 testes encontram-se passando e as mock calls do banco refletem estritamente a nova modelagem e refatoração das Fases 1, 2 e 3.
