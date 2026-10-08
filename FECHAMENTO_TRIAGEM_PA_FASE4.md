# 1. Rascunho clínico
Migrado do banco genérico de configurações para um banco operacional seguro. Está armazenado fisicamente em `backend/src/core/database/auth.sqlite/operacional.db`, na tabela `triagem_rascunhos`.
- Schema: `nr_atendimento` (PK), `rascunho_json` (que armazena todo o payload de Queixa, Sinais Vitais, Comportamento, etc), `nm_usuario`, `version` e timestamps.
- A exclusão manual/arquivamento futuro está provisionada no `TriagemPaRascunhoRepository.js` via `removeRascunho`.

# 2. Banco utilizado
Como exigido, `config.db` foi descartado para esta funcionalidade. Criamos um novo database (`operacional.db`) mantendo o isolamento clínico e protegendo o ambiente de configurações do Admin.

# 3. Segurança e acesso
- Arquivo `operacional.db` restrito ao backend da infraestrutura (não acessível por browser);
- Endpoints exigem login válido;
- O método de gravação/leitura vincula os dados rigorosamente ao `nr_atendimento` em curso; não expõe dados ao frontend se o `nr_atendimento` não for explicitamente enviado pelo modal de triagem autorizada.

# 4. Estratégia de autosave
- Frontend executa debounce (timeout = 1000ms), cancelando saves excessivos ao digitar.
- Backend incorpora controle de Versão (MVCC) com o atributo `version`.

# 5. Concorrência
- Prevenção de Conflito Silencioso ativada.
- Se o backend identificar que o payload enviado pelo usuário `A` possui uma versão inferior à já armazenada no banco pelo usuário `B`, ele bloqueia e emite um erro de `Conflito de Versão`, impedindo sobrescrita de dados fora de ordem.

# 6. Sintomas Gripais
- Validado contra modelo existente da Recepção/EHR_TEMPLATE. Mantido como Sim/Não explícito (Switch) e `textarea` auxiliar apenas ativado caso o switch seja "Sim". Total aderência à simplicidade, sem invenção de arrays fechados adicionais e síndromes fictícias.

# 7. Sinais Vitais
- Limites bloqueantes corrigidos na interface (HTML `min/max`).
- Os campos agora suportam: PAS/PAD até 350/250, FC até 350, FR até 150, Temperatura de 15 a 45. Nenhum destes impede ou mascara o registro de uma classificação Manchester/Classificação Vermelha.

# 8. Alergias
- A consulta `paciente_alergia` (TASY) implementada via `TriagemPaClinicoRepository`.
- Impede marcar "Nega Alergias" se retornarem registros da consulta. (Alergias inativadas/canceladas são ignoradas da consulta graças ao filtro `ie_situacao = 'A'`).

# 9. Configurações clínicas no Admin
- Interface implementada em `frontend/admin.html` (no mesmo subpainel da Triagem P.A.).
- Funcional, permitindo editar JSON raw de `TriagemPa_campos_clinicos`, viabilizando ao Gestor ativar/inativar opções.

# 10. Validações backend
- `TriagemPaValidator.js` intercepta payloads inválidos:
  - Nega Comorbidades em conjunto com outras doenças = ERRO 400.
  - Corado + Hipocorado (ou análogos de Estado Geral) = ERRO 400.
  - Sinais decimais vs. inteiros = ERRO 400.

# 11. Organização Repository/Service
- Limpo o Service. Foram isolados:
  - `TriagemPaClinicoRepository.js` (Lê Oracle/TASY).
  - `TriagemPaRascunhoRepository.js` (Lê Operacional SQLite).

# 12. Testes
- Adicionados com mocks exatos ao `backend/test_fase4.js` para certificar concorrência (`version`), limites plausíveis extremos e conciliação de backend e frontend. 100% de sucesso.

# 13. Pendências
- Exclusão do Rascunho Clínico ao "Finalizar Triagem". (Função já preparada, será acionada na Fase 5/6).

# 14. Veredito

FASE 4 FECHADA: SIM
PODE INICIAR FASE 5: SIM
