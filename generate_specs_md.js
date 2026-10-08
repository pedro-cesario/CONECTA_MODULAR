const fs = require('fs');

const markdownContent = `
# ESPECIFICAÇÃO DE REQUISITOS - TRIAGEM P.A. (NOVO MÓDULO CONECTA)

Este documento descreve as diretrizes funcionais e técnicas para a refatoração e reconstrução do módulo de Triagem P.A. (Pronto Atendimento) no projeto Conecta HEAL. O objetivo é torná-lo um módulo nativo, independente do layout do template EHR do TASY e modular, isolado do módulo de Recepção.

---

## 1. Visão Geral da Arquitetura
A arquitetura desejada exige modularidade. O P.A. não deverá depender das rotas da Recepção. As funções genéricas (Core) devem ser extraídas.

**Diagrama da Arquitetura (Desejada):**
\`\`\`mermaid
flowchart TD
    A[Frontend P.A. Triagem] --> B(Conecta Core API / Serviços)
    C[Frontend Recepção] --> B
    B --> D[(TASY Oracle)]
    B --> E[(Conecta Admin SQLite)]
\`\`\`

### Tabela: Componentes Modulares (Extração para o Core)
| Função | Local atual | Módulo que usa | Destino sugerido |
|---|---|---|---|
| Busca paciente | \`recepcaoRepository.js\` | Recepção e P.A. | Core / Pacientes |
| Cadastro de paciente | \`recepcaoRepository.js\` | Recepção e P.A. | Core / Pacientes |
| Verificar CPF Duplicado | \`recepcaoRepository.js\` | Recepção (P.A. hoje não usa) | Core / Pacientes |
| Abrir Atendimento | \`recepcaoRepository.js\` | Recepção e P.A. | Core / Atendimentos |
| Inutilizar/Descartar Senha | \`recepcaoRepository.js\` | Recepção (P.A. tem suporte no backend) | Core / Senhas |
| Chamar/Rechamar Senha | \`recepcaoRepository.js\` | Recepção e P.A. | Core / Senhas |

---

## 2. Fluxo da Senha

| Etapa | Como funciona hoje | Como deverá funcionar | Reaproveita? | Alteração necessária | Arquivos envolvidos |
|---|---|---|---|---|---|
| **Permanência na Fila** | Senha é encerrada (\`dt_fim_atendimento = SYSDATE\`) ao abrir o atendimento, sumindo do painel de P.A. antes da triagem terminar. | Senha continua na fila de origem durante toda a triagem com status similar a \`TRIAGEM_EM_ANDAMENTO\`. | Parcial | Postergar encerramento/movimentação para a fase de *Finalização* da Triagem. | \`recepcaoRepository.abrirAtendimento\` (remover UPDATE prematuro da senha) |
| **Descarte / Inutilização** | Backend possui rota \`/inutilizar\`, mas não há botão na tela da Triagem P.A. | Adicionar botão "Descartar" obrigando preenchimento de motivo (parametrizável). | Sim (backend) | Adicionar UI no \`dashboard.js\` chamando a rota já existente da Recepção (ou do novo Core). | \`dashboard.js\` (Frontend) |
| **Movimentação (Destino)** | Não especifica fila de destino. Transição para Médico é dependente do TASY via triggers de abertura de atendimento. | Após finalizar e gravar evolução, o Conecta moverá explicitamente a senha para a \`Fila Destino\` configurada no Admin. | Não | Criar rotina transacional na finalização para chamar UPDATE em \`paciente_senha_fila\` atualizando \`nr_seq_fila_senha\`. | \`ehrController.js\` ou novo \`triagemController.js\` |

---

## 3. Busca Inteligente de Paciente

**Regra de Negócio e Falhas Atuais:**
- Hoje: Uma pesquisa por "Pedro Teles" encontra "Erick Pedro Xavier Telesforo" pois a query (\`recepcaoRepository.js\`) usa substring (\`LIKE '%TELES%'\`). Não suporta Data de Nascimento nativamente de forma intuitiva.
- Desejado: Input único: *"Buscar por nome, CPF ou data de nascimento..."*.

**Estratégia Técnica:**
1. **Detecção:**
   - **CPF:** Se o input tiver 11 dígitos numéricos (limpo), tentar CPF exato.
   - **Data:** Se bater regex de \`DD/MM/YYYY\`, \`DD-MM-YYYY\` ou \`YYYY-MM-DD\`, converter e buscar por \`dt_nascimento\`.
   - **Nome:** Normalizar (sem acento, caixa alta), tokenizar por espaço.
2. **Proteção Substring:** Em Oracle, usar expressão regular ou formato delimitado por espaços para evitar que "TELES" ache "TELESFORO".
3. **Ordenação (Relevância):** Usar ORDER BY com CASE para priorizar nome exato, depois que começa com a string, etc.
4. **Debounce:** O frontend já usa (ou deve implementar) debounce de 500ms no input.

---

## 4. Cadastro de Novo Paciente e Condição de Identificação

| Etapa | Como funciona hoje | Como deverá funcionar | Reaproveita? | Alteração necessária | Arquivos envolvidos |
|---|---|---|---|---|---|
| **Formulário Cadastro** | Exibe Nome, CPF, Nasc, Sexo, Celular, Mãe. Salva direto via POST sem testar duplicidade no P.A. | Apenas Nome, Nasc, CPF. | Parcial | Remover campos desnecessários. **Bloquear** se CPF existir usando rota de duplicidade do Core. Mostrar paciente existente e permitir vinculá-lo. | \`dashboard.js\`, \`recepcaoRepository.js\` |
| **Condição Identificação** | Não existe campo nem gravação desse status no TASY. | Após selecionar/cadastrar, o profissional define: (Identificado, Não apresentou doc, Não identificado). | Não | Criar etapa na UI. Gravar na Evolução. Registrar em local TASY pertinente (PENDENTE VALIDAÇÃO). | \`dashboard.js\` |
| **Não Identificado (TASY)** | Busca não acha, usuário preenche form genérico. | Uso de contas pré-existentes ("PACIENTE NAO IDENTIFICADO 01..10") com controle de locks. | Não | Criar tabela/controle de empréstimo de pacientes coringa. Configurar IDs no Admin. | \`dashboard.js\`, novo serviço |

---

## 5. Template Próprio e Triagem Clínica

O Conecta não deverá gerar sua tela através do modelo dinâmico do TASY. A interface será fixa e otimizada.

| Componente | Como funciona hoje | Como deverá funcionar | Reaproveita? | Alteração necessária |
|---|---|---|---|---|
| **Queixa Principal** | Renderiza inputs do EHR e concatena no texto final. | Campo de texto único na UI. Remoção de tags/chips duvidosos. Concatena no texto da evolução. | Sim (gravação) | Refazer UI. Remover dependência do EHR TASY. |
| **Alergias** | Adiciona sem consultar histórico. | Consulta histórico do TASY, exibe em tela. Permite adicionar, ou assinalar "Nega Alergias" (exclusivo). | Sim (INSERT Oracle) | Criar endpoint de GET de Alergias. Validar exclusividade na UI. |
| **Sinais Vitais** | Modal nativo, insere de forma atômica. | Integrar no fluxo do stepper. Salvar na mesma tabela TASY. | Sim (INSERT Oracle) | Embutir form no wizard do modal de Triagem. |
| **Glasgow** | Modal nativo com cálculo no Backend. | Integrar form no wizard. Cálculo atual no front e back mantido. | Sim (Cálculo e INSERT) | Embutir no wizard da Triagem. |
| **Histórico, Estado Geral, Comportamento, Sintomas** | Tudo lido via EHR dinâmico e jogado no texto (\`DS_EVOLUCAO\`). | Telas independentes (checkbox/radio). "Nega Comorbidades" e pares incompatíveis validados e configuráveis no Admin. | Sim (Geração de texto) | Construir UI nativa para essas opções sem ler de tabela de template TASY. |
| **Escala Triagem P.A.** | Depende do modelo TASY "Manchester". | Regras puras do Conecta: Verde, Amarelo, Vermelho, Azul. | Não | Criar motor de regras local que avalia sinais vitais e Glasgow automaticamente e soma os checklists do usuário. |

---

## 6. Abertura do Atendimento e Finalização

| Etapa | Como funciona hoje | Como deverá funcionar | Reaproveita? | Alteração necessária | Arquivos envolvidos |
|---|---|---|---|---|---|
| **Abertura do Atendimento** | Aberto logo ao confirmar identificação demográfica, usando autoCommit. | Abre no mesmo momento, retornando atendimento. Mas requer proteção contra duplo clique. | Sim | Impedir duplos INSERTs acidentais e não alterar a senha (\`dt_fim_atendimento\`) nesta hora. | \`dashboard.js\`, \`recepcaoRepository.js\` |
| **Finalização** | Insere em 3 tabelas + Evolução de forma procedural com autoCommit=true. Assina XML. Fecha senha. | Apenas fecha senha **depois** de salvar todos os dados com ROLLBACK em caso de falha. | Sim (queries) | Agrupar as chamadas TASY usando controle transacional. Se der erro, mantém senha na fila P.A. | \`ehrController.js\` -> Novo controller |

---

## 7. Conecta Admin

**Parametrizações Necessárias (A evitar hardcode):**
| Configuração | Tipo | Uso | Valor atual/hardcode | Novo comportamento |
|---|---|---|---|---|
| fila_origem_pa | Int Array | Filas monitoradas para exibir P.A. | configuracoes_dashboard_pa | Melhorar estrutura |
| fila_destino_pa | Int | Fila pós-triagem (Consultório Médico) | Trigger no TASY (oculto) | O Conecta fará UPDATE movendo a senha explícita. |
| cd_setor_atendimento | Int | Setor de P.A. na abertura TASY | 39 | Vir do banco local Admin |
| cd_procedencia | Int | Procedência | 1 | Vir do banco local Admin |
| ie_tipo_atendimento | Int | Tipo de atendimento | 1 | Vir do banco local Admin |
| cd_motivo_atendimento | Int | Motivo de atendimento | 1 | Vir do banco local Admin |
| ie_clinica | Int | Clínica | 1 | Vir do banco local Admin |
| motivos_descarte | JSON | Lista de motivos para inutilizar senha | ID 3 (Outros) | CRUD no admin de motivos |
| pacientes_coringa | Int Array | IDs TASY dos "Pacientes Não Identificados" | Nenhum | Gerenciar array de cd_pessoa_fisica temporários. |

---

## 8. Pendências TASY (Auditoria Obrigatória)

| Item | O que sabemos | O que falta descobrir | Onde procurar no Banco Oracle |
|---|---|---|---|
| **NR_SEQ_TRIAGEM** | Altera a cor/classificação no PEP. | Qual o domínio correto? Tem triggers associadas? Qual o ID para Vermelho, Amarelo, Verde, Azul? | Tabela ATENDIMENTO_PACIENTE, FKs de NR_SEQ_TRIAGEM. |
| **IE_STATUS_PA** | Controla estado do paciente no painel geral. | Quando deve ser alterado? Que valores usar em Triagem e Finalização? | ATENDIMENTO_PACIENTE.IE_STATUS_PA. |
| **Condição de Identificação** | O Conecta terá (Identificado, Não Identificado, etc). | Onde gravar no TASY de forma que a Assistência Social/Recepção identifique depois? | Observações do atendimento ou campos do PEP. |
| **Fila Destino Automatizada** | Hoje o sistema move via trigger na abertura do atendimento. | Se o Conecta não fechar a senha na abertura (para manter "Em andamento"), as triggers originais serão quebradas? | paciente_senha_fila. |
| **Regra de Prioridade (Cor)**| Paciente pode ter 2 critérios de cores diferentes. | Sempre vence a cor mais grave? (Pendente de Validação Assistencial). | Protocolos clínicos. |

---

## 9. Fluxos em Mermaid

### Fluxo Atual
\`\`\`mermaid
flowchart TD
    A[Senha aguarda na Fila] --> B[Clicar em Atender]
    B --> C[Buscar/Cadastrar sem validar duplicidade]
    C --> D[Confirmar Demográfico]
    D --> E[Abre Atendimento TASY e Encerra Senha PA]
    E --> F[Carrega EHR TASY Dynamic]
    F --> G[Preenche 7 forms]
    G --> H[Finaliza: AutoCommit sem Rollback]
\`\`\`

### Fluxo Desejado
\`\`\`mermaid
flowchart TD
    A[Senha aguarda na Fila] --> B[Chamar ou Atender]
    B --> C[Identificação com Validação de CPF Duplicado]
    C --> D[Condição: Identificado / Não Identificado]
    D --> E[Confirmar Demográfico]
    E --> F[Abre Atendimento - Senha Continua na Fila]
    F --> G[Stepper Nativo Conecta]
    G --> H[Motor de Regras: Sugere Cor baseada em Glasgow e Vitais]
    H --> I[Finalização - Controle Transacional]
    I -->|Sucesso| J[Atualiza TASY, Movimenta Fila Destino, Grava Evolução e Encerra Fila P.A.]
    I -->|Erro| K[Rollback e Mantém tudo pendente]
\`\`\`

---

## 10. Plano de Implementação (Fases)

**FASE 0 — Auditorias pendentes TASY**
- Objetivo: Mapear valores corretos de NR_SEQ_TRIAGEM e IE_STATUS_PA.
- Arquivos: Banco Oracle TASY.
- Risco: Alto.
- Critério de conclusão: Valores mapeados e documentados.

**FASE 1 — Modularização de serviços compartilhados**
- Objetivo: Extrair endpoints da recepção (Busca paciente, CPF Duplicado, Atendimento) para uma rota/controller Core.
- Arquivos: recepcaoRepository.js -> Novo core/pacientesRepository.js.

**FASE 2 — Configurações no Admin**
- Objetivo: Criar tabelas SQLite para suportar P.A. (filas de destino, coringas, regras de comorbidades).

**FASE 3 — Busca e Identificação**
- Objetivo: Refatorar UI e backend para Tokenização e match exato de CPF.

**FASE 4 — Template próprio do Conecta**
- Objetivo: Abandonar o EHR dinâmico e criar forms estáticos (Stepper).
- Arquivos: dashboard.js UI (HTML).

**FASE 5 — Dados Clínicos (Alergias e Sinais)**
- Objetivo: Consultar as alergias prévias e integrar fluxos nativos no stepper.

**FASE 6 — Escala de Triagem P.A.**
- Objetivo: Motor de classificação nativo Conecta baseado em inputs automáticos (PA, FC, Glasgow).

**FASE 7 — Classificação TASY**
- Objetivo: Integrar o output da FASE 6 nos campos do TASY mapeados na FASE 0.

**FASE 8 — Finalização, Transação e Fila**
- Objetivo: Envolver o salvarTriagem em uma transação Oracle com Rollback. Apenas neste momento dar baixa na Fila P.A. e fazer UPDATE para Fila Destino.

**FASE 9 — Auditoria e Testes**
- Objetivo: Garantir ausência de locks duplos e duplicação acidental.
`

fs.writeFileSync('/media/SAAS/SAAS/CONECTA_MODULAR/ESPECIFICACAO_TRIAGEM_PA_CONECTA.md', markdownContent);
console.log('Spec gerada com sucesso.');
