# 1. Governança da Escala pelo Admin
A governança da Escala de Triagem P.A. agora pertence integralmente ao painel do Conecta Admin. Todas as lógicas clínicas sensíveis que estavam hardcoded no motor de classificação foram removidas, substituídas por uma estrutura de dicionário inicial configurável (defaults) no banco de dados e controlada dinamicamente via UI Administrativa (`admin.html`). Nenhuma alteração clínica exige modificação de código-fonte.

# 2. UI do Admin
A interface do `admin.html` foi estendida com uma nova aba "Escala P.A." contendo as seções: "Regras Automáticas", "Critérios Manuais" e "Precedência de Cores". A UI fornece formulários interativos para criar, atualizar e excluir as regras de classificação, suportando inputs numéricos, seletores de operadores e configuração visual dos agrupamentos condicionais. O JavaScript do Admin (`admin.js`) envia a configuração para a API de Configurações do Backend de forma assíncrona.

# 3. Regras automáticas
As regras automáticas são baseadas nos Sinais Vitais e no Índice de Glasgow. Todas podem ser cadastradas e alteradas pelo Admin, especificando o campo monitorado (ex: `pas`, `pad`, `fc`, `sato2`), o operador (ex: `>`, `<`, `>=`, `<=`, `==`) e o valor numérico. As cores de classificação são associadas a cada regra.

# 4. Agrupamentos AND/OR
O motor de classificação, através da função `evaluateRuleGroup`, suporta operadores lógicos entre múltiplos critérios. É possível configurar, por exemplo, que a regra só será verdadeira se "(PAS > 170) OU (PAD > 120)", selecionando a condição `OR` na UI de Regras Automáticas. O backend interpreta corretamente tanto `AND` quanto `OR`.

# 5. Critérios manuais
Os critérios manuais que exigem o julgamento humano do enfermeiro também foram convertidos para a interface do Admin, classificados por cores. O usuário administrador tem acesso a criar e modificar listas de critérios como "Alteração aguda de comportamento", "Dor severa", "Comprometimento de via aérea", definindo suas ordens e descrições sem tocar no código.

# 6. Precedência
A regra que determina qual cor prevalece em caso de múltiplas classificações (conflito aparente) agora não é mais inferida estaticamente, mas explicitamente definida na configuração de Precedência (ex: 1º Vermelho, 2º Amarelo, 3º Verde, 4º Azul). A interface do Admin permite reorganizar a precedência. 

# 7. Modelo de configuração
O modelo consiste em JSONs estruturados gravados em chaves de configuração (`triagem_regras_automaticas`, `triagem_criterios_manuais`, `triagem_precedencia`). A estrutura usa Arrays de `condicoes` com `{campo, operador, valor}` e um `operadorLogico` agrupativo para cada regra.

# 8. Validações backend
O backend foi modificado para utilizar whitelists seguras (`allowedFields`, `allowedOperators`). Não existe a injeção de SQL (SQL Injection) nem a utilização de `eval()`. A validação nativa de regras interpreta apenas as chaves permitidas, lançando exceções estruturadas se um administrador enviar operadores não previstos ou dados corrompidos.

# 9. Atomicidade
A classificação ocorre de maneira síncrona pelo `TriagemPaClassificacaoService`, calculando as três engrenagens (Automáticas, Manuais, Precedência) a partir dos dados do Cache/Config e os unindo de forma determinística no array final, sem side-effects no Oracle TASY durante o cálculo.

# 10. Versionamento
O backend armazena o histórico de quem alterou a configuração via a trilha de auditoria padrão de configs no SQLite, mantendo o tracking se a escala foi mudada entre o paciente A e o paciente B.

# 11. Motor genérico
O motor `calcularClassificacao` avalia apenas condições. Ele desconhece se a triagem é Manchester, P.A., canadense ou híbrida. Ele processa as condições lógicas retornando evidências e cores.

# 12. Testes
Foi criado o script dinâmico `test_fase5_admin_ui.js` cobrindo cenários com e sem config sobreescrita e com condições combinadas `AND`/`OR`. Os testes verificaram tanto a sintaxe (após a correção de Template Literals) quanto a exatidão das regras com mock JSON. Todos passaram, comprovando o isolamento.

# 13. Auditoria da UI
Na UI Clínica (Stepper Frontend), os valores vêm da API `GET /api/triagem-pa/configs`, de modo que a tela de "Critérios Identificados" exibe os labels e checks exatamente como desenhados no Admin, gerando `evidencias` literais a partir da parametrização em tempo real.

# 14. Hardcodes encontrados
Todos os hardcodes clínicos de Sinais Vitais (os números 170, 120, 80, 60 e seus respectivos operadores > e <) foram removidos da estrutura estática e movidos para a matriz de bootstrap (`defaultRegrasAutomaticas`), garantindo fallback inicial, mas não interferindo com as edições do Admin.

# 15. Veredito
O motor está completamente genérico, agnóstico, auditável e seguro. As regras estão sendo corretamente controladas e interpretadas.

FASE 5 DEFINITIVAMENTE FECHADA: SIM
PODE INICIAR FASE 6: SIM
