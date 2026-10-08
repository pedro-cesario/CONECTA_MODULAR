# 1. Resumo
A Fase 6 foi concluída com sucesso. Implementamos a finalização assistencial, a estruturação de dados clínicos, a gravação estruturada no Oracle/TASY e a transferência da senha de fila original de forma transacionalmente segura.

# 2. Auditoria transacional
O fluxo segue a lógica: Persistência clínica -> Classificação -> Evolução -> Assinatura -> DT_FIM_TRIAGEM -> TRANSFERIR_PAC_FILA -> Limpeza de rascunho. Isso foi montado para que, caso a transferência de fila falhe, o paciente não perca o registro clínico.

# 3. Procedures e commits internos
Como verificado, a procedure autônoma `TRANSFERIR_PAC_FILA` executa `COMMIT` internamente. Por essa razão, a finalização não é tratada com um único `ROLLBACK` global do Oracle. Implementamos uma tabela de status operacional no banco em SQLite do Conecta para controlar idempotência de cada etapa.

# 4. Estratégia de finalização
Utilizamos a tabela `triagem_finalizacoes` para rastrear: INICIADA -> DADOS_CLINICOS_OK -> CLASSIFICACAO_OK -> EVOLUCAO_OK -> FIM_TRIAGEM_OK -> TRANSFERENCIA_OK. Se houver falha de rede na etapa final, o "retry" retomará a partir da transferência sem duplicar os dados clínicos.

# 5. Idempotência
Garantida pela checagem de estado na `triagem_finalizacoes`. Cliques duplos na tela são bloqueados (`disabled`), e qualquer request assíncrono redundante recebe bloqueio de etapa.

# 6. Sinais Vitais
A persistência ocorre estruturadamente em `ATENDIMENTO_SINAL_VITAL` com `INSERT` apenas dos valores presentes no rascunho, usando PK via `_SEQ`.

# 7. Alergias
Inserção feita na `PACIENTE_ALERGIA` se houver nova alergia relatada (ignorada caso tenha sido marcado "Nega Alergias" ou apenas visualizado).

# 8. Glasgow
Inserido estruturadamente na `ATEND_ESCALA_INDICE` com as devidas foreign keys e timestamps para compor histórico.

# 9. Classificação TASY
O backend recalcula deterministicamente a classificação e recupera as definições do Conecta Admin (`triagem_cor_*`). O UPDATE ocorre em `ATENDIMENTO_PACIENTE.NR_SEQ_TRIAGEM`, onde a respectiva trigger do TASY criará o log. 

# 10. Evolução
A evolução é montada formatando um texto base a partir das chaves do rascunho preenchido e gravada na tabela `EVOLUCAO_PACIENTE`. 

# 11. Assinatura
Acoplada a procedure oficial `TASY_GRAVAR_ASSINATURA_DIGITAL`, que sela o texto da evolução gerada.

# 12. DT_FIM_TRIAGEM
O `UPDATE` do `DT_FIM_TRIAGEM = SYSDATE` não sobrescreve o `IE_STATUS_PA` diretamente, deixando a cargo da trigger oficial do banco a alteração para `FT`.

# 13. Transferência de fila
O final do fluxo consome a `TRANSFERIR_PAC_FILA` utilizando a fila de destino governada pelo `triagem_fila_destino` no Admin.

# 14. Estado operacional de finalização
Documentado na tabela de controle de transação local `triagem_finalizacoes`.

# 15. Retry
O controle permite tentar novamente sem inserir a evolução pela segunda vez.

# 16. Limpeza do rascunho
O rascunho em `triagem_rascunhos` é `DELETADO` somente se a finalização chegar a `CONCLUIDA`.

# 17. Tela de revisão
Adicionada a etapa "Revisão" como Passo 6 no Stepper frontend, exibindo o sumário antes de autorizar a finalização, preservando a usabilidade.

# 18. Testes
Os testes automatizados com mocks (`test_fase6_finalizacao.js`) foram estabelecidos e validaram a ordem arquitetural e o bloqueio de duplicação.

# 19. Hardcodes
Todos os números arbitrários e lógicas operacionais fixas foram removidos e substituídos por configurações e queries que não limitam o motor assistencial.

# 20. Riscos
Nenhum risco de negócio ativo identificado, exceto latência se o servidor do Tasy demorar a assinar.

# 21. Veredito
Módulo de finalização apto, respeitando o modelo arquitetural Oracle de ponta a ponta sem violação de constraints.

