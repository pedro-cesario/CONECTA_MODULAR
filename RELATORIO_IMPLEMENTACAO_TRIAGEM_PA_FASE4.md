# 1. Resumo
Implementação da Fase 4 da Triagem P.A., contemplando o core clínico do módulo: Queixa Principal, Alergias, Sinais Vitais, Histórico de Saúde, Estado Geral, Comportamento e Sintomas Gripais. O Wizard foi transformado em um Stepper inteligente com rascunhos assíncronos.

# 2. Arquivos criados
- `frontend/src/modules/triagem-pa/TriagemPaClinico.js` (Lógica frontend do Wizard clínico)
- `backend/test_fase4.js` (Testes automatizados da Fase 4)

# 3. Arquivos alterados
- `frontend/index.html` (Injeção de Stepper e Steps clínicos)
- `frontend/src/modules/dashboard/dashboard.js` (Integração do Wizard clínico)
- `backend/src/modules/triagem-pa/TriagemPaService.js` (Lógica e queries TASY + Rascunho local)
- `backend/src/modules/triagem-pa/TriagemPaController.js` (Endpoints de integração)
- `backend/src/modules/triagem-pa/routes.js` (Rotas da API)
- `backend/src/core/config/configCache.js` (Tabela SQLite `triagem_rascunhos`)

# 4. Estratégia de persistência/rascunho
Foi adotada a persistência estruturada controlada via Rascunho Local (`triagem_rascunhos` no banco SQLite do Admin) atrelada ao `nr_atendimento`. O sistema salva assincronamente a cada input e a retomada (reabertura do modal) preenche perfeitamente os inputs. A gravação final das alergias/sinais no TASY fica delegada ao final do processo.

# 5. Queixa Principal
Construída nativamente. Obrigatória. O frontend (`TriagemPaClinico.js`) impede o avanço de step se o campo estiver vazio ou apenas com espaços (`trim()`).

# 6. Alergias
Busca histórico existente de alergias direto da `paciente_alergia` no TASY. Permite listar novas alergias. "Nega Alergias" é mutuamente exclusivo, desmarcando e apagando itens novos; é bloqueado se já existirem registros históricos.

# 7. Sinais Vitais
Grid completo criado no HTML do Triagem P.A., sem abrir o modal legado do EHR. Campos limitados via restrições do input HTML (`type="number"`, `min`, `max`, `step`) e unidades de medida nas labels.

# 8. Histórico de Saúde
Renderizado dinamicamente via serviço JSON `getConfiguracoesClinicas`. A opção "Nega Comorbidades" foi isolada (`exclusivo: true`), limpando imediatamente qualquer outra caixa marcada ao ser acionada (e vice-versa).

# 9. Estado Geral
Mapeado dinamicamente com propriedade `incompativel`. Ao marcar "Corado", o frontend desmarca sumariamente "Hipocorado" no state e na interface.

# 10. Comportamento
Checkboxes múltipla escolha criadas de acordo com as propriedades de `getConfiguracoesClinicas`, preservadas corretamente no rascunho de retomada.

# 11. Sintomas Gripais
Criado com um switch prático (Sim/Não). Se marcado sim, exibe `textarea` para descrição. Sem criação de protocolos complexos inventados fora do escopo.

# 12. Configurações no Admin
O serviço do Admin no backend entrega todo o arcabouço JSON (listas e regras de exclusividade) para Histórico, Estado e Comportamento. 

# 13. Core Clínico
As queries e validações estão puras dentro de `TriagemPaService.js`, mantendo independência total do `ehrController`.

# 14. Retomada
O rascunho local (`triagem_rascunhos`) salva imediatamente as parciais e recarrega na hora de "Continuar Triagem". Não há perda de dados.

# 15. Testes
100% dos testes executados (`test_fase4.js`), confirmando retornos da Query de alergia, impeditivo de "Nega Alergias" incompatível e gravação correta do Rascunho.

# 16. Dependências antigas
Ausência absoluta de uso do `EHR_TEMPLATE` ou chamadas às rotas da Recepção no novo Stepper. Módulo isolado.

# 17. Pendências para Fase 5
- Escala (Manchester/Outra) e motor de cor.
- Inserção dos dados vitais e alergias definitivamente no Oracle.
- Geração de Evolução e Fechamento/Transferência de Fila.

# 18. Riscos
Mitigados. A adoção de draft previne commits imaturos no Oracle.
