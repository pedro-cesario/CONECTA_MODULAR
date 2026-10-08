# Padrão definitivo das chaves

Foi escolhido e padronizado o prefixo `triagem_` para todas as configurações de P.A., que já era utilizado no frontend.
As ocorrências de `pa_triagem_` no backend foram corrigidas para este padrão, garantindo unificação.

| Configuração | Chave definitiva | Validação TASY |
| :--- | :--- | :--- |
| Estabelecimento Padrão | `triagem_estab` | `ESTABELECIMENTO` (`cd_estabelecimento`) |
| Setor Padrão | `triagem_setor` | `SETOR_ATENDIMENTO` (`cd_setor_atendimento`) |
| Procedência Padrão | `triagem_procedencia` | `PROCEDENCIA` (`cd_procedencia`) |
| Clínica Padrão | `triagem_clinica` | `CIH_CLINICA` (`cd_clinica`) |
| Tipo de Atendimento Padrão | `triagem_tipo_atend` | `VALOR_DOMINIO` (`cd_dominio` = 12, `vl_dominio`) |
| Motivo de Atendimento | `triagem_motivo` | `VALOR_DOMINIO` (`cd_dominio` = 10580, `vl_dominio`) |
| Fila de Senhas Origem | `triagem_fila_origem` | `FILA_ESPERA_SENHA` (`nr_sequencia`) |
| Fila de Senhas Destino | `triagem_fila_destino` | `FILA_ESPERA_SENHA` (`nr_sequencia`) |
| Classif. Paciente Não Ident. | `triagem_classif_nao_identificado` | `CLASSIF_PESSOA` (`nr_sequencia`) |
| Classif. Paciente Sem Doc | `triagem_classif_sem_doc` | `CLASSIF_PESSOA` (`nr_sequencia`) |
| Cor: Vermelho | `triagem_cor_vermelho` | `TRIAGEM_CLASSIF_RISCO` (`nr_sequencia`) + Valida se contém 'Vermelho' no nome |
| Cor: Amarelo | `triagem_cor_amarelo` | `TRIAGEM_CLASSIF_RISCO` (`nr_sequencia`) + Valida se contém 'Amarelo' no nome |
| Cor: Verde | `triagem_cor_verde` | `TRIAGEM_CLASSIF_RISCO` (`nr_sequencia`) + Valida se contém 'Verde' no nome |
| Cor: Azul | `triagem_cor_azul` | `TRIAGEM_CLASSIF_RISCO` (`nr_sequencia`) + Valida se contém 'Azul' no nome |
| Motivo Inutilização de Senha | `triagem_motivo_inutilizacao` | `MOTIVO_INUTILIZACAO_SENHA` (`nr_sequencia`) |

# Configurações removidas

- **`triagem_destino_descarte`**: Completamente removido do frontend (`admin.html`), backend (`adminController.js`) e lógicas de validação. A procedure `INUTILIZAR_SENHA` exige o motivo de inutilização e os dados da senha atual, mas não requer nenhuma "fila de destino". Essa chave era desnecessária e causaria confusão para o administrador.

# Validações implementadas

- Todas as configurações acima recebem validação antes de serem persistidas no `TriagemValidationService.js`.
- Utilizados os domínios autênticos do TASY (ex: 12 e 10580 para tipos e motivos em `valor_dominio`).
- Validação atômica e conjunta: a API agora acumula as exceções e se uma ou mais configurações P.A. falharem, o payload inteiro é abortado, garantindo atomicidade.
- Cores (`triagem_cor_*`) são cruzadas com a coluna `DS_CLASSIFICACAO` para impedir o cadastro invertido acidental. (Ex: não permite colocar ID de Amarelo na configuração do Verde).

# Procedures de fila definitivas

- **Transferência:** A procedure oficial usada e validada como definitiva é a própria `TRANSFERIR_PAC_FILA` nativa, aceitando defaults corretos de TASY.
- **Inutilização:** A procedure oficial `INUTILIZAR_SENHA` é a definitiva. O `await conn.commit()` desnecessário no `FilaRepository.js` após essas procedures foi **removido**, pois os comandos efetuam o *COMMIT* nativamente, deixando isso documentado em comentário para o futuro.

# Testes

- Arquivo `TriagemValidationService.test.js` devidamente ajustado com mock atrelado à injeção no `database/index.js`, interceptando conexões do pool.
- Cobre o cruzamento cruzado de cores, inexistências nos variados domínios, e garante que as falhas abortam as operações.
- Todos os testes de validação unitária e as adequações de nomes nas chaves passaram com êxito sem quebrar o módulo central da Recepção ou Core Utils (conforme validado por execuções prévias do `npm test`).

# Veredito

FASE 1 FECHADA: SIM
FASE 2 FECHADA: SIM
PODE INICIAR FASE 3: SIM
