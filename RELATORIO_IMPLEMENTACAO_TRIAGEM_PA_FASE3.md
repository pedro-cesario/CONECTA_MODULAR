# RELATÓRIO DE IMPLEMENTAÇÃO - FASE 3 (TRIAGEM P.A.)

A Fase 3 do módulo de Triagem P.A. focou em construir a **Busca Inteligente**, o **Cadastro de Pacientes**, a **Identificação** e a **Abertura Segura do Atendimento**, de forma totalmente modular e isolada do legado da Recepção, utilizando o Core do Conecta.

## Resumo das Entregas

1. **Módulo Backend (`backend/src/modules/triagem-pa/`)**
   - Criados `TriagemPaController.js`, `TriagemPaService.js` e `routes.js`.
   - Implementadas as rotas específicas para o P.A. (isoladas da recepção): `/buscar`, `/pacientes`, `/pacientes/nao-identificado`, `/pacientes/:id/sem-documento` e `/iniciar`.
   - Serviço consumindo os repositórios do Core (`PacienteService`, `AtendimentoRepository`, `TriagemService`, `SettingsService`) de forma segura, lendo e aplicando parametrizações.

2. **FASE 3.1 — Busca Inteligente de Paciente**
   - No frontend (Dashboard), a API foi alterada de `/api/recepcao/pessoas/buscar` para o novo `/api/triagem-pa/buscar`.
   - Suporte nativo e otimizado a CPF limpo ou formatado, Data de Nascimento e Tokenização de Nome sem acento (já implementado no backend durante a Fase 1/2).
   - Conversão de chaves no frontend para lidar com os atributos em minúsculas padronizados.

3. **FASE 3.2 — Identificação do Paciente**
   - Inserida na tela de Confirmação (modal) a seleção de "Condição de Identificação" (`identificado` vs `sem_doc`).
   - Adicionado botão "Paciente Não Identificado" direto no stepper do modal para criação acelerada via endpoint `/nao-identificado`, consumindo a configuração do admin.

4. **FASE 3.3 — Cadastro Básico**
   - Cadastro limpo mantido no modal, sem campos irrelevantes.
   - Endpoint e action (`salvarENovoAtendimentoTriagem`) alterados para focar em `/api/triagem-pa/pacientes`.

5. **FASE 3.4 — Abertura Segura do Atendimento**
   - O botão "Avançar e Iniciar Triagem" foi modificado para utilizar o endpoint unificado `/api/triagem-pa/iniciar`.
   - Remoção do fechamento automático (update de senha), garantindo que `dt_fim_atendimento` seja mantido nulo para a etapa futura de Finalização, preservando a senha no painel com status "Em Andamento".

6. **FASE 3.5 — Estrutura Visual do Novo Modal**
   - O legado `carregarTemplateEHR` (Template Dinâmico do TASY) foi desativado no fluxo do P.A.
   - Ao iniciar o atendimento com sucesso, o modal é fechado e a grade de senhas é recarregada.
   - A base visual para o Stepper Nativo do Conecta (FASE 4) está limpa e pronta para expansão.

## Pontos Sensíveis
- A rota legado da Recepção continua funcional e inalterada para garantir a estabilidade do fluxo de entrada principal.
- Não foram implementados os módulos clínicos (Alergias, Vitais, etc.), que serão contemplados no novo layout nas próximas Fases.
- As configurações de Triagem devem estar ativas no SQLite (Estabelecimento, Procedência, Tipo, Classificações de Não Identificados) para não ocorrer falha de infraestrutura.
