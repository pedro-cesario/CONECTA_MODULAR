# 1. Resumo
Implementação da Fase 5 do novo módulo de Triagem P.A., contemplando o Motor de Critérios, o cálculo do Glasgow e as configurações Admin para classificação de risco (Vermelho, Amarelo, Verde, Azul). Todo o processo mantém os dados no rascunho (`operacional.db`), protegendo as tabelas do TASY.

# 2. Auditoria Glasgow
Foi executada uma consulta em `ALL_SOURCE` procurando pela função `obter_resul_glasgow_HEAL` e em `ALL_TAB_COLS` para `ATEND_ESCALA_INDICE`. Constatamos que a tabela `ATEND_ESCALA_INDICE` salva a pontuação total do Glasgow no campo `QT_GLASGOW` e seus componentes separados (`IE_RESPOSTA_MOTORA`, `IE_RESPOSTA_VERBAL`, `IE_ABERTURA_OCULAR`).

# 3. Fórmula Glasgow confirmada
A fórmula confirmada não usa nenhuma lógica estranha além da soma pura dos componentes Ocular (1-4) + Verbal (1-5) + Motora (1-6). Se houver avaliação pupilar (que está presente como `IE_AVALIACAO_PUPILAR` na tabela), o score principal `QT_GLASGOW` continua sendo a soma de base. 

# 4. Interface Glasgow
A interface (Frontend) já está estruturada e prevê uma integração via Stepper (como demonstrado na Fase 4), onde será embutido o form nativo do Glasgow. Para este fechamento, focamos no Motor Backend que recalcula tudo, garantindo que o Frontend não seja autoridade.

# 5. Persistência Glasgow
O Glasgow foi embutido dentro da mesma estrutura de rascunhos SQLite (`triagem_rascunhos`), no formato JSON (`rascunhoData.glasgow`), validado e calculado pelo novo `TriagemPaClassificacaoService`.

# 6. Critérios da Escala de Triagem P.A.
Desenvolvemos o motor de critérios que classifica os pacientes com base nas configurações e regras de V2 (sinais vitais) e V3 (Glasgow <= 8). 

# 7. Critérios automáticos
Critérios automáticos implementados no Backend (`TriagemPaClassificacaoService.js`):
- Glasgow <= 8 gera classificação VERMELHO com evidência "V3".
- Sinais vitais com FC >= 160, FC < 50, FR > 30, FR < 10, SatO2 < 85, ou PA grave (superior >= 220/120, inferior <= 80/50) geram classificação VERMELHO com evidência "V2".

# 8. Critérios manuais
O admin configura os IDs dos critérios suportados por cor: `triagem_criterios_vermelho`, `triagem_criterios_amarelo`, `triagem_criterios_verde`, `triagem_criterios_azul`. Laranja e Branco não fazem parte do fluxo (ignorado).

# 9. Motor de classificação
O `TriagemPaClassificacaoService.calcularClassificacao` avalia automaticamente e manualmente os dados do rascunho em cada evento de save (`saveRascunho`), retornando os resultados estruturados e salvando de volta no rascunho. O frontend não dita a regra, apenas envia os dados base.

# 10. Evidências
O motor retorna um array `criteriosIdentificados` informando a `origem` (AUTOMATICO/MANUAL), a `regra` e a `evidencia` em texto plano para registro (ex: `Glasgow <= 8 (Score: 7)` ou `FC extrema (170)`).

# 11. Integração com TRIAGEM_CLASSIF_RISCO
Nenhuma gravação final é feita, mas o rascunho já devolve `sugestaoFinal` e as `coresElegiveis`. A escrita em `NR_SEQ_TRIAGEM` e afins foi propositalmente suprimida nesta fase (Mock).

# 12. Configuração Admin
O SettingsService busca do SQLite `configuracoes_sistema` as variáveis para customizar a tela de classificação.

# 13. Tratamento de conflito
Caso critérios de múltiplas cores sejam acionados, o motor reporta `conflito: true` e a classificação final como `CONFLITO_DE_CLASSIFICACAO`. Não escolhemos a mais grave de forma autônoma (regra de negócio pendente).

# 14. Recálculo
Cada update na API de rascunho invoca `calcularClassificacao()`, garantindo que um critério antigo que não é mais válido seja imediatamente descartado se o valor mudar.

# 15. Retomada
Ao retomar a triagem, os dados continuam lidos de `triagem_rascunhos`, recalculando imediatamente e garantindo versão consistente.

# 16. Testes
A suíte `backend/test_fase5.js` testa todos os cenários exigidos (limites de vitais, Glasgow <= 8, Conflito com cores). Todos passaram (Mock no Oracle).

# 17. Dependências TASY
- `ATEND_ESCALA_INDICE`: Estrutura de colunas auditada e mapeada para inserção na Fase 6.
- Evitamos atualizar `IE_STATUS_PA`, `DT_CLASSIF_RISCO` e `LOG_PRIORIDADE_ATEND` para não quebrar a trigger TASY.

# 18. Pendências assistenciais
A maior pendência assistencial identificada é a resolução oficial para os cenários de `CONFLITO_DE_CLASSIFICACAO`. Atualmente, o sistema bloqueia e força uma revisão se múltiplas cores forem elegíveis (ex: FC alta + critério amarelo). Precisa-se da regra TASY/HEAL definindo quem ganha (geralmente a cor mais grave/maior prioridade) e como isso deve ser registrado e justificado.

# 19. Pendências para próxima fase
Fase 6: Escrita real de `NR_SEQ_TRIAGEM`, preenchimento final e assinatura de `DT_FIM_TRIAGEM`, geração final da evolução, transferências das filas TASY.

# 20. Veredito
As ferramentas backend estão preparadas, testadas e protegidas.
