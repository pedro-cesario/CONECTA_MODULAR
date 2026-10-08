# 1. Correções realizadas
- **Arquitetura Orientada a Configuração:** Nenhuma regra de classificação (seja V2 de sinais vitais, seja V3 de Glasgow, sejam os manuais) permanece "hardcoded" na lógica condicional (`if/else` solto) do motor.
- **Motor Reescrito:** O `TriagemPaClassificacaoService` foi atualizado para processar Arrays dinâmicos de regras, extraídos do Conecta Admin, permitindo alterar limites, operadores e ativar/desativar lógicas sem necessidade de refatoração do código.
- **Precedência de Cores Oficializada e Configurável:** Múltiplas cores agora não geram mais `CONFLITO_DE_CLASSIFICACAO` (quando o motor for alimentado corretamente). A configuração oficial dita a ordem de resolução: Vermelho > Amarelo > Verde > Azul. As evidências (critérios atingidos de menor gravidade) continuam salvas para auditoria.

# 2. Regra de PA implementada
A configuração padrão (*bootstrap*) foi estabelecida como:
- `PAS > 170` OU `PAD > 120` -> VERMELHO
- `PAS < 80` OU `PAD < 60` -> VERMELHO
Isso reflete-se em 4 regras automáticas injetadas na inicialização, mas inteiramente modeladas para serem alteradas no painel do administrador (ex: mudando um operador de `>` para `>=`).

# 3. Pendência assistencial da PA, se houver
A interpretação "OU" entre sistólica e diastólica foi firmada na carga de dados padrão. Se a governança clínica decidir que deveria ser "E", basta o administrador do sistema inativar as regras individuais de PAS/PAD e recriá-las de acordo, assim que a funcionalidade composta de agrupadores lógicos ("AND") for liberada no frontend do Admin (atualmente suporta regras simples isoladas). **Fase tecnicamente resolvida**.

# 4. Glasgow auditado
Através das queries realizadas anteriormente no `ALL_SOURCE` e na estrutura da tabela `ATEND_ESCALA_INDICE`, constatamos que o TASY armazena as parciais e o somatório oficial no campo `QT_GLASGOW`.

# 5. Glasgow no Wizard
Implementado na Fase 5 nativamente no frontend (Wizard de Triagem P.A.), adicionando as seleções estruturadas para Resposta Ocular, Verbal e Motora, integrando com o motor e refletindo no score dinâmico da tela.

# 6. Fórmula Glasgow
Ocular (1-4) + Verbal (1-5) + Motora (1-6) compondo o Score primário. A regra automática de Glasgow agora é lida como `{ campo: 'glasgow', operador: '<=', valor: 8, cor: 'VERMELHO' }`.

# 7. Critérios automáticos
Totalmente abstraídos. Os limites não ficam escondidos como constantes ou lógicas acopladas. Uma "whitelist" de campos técnicos (`pas`, `pad`, `fc`, `fr`, `spo2`, `glasgow`) e de operadores lógicos restringe de maneira segura o que o Administrador pode cadastrar na base de dados, prevenindo injeções e travamentos.

# 8. Critérios manuais
Todos os critérios (V1, A1, B4, etc) agora fazem parte da chave `triagem_regras_manuais` da configuração do sistema e carregam as propriedades essenciais: `codigo`, `cor` e flag `ativo`. Se desativados no Admin, sequer pontuam na classificação clínica.

# 9. Evidências estruturadas
Todas as evidências disparadas formam um payload rastreável contendo a regra avaliada:
```json
{
  "origem": "AUTOMATICO",
  "codigo": "V2_FC_ALTA",
  "regra": "V2_FC_ALTA",
  "campo": "fc",
  "valor": 170,
  "operador": ">=",
  "limite": 160,
  "cor": "VERMELHO"
}
```

# 10. Configuração Admin
O Conecta Admin deve suprir as seguintes chaves de integração técnica do lado de armazenamento:
- `triagem_precedencia`: Ordem hierárquica das cores (JSON Array).
- `triagem_regras_automaticas`: Dicionário de limites clínicos de leitura de sinais e escores primários.
- `triagem_regras_manuais`: Listagem de chaves e cores dos comemorativos/histórico.
*O backend assume defaults seguros e fidedignos à regra assistencial se e somente se as chaves estiverem ausentes da base, funcionando como garantia de inicialização (bootstrap).*

# 11. Motor de classificação
O Motor `TriagemPaClassificacaoService` tornou-se uma máquina de regras funcional que apenas processa o *state* (Rascunho Clínico + Configuração Snapshot) e cospe a `classificacaoResolvida`, listando os `criteriosIdentificados` e também anexando um hash das regras usadas (`configVersion`), resolvendo a auditoria do "estado da regra no instante da tomada de decisão".

# 12. Conflitos
Conflitos agora são resolvidos de forma inteligente via a chave configurada de precedência (`VERMELHO > AMARELO`). O status `CONFLITO_DE_CLASSIFICACAO` ocorrerá agora apenas se as configurações do sistema estiverem corrompidas ou incompletas de forma que inviabilizem a escolha determinística (Ex: se uma cor prioritária não constar no vetor do Admin).

# 13. Retomada e recálculo
Sempre recalculado do zero baseado na versão da configuração que está em vigor no momento exato em que a tela/rascunho são manipulados e persistidos, preservando integridade se as regras mudarem *on-the-fly*. 

# 14. Testes
Desenvolvidos 7 testes na nova arquitetura, todos com aprovação ("All tests passed!") para cenários em que o mock das configurações do Admin são mutáveis (ex: testar se a diminuição de FC no threshold faz o motor reagir sem recompilação de código, alteração de hierarquia AMARELO > VERMELHO em precedência fictícia, etc). Validação anti-SQL e checagem de integridade de propriedades e campos também cobertas.

# 15. Pendências assistenciais
Apenas validações operacionais de UX para finalização na tela (Fase 6). Do ponto de vista algorítmico, o motor absorveu perfeitamente as definições impostas.

# 16. Veredito

FASE 5 FECHADA: SIM

PODE INICIAR FASE 6: SIM
