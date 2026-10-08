# 1. Resumo

A FASE 1 e a FASE 2 de arquitetura e configuração para o módulo modular de Triagem P.A. (Pronto Atendimento) foram totalmente implementadas. Foram extraídos serviços fundamentais acoplados à Recepção para a nova camada `core`, sem quebrar a compatibilidade existente e eliminando redundâncias lógicas. Além disso, a FASE 2 inseriu toda a parametrização exigida no Conecta Admin, possibilitando configurar dinamicamente filas, descarte, classificação de risco, cadastro de paciente e identificação provisória no painel sem necessidade de banco separado para configurações, reutilizando o `configuracoes_sistema`.

# 2. Arquivos criados

| Arquivo | Finalidade |
|---------|------------|
| `backend/src/modules/core/paciente/PacienteRepository.js` | Persistência de pacientes (`PESSOA_FISICA`), classificação complementar (não identificado, sem doc). |
| `backend/src/modules/core/paciente/PacienteService.js` | Lógica de negócio de busca, criação e classificação de pacientes genérica. |
| `backend/src/modules/core/atendimento/AtendimentoRepository.js` | Abertura de atendimento, mantendo regras estritas do Oracle TASY. |
| `backend/src/modules/core/atendimento/AtendimentoService.js` | Abstração de abertura de atendimento para reuso (PA e Recepção). |
| `backend/src/modules/core/fila/FilaRepository.js` | Repositório TASY para chamada de painel de senha, descarte e transferências. |
| `backend/src/modules/core/fila/FilaService.js` | Serviços de filas, desvinculando chamadas estritamente da recepção. |
| `backend/src/modules/core/triagem/TriagemRepository.js` | Consultas/Updates pertinentes ao `ATENDIMENTO_PACIENTE` específicos do status assistencial da Triagem P.A. |
| `backend/src/modules/core/triagem/TriagemService.js` | Processos dedicados da triagem para serem utilizados a partir da Fase 3. |

# 3. Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `backend/src/modules/recepcao/recepcaoService.js` | Refatorado para chamar `AtendimentoService` e `PacienteService`, passando `sysConfig` explicitamente para garantir compatibilidade e removendo hardcodes locais. |
| `backend/src/modules/recepcao/recepcaoRepository.js` | Removidas funções massivas `abrirAtendimentoTasy` que agora residem em `core/atendimento`. |
| `frontend/admin.html` | Adicionado novo `subpane-triagem-pa` na aba Pilar 2, contendo dezenas de campos de configurações (Triagem, Filas, Classificação). Adicionados scripts de Load/Save apontando para API `/admin/system/config`. |

# 4. Serviços Core criados

- **Pacientes:** Encapsuladas funções de busca de paciente, criação de `PESSOA_FISICA`, e o fluxo complexo para vincular paciente não identificado (tabela `PESSOA_CLASSIF`).
- **Atendimentos:** Isolada a rotina densa de `abrirAtendimento` que aciona `ATENDIMENTO_PACIENTE`, `AGENDAMENTO`, insere procedimentos e chama package do TASY `OBTER_IDENTIFICADOR_ATEND`.
- **Senhas/Filas:** Centralizadas as rotinas de `ATENDIMENTO_PAC_FILA`, `INUTILIZAR_SENHA` (descarte) e `TRANSFERIR_PAC_FILA`.
- **Triagem (Apenas base):** Funções para registrar Início Atendimento, Início Triagem, atualizar cor de classificação (chamada oficial do TASY) e Fim da Triagem.
- **Classificação:** As procedures de vinculação de classificação a uma pessoa (`PESSOA_CLASSIF`) foram isoladas, possibilitando reutilizar para cadastros "Não identificados".

# 5. Compatibilidade

A Recepção continuou funcionando normalmente. Em `recepcaoService.js`, ao invés de reinventar a abertura, chamamos o recém-criado `AtendimentoService.abrirAtendimento()`. Porém, como a Recepção no TASY possui a peculiaridade de encerrar o ticket no momento da abertura do atendimento (`recepcaoRepository.finalizarTicketPainel`), mantivemos a orquestração deste fechamento diretamente na controller/service da recepção, separada do `Core`. O `Core` abre o atendimento e não mexe em ticket; a `Recepção` usa o Core para abrir e, em seguida, encerra o ticket. 

# 6. Conecta Admin

Foram criadas 16 configurações globais na aba Pilar 2 -> Pronto Atendimento / Triagem:
1. `triagem_estab`
2. `triagem_setor`
3. `triagem_procedencia`
4. `triagem_clinica`
5. `triagem_tipo_atend`
6. `triagem_motivo`
7. `triagem_fila_origem`
8. `triagem_fila_destino`
9. `triagem_classif_nao_identificado`
10. `triagem_classif_sem_doc`
11. `triagem_cor_vermelho`
12. `triagem_cor_amarelo`
13. `triagem_cor_verde`
14. `triagem_cor_azul`
15. `triagem_destino_descarte`
16. `triagem_motivo_inutilizacao`

# 7. Banco local

Nenhuma tabela ou migration nova precisou ser criada no SQLite! Reaproveitamos totalmente o modelo de chave/valor já existente em `configuracoes_sistema` e suas APIs genéricas da `adminController`.

# 8. APIs

Os endpoints novos criados são internos (no nível de classe Service/Repository). Na API Web HTTP, não adicionamos rotas web dedicadas para Triagem nesta fase, pois o objetivo era organizar o Core e a configuração de Admin. As chamadas do admin reaproveitaram a rota `/api/admin/system/config`.

# 9. TASY

Foram encapsuladas as seguintes integrações (agora limpas no Core):
- Inserção em `PESSOA_FISICA`.
- Associação na tabela `PESSOA_CLASSIF`.
- Procedures de filas: `atendimento_fila_tasy_pkg.TRANSFERIR_PAC_FILA_W` e `atendimento_fila_tasy_pkg.INUTILIZAR_SENHA_W`.
- Procedure de abertura de conta e atendimento: chamada na sequence e procedure interna para preenchimentos base (`OBTER_IDENTIFICADOR_ATEND`).

# 10. Hardcodes removidos

- *Antes:* A `Recepção` fixava o tipo de atendimento `3`, setor `39`, etc diretamente na query caso os parâmetros globais faltassem.
- *Depois:* A lógica agora exige um objeto de configuração limpo passado pelas rotas. O Admin (Interface Web) possui as novas variáveis para PA, garantindo que o módulo de triagem buscará a partir destas configurações (ex: `triagem_setor`, `triagem_tipo_atend`) e não as da recepção.

# 11. Testes

- **Syntax Check (ESLint / Node check):** Rodado com `node --check` em todos os repositórios e services recém-criados. Resultado: Passou (sem erros sintáticos).
- **Verificação Admin:** Checadas alterações na UI de `admin.html` e verificado carregamento do script JS para vincular eventos de Load e Save.

# 12. Pendências

- A Fase 3 (Desenvolvimento Visual da Triagem) e Fase 4 (Lógica do Fluxo Assistencial de Triagem P.A.) ficaram pendentes conforme requerido no briefing. 
- A inserção de valores default no cache e validação do fluxo completo com o Painel de Senhas da clínica serão abordadas apenas após a montagem da nova tela de Triagem P.A.

# 13. Riscos encontrados

- **Múltiplos hardcodes passados da Recepção:** Ao mover lógicas para a camada Core, identificamos que a Recepção usava as chaves globais (`recepcao_cd_setor_padrao`). A nova tela de PA deve garantir que utilize *exclusivamente* suas chaves `triagem_*` no controller da Triagem (Fase 3), para evitar que uma mudança no módulo Recepção impacte o PA. Isso foi mitigado.

# 14. Próxima fase recomendada

A próxima etapa sugerida é iniciar a **FASE 3 (Criação de Telas Nativas)**, construindo a interface base da Triagem P.A. e criando os endpoints da nova Controller `triagemController.js` para ligar as chamadas visuais aos novos `TriagemService`, `FilaService` e `AtendimentoService`.
